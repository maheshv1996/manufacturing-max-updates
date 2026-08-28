import { prisma } from "@/lib/prisma";
import PrintWrapper from "@/app/components/print/PrintWrapper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function DowntimeReportPage({
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

  const downtimeLogs = await prisma.downtimeLog.findMany({
    take: 100,
    where: { startTime: { gte: start, lte: end } },
    include: { machine: true, reason: true },
    orderBy: { startTime: "desc" },
  });

  const machineMap: Record<
    string,
    { name: string; totalMin: number; count: number }
  > = {};
  const reasonMap: Record<
    string,
    { desc: string; category: string; totalMin: number; count: number }
  > = {};

  let grandTotalMin = 0;

  downtimeLogs.forEach((log) => {
    let durationMin = 0;
    if (log.endTime) {
      durationMin = Math.round(
        (log.endTime.getTime() - log.startTime.getTime()) / (1000 * 60),
      );
    } else {
      const until = log.startTime > end ? end : new Date();
      durationMin = Math.round(
        (until.getTime() - log.startTime.getTime()) / (1000 * 60),
      );
    }
    if (durationMin < 0) durationMin = 0;

    grandTotalMin += durationMin;

    // Machine Stats
    const mName = log.machine?.name || "Unknown Machine";
    if (!machineMap[mName])
      machineMap[mName] = { name: mName, totalMin: 0, count: 0 };
    machineMap[mName].totalMin += durationMin;
    machineMap[mName].count += 1;

    // Reason Stats
    const rDesc = log.reason?.description || "Unclassified";
    const rCat = log.reason?.category || "UNCLASSIFIED";
    if (!reasonMap[rDesc])
      reasonMap[rDesc] = { desc: rDesc, category: rCat, totalMin: 0, count: 0 };
    reasonMap[rDesc].totalMin += durationMin;
    reasonMap[rDesc].count += 1;
  });

  const machineList = Object.values(machineMap).sort(
    (a, b) => b.totalMin - a.totalMin,
  );
  const reasonList = Object.values(reasonMap).sort(
    (a, b) => b.totalMin - a.totalMin,
  );

  return (
    <PrintWrapper
      title="Machine Downtime Analysis Report"
      subtitle={`Period: ${start.toLocaleDateString()} — ${end.toLocaleDateString()}`}
    >
      <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            Total Downtime Events
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {downtimeLogs.length}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            Total Downtime Minutes
          </div>
          <div className="text-2xl font-black text-rose-600 font-mono">
            {grandTotalMin.toLocaleString()} mins
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            Total Downtime Hours
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono">
            {(grandTotalMin / 60).toFixed(1)} hrs
          </div>
        </div>
      </div>

      {/* DOWNTIME BY REASON TABLE */}
      <div className="space-y-3">
        <h3 className="text-base font-extrabold uppercase tracking-wide text-slate-900 border-b pb-2">
          Stoppage Loss by Reason Category
        </h3>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-300 font-bold uppercase text-slate-700">
              <th className="p-2.5">Downtime Reason</th>
              <th className="p-2.5">Category</th>
              <th className="p-2.5 text-right">Occurrences</th>
              <th className="p-2.5 text-right">Duration (Mins)</th>
              <th className="p-2.5 text-right">% of Total Loss</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {reasonList.map((r, idx) => {
              const pct =
                grandTotalMin > 0 ? (r.totalMin / grandTotalMin) * 100 : 0;
              return (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-2.5 font-bold">{r.desc}</td>
                  <td className="p-2.5 font-mono text-[11px] text-slate-600">
                    {r.category}
                  </td>
                  <td className="p-2.5 text-right font-mono">{r.count}</td>
                  <td className="p-2.5 text-right font-mono font-bold text-rose-600">
                    {r.totalMin} mins
                  </td>
                  <td className="p-2.5 text-right font-mono font-bold">
                    {pct.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* DOWNTIME BY MACHINE */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <h3 className="text-base font-extrabold uppercase tracking-wide text-slate-900 border-b pb-2">
          Downtime Impact per Machine
        </h3>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-300 font-bold uppercase text-slate-700">
              <th className="p-2.5">Machine</th>
              <th className="p-2.5 text-right">Stoppage Count</th>
              <th className="p-2.5 text-right">Total Stoppage (Mins)</th>
              <th className="p-2.5 text-right">Hours Lost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {machineList.map((m, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="p-2.5 font-bold">{m.name}</td>
                <td className="p-2.5 text-right font-mono">{m.count}</td>
                <td className="p-2.5 text-right font-mono font-bold text-rose-600">
                  {m.totalMin} mins
                </td>
                <td className="p-2.5 text-right font-mono">
                  {(m.totalMin / 60).toFixed(1)} hrs
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PrintWrapper>
  );
}
