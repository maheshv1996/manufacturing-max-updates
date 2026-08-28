import { prisma } from "@/lib/prisma";
import PrintWrapper from "@/app/components/print/PrintWrapper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function PerformanceReportPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string }>;
}) {
  const resolvedParams = await searchParams;
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = resolvedParams.startDate
    ? new Date(resolvedParams.startDate)
    : defaultStart;
  const end = resolvedParams.endDate ? new Date(resolvedParams.endDate) : now;
  end.setHours(23, 59, 59, 999);

  const [machines, productionLogs, downtimeLogs] = await Promise.all([
    prisma.machine.findMany({
      where: { isActive: true },
      include: { line: true },
      orderBy: { name: "asc" },
    }),
    prisma.productionLog.findMany({
      take: 100,
      where: { startTime: { gte: start, lte: end } },
    }),
    prisma.downtimeLog.findMany({
      take: 100,
      where: { startTime: { gte: start, lte: end } },
    }),
  ]);

  const daysCount = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const totalPlannedMin = daysCount * 24 * 60;

  const stats = machines.map((m) => {
    let goodQty = 0;
    let scrapQty = 0;
    let downtimeMin = 0;

    const mProdLogs = productionLogs.filter((pl) => pl.machineId === m.id);
    const mDtLogs = downtimeLogs.filter((dt) => dt.machineId === m.id);

    mProdLogs.forEach((pl) => {
      goodQty += pl.goodQuantity;
      scrapQty += pl.scrapQuantity;
    });

    mDtLogs.forEach((dt) => {
      let dur = 0;
      if (dt.endTime)
        dur = Math.round(
          (dt.endTime.getTime() - dt.startTime.getTime()) / (1000 * 60),
        );
      else
        dur = Math.round(
          ((dt.startTime > end ? end : new Date()).getTime() -
            dt.startTime.getTime()) /
            (1000 * 60),
        );
      if (dur > 0) downtimeMin += dur;
    });

    const operatingMin = Math.max(0, totalPlannedMin - downtimeMin);
    const availability =
      totalPlannedMin > 0 ? (operatingMin / totalPlannedMin) * 100 : 0;

    const totalQty = goodQty + scrapQty;
    const quality = totalQty > 0 ? (goodQty / totalQty) * 100 : 100;

    const idealCycle = m.idealCycleTimeSeconds || 60;
    const idealOutputMin =
      operatingMin > 0 ? (operatingMin * 60) / idealCycle : 0;
    const performance =
      idealOutputMin > 0
        ? Math.min(100, (totalQty / idealOutputMin) * 100)
        : 100;

    const oee = (availability * performance * quality) / 10000;

    return {
      machine: m,
      goodQty,
      scrapQty,
      totalQty,
      downtimeMin,
      operatingMin,
      availability,
      performance,
      quality,
      oee,
    };
  });

  const plantOee =
    stats.reduce((sum, s) => sum + s.oee, 0) / (stats.length || 1);

  return (
    <PrintWrapper
      title="Machine Performance & OEE Matrix"
      subtitle={`Period: ${start.toLocaleDateString()} — ${end.toLocaleDateString()}`}
    >
      {/* PLANT OEE SUMMARY */}
      <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            Plant Avg OEE
          </div>
          <div className="text-2xl font-black text-blue-600 font-mono">
            {plantOee.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            Target OEE
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            85.0%
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            Total Good Units
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {stats.reduce((s, x) => s + x.goodQty, 0).toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            Total Machines
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {machines.length}
          </div>
        </div>
      </div>

      {/* OEE MATRIX TABLE */}
      <div className="space-y-3">
        <h3 className="text-base font-extrabold uppercase tracking-wide text-slate-900 border-b pb-2">
          Equipment OEE Breakdown Matrix
        </h3>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-300 font-bold uppercase text-slate-700">
              <th className="p-2.5">Machine</th>
              <th className="p-2.5 text-right">Good / Total</th>
              <th className="p-2.5 text-right">Availability (A)</th>
              <th className="p-2.5 text-right">Performance (P)</th>
              <th className="p-2.5 text-right">Quality (Q)</th>
              <th className="p-2.5 text-right">Overall OEE</th>
              <th className="p-2.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {stats.map((s) => {
              const statusLabel =
                s.oee >= 85
                  ? "World Class"
                  : s.oee >= 70
                    ? "Acceptable"
                    : "Needs Action";
              const statusColor =
                s.oee >= 85
                  ? "text-emerald-600 font-bold"
                  : s.oee >= 70
                    ? "text-amber-600"
                    : "text-rose-600 font-bold";

              return (
                <tr key={s.machine.id} className="hover:bg-slate-50">
                  <td className="p-2.5 font-bold">{s.machine.name}</td>
                  <td className="p-2.5 text-right font-mono">
                    {s.goodQty.toLocaleString()} / {s.totalQty.toLocaleString()}
                  </td>
                  <td className="p-2.5 text-right font-mono font-semibold">
                    {s.availability.toFixed(1)}%
                  </td>
                  <td className="p-2.5 text-right font-mono font-semibold">
                    {s.performance.toFixed(1)}%
                  </td>
                  <td className="p-2.5 text-right font-mono font-semibold">
                    {s.quality.toFixed(1)}%
                  </td>
                  <td className="p-2.5 text-right font-mono font-black text-sm">
                    {s.oee.toFixed(1)}%
                  </td>
                  <td className={`p-2.5 text-center font-mono ${statusColor}`}>
                    {statusLabel}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PrintWrapper>
  );
}
