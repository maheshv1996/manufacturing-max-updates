import { format, subDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { prisma } from "@/lib/prisma";
import ClientReportControls from "./ClientReportControls";
import PrintWrapper from "@/app/components/print/PrintWrapper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function DailyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const resolvedParams = await searchParams;
  const targetDate = resolvedParams.date
    ? parseISO(resolvedParams.date)
    : subDays(new Date(), 1);
  const targetDateStr = format(targetDate, "yyyy-MM-dd");

  const start = startOfDay(targetDate);
  const end = endOfDay(targetDate);

  const machines = await prisma.machine.findMany({
    where: { isActive: true },
    include: {
      productionLogs: {
        where: { startTime: { gte: start, lte: end } },
        include: { workOrder: { include: { product: true } } },
      },
      downtimeLogs: {
        where: { startTime: { gte: start, lte: end } },
        include: { reason: true },
      },
    },
    orderBy: { name: "asc" },
  });

  let plantGood = 0;
  let plantScrap = 0;
  let plantDowntimeMin = 0;

  const downtimeReasonsMap = new Map<
    string,
    { desc: string; minutes: number }
  >();

  const machineStats = machines.map((machine) => {
    let mGood = 0;
    let mScrap = 0;
    let mDowntime = 0;
    let idealCycleTimeSeconds = machine.idealCycleTimeSeconds || 60;

    const wosSet = new Map<string, string>();

    machine.productionLogs.forEach((log) => {
      mGood += log.goodQuantity;
      mScrap += log.scrapQuantity;
      if (log.workOrder) {
        wosSet.set(
          log.workOrder.woNumber,
          log.workOrder.product?.name || "Unknown",
        );
      }
    });

    machine.downtimeLogs.forEach((dt) => {
      let durationMin = 0;
      if (dt.endTime) {
        durationMin = Math.round(
          (dt.endTime.getTime() - dt.startTime.getTime()) / (1000 * 60),
        );
      } else {
        const until = dt.startTime > end ? end : new Date();
        durationMin = Math.round(
          (until.getTime() - dt.startTime.getTime()) / (1000 * 60),
        );
      }
      if (durationMin < 0) durationMin = 0;

      mDowntime += durationMin;

      const reasonDesc = dt.reason?.description || "Unclassified Downtime";
      const current = downtimeReasonsMap.get(reasonDesc) || {
        desc: reasonDesc,
        minutes: 0,
      };
      downtimeReasonsMap.set(reasonDesc, {
        desc: reasonDesc,
        minutes: current.minutes + durationMin,
      });
    });

    plantGood += mGood;
    plantScrap += mScrap;
    plantDowntimeMin += mDowntime;

    const mTotal = mGood + mScrap;
    const mScrapRate = mTotal > 0 ? (mScrap / mTotal) * 100 : 0;
    const mRunMinutes = (mGood * idealCycleTimeSeconds) / 60;

    return {
      machine,
      mGood,
      mScrap,
      mTotal,
      mScrapRate,
      mDowntime,
      mRunMinutes,
      wos: Array.from(wosSet.entries()).map(
        ([num, prod]) => `${num} (${prod})`,
      ),
    };
  });

  const plantTotalProduced = plantGood + plantScrap;
  const plantScrapRate =
    plantTotalProduced > 0 ? (plantScrap / plantTotalProduced) * 100 : 0;
  const topDowntimeReasons = Array.from(downtimeReasonsMap.values())
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 5);

  return (
    <PrintWrapper
      title="Daily Production Summary"
      subtitle={`Report Date: ${format(targetDate, "MMMM d, yyyy")}`}
      controls={<ClientReportControls initialDate={targetDateStr} />}
    >
      {/* KPI METRICS SUMMARY */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            Good Production
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {plantGood.toLocaleString()} pcs
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            Scrap Units
          </div>
          <div className="text-2xl font-black text-rose-600 font-mono">
            {plantScrap.toLocaleString()} pcs ({plantScrapRate.toFixed(1)}%)
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            Total Downtime
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono">
            {plantDowntimeMin} mins
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            Active Machines
          </div>
          <div className="text-2xl font-black text-blue-600 font-mono">
            {machines.length} Units
          </div>
        </div>
      </div>

      {/* MACHINE PERFORMANCE TABLE */}
      <div className="space-y-3">
        <h3 className="text-base font-extrabold uppercase tracking-wide text-slate-900 border-b pb-2">
          Machine Output Breakdown
        </h3>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-300 font-bold uppercase text-slate-700">
              <th className="p-2.5">Machine</th>
              <th className="p-2.5 text-right">Good Qty</th>
              <th className="p-2.5 text-right">Scrap Qty</th>
              <th className="p-2.5 text-right">Scrap %</th>
              <th className="p-2.5 text-right">Downtime</th>
              <th className="p-2.5">Work Orders Run</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {machineStats.map((ms) => (
              <tr key={ms.machine.id} className="hover:bg-slate-50">
                <td className="p-2.5 font-bold">{ms.machine.name}</td>
                <td className="p-2.5 text-right font-mono font-bold">
                  {ms.mGood.toLocaleString()}
                </td>
                <td className="p-2.5 text-right font-mono text-rose-600">
                  {ms.mScrap.toLocaleString()}
                </td>
                <td className="p-2.5 text-right font-mono">
                  {ms.mScrapRate.toFixed(1)}%
                </td>
                <td className="p-2.5 text-right font-mono text-amber-600">
                  {ms.mDowntime} mins
                </td>
                <td className="p-2.5 font-mono text-[11px] text-slate-600">
                  {ms.wos.length > 0 ? ms.wos.join(", ") : "No log recorded"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* TOP DOWNTIME LOSSES */}
      {topDowntimeReasons.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <h3 className="text-base font-extrabold uppercase tracking-wide text-slate-900 border-b pb-2">
            Top Downtime Loss Reasons
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topDowntimeReasons.map((dt, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center text-xs"
              >
                <span className="font-bold text-slate-800">
                  #{idx + 1} {dt.desc}
                </span>
                <span className="font-mono font-bold text-rose-600">
                  {dt.minutes} mins
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </PrintWrapper>
  );
}
