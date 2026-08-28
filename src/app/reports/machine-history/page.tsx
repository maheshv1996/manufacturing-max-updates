import { prisma } from "@/lib/prisma";
import PrintWrapper from "@/app/components/print/PrintWrapper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function MachineHistoryReportPage({
  searchParams,
}: {
  searchParams: Promise<{ machineId?: string }>;
}) {
  const resolvedParams = await searchParams;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const machines = await prisma.machine.findMany({
    where: { isActive: true },
    include: { line: true },
    orderBy: { name: "asc" },
  });

  const selectedMachine = resolvedParams.machineId
    ? machines.find((m) => m.id === resolvedParams.machineId) || machines[0]
    : machines[0];

  const downtimeLogs = await prisma.downtimeLog.findMany({
    take: 100,
    where: {
      machineId: selectedMachine?.id,
      startTime: { gte: thirtyDaysAgo },
    },
    include: { reason: true },
    orderBy: { startTime: "desc" },
  });

  let totalDowntimeMin = 0;
  const reasonMap: Record<
    string,
    { desc: string; minutes: number; count: number }
  > = {};

  downtimeLogs.forEach((log) => {
    let dur = 0;
    if (log.endTime)
      dur = Math.round(
        (log.endTime.getTime() - log.startTime.getTime()) / (1000 * 60),
      );
    else
      dur = Math.round((now.getTime() - log.startTime.getTime()) / (1000 * 60));
    if (dur < 0) dur = 0;

    totalDowntimeMin += dur;

    const desc = log.reason?.description || "Unclassified Downtime";
    if (!reasonMap[desc]) reasonMap[desc] = { desc, minutes: 0, count: 0 };
    reasonMap[desc].minutes += dur;
    reasonMap[desc].count += 1;
  });

  const totalOperatingHours = 30 * 24; // 720 hours
  const downtimeHours = totalDowntimeMin / 60;
  const totalFailures = downtimeLogs.length || 1;

  const mtbfHours = Number(
    ((totalOperatingHours - downtimeHours) / totalFailures).toFixed(1),
  );
  const mttrMinutes = Number((totalDowntimeMin / totalFailures).toFixed(1));

  const topReasons = Object.values(reasonMap).sort(
    (a, b) => b.minutes - a.minutes,
  );

  return (
    <PrintWrapper
      title={`Machine Maintenance & Reliability Card — ${selectedMachine?.name}`}
      subtitle={`Line: ${selectedMachine?.line?.name || "General"} • Code: ${selectedMachine?.code} • Past 30 Days`}
    >
      {/* RELIABILITY METRICS (MTBF / MTTR) */}
      <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            MTBF (Mean Time Between Failures)
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            {mtbfHours} hrs
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            MTTR (Mean Time To Repair)
          </div>
          <div className="text-2xl font-black text-rose-600 font-mono">
            {mttrMinutes} mins
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            Total Failures (30d)
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {downtimeLogs.length} Events
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            Total Downtime (30d)
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono">
            {downtimeHours.toFixed(1)} hrs
          </div>
        </div>
      </div>

      {/* TOP DOWNTIME CAUSES */}
      <div className="space-y-3">
        <h3 className="text-base font-extrabold uppercase tracking-wide text-slate-900 border-b pb-2">
          Top Equipment Failure Causes (Past 30 Days)
        </h3>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-300 font-bold uppercase text-slate-700">
              <th className="p-2.5">Failure Reason / Cause</th>
              <th className="p-2.5 text-right">Failure Count</th>
              <th className="p-2.5 text-right">Total Stoppage (Mins)</th>
              <th className="p-2.5 text-right">% of Equipment Downtime</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {topReasons.map((r, idx) => {
              const pct =
                totalDowntimeMin > 0 ? (r.minutes / totalDowntimeMin) * 100 : 0;
              return (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-2.5 font-bold">{r.desc}</td>
                  <td className="p-2.5 text-right font-mono">{r.count}</td>
                  <td className="p-2.5 text-right font-mono font-bold text-rose-600">
                    {r.minutes} mins
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

      {/* 30 DAY STOPPAGE HISTORY LOG */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <h3 className="text-base font-extrabold uppercase tracking-wide text-slate-900 border-b pb-2">
          30-Day Stoppage History Log ({downtimeLogs.length} Records)
        </h3>
        <table className="w-full text-left text-xs border-collapse font-mono">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-300 font-bold uppercase text-slate-700 font-sans">
              <th className="p-2.5">Start Time</th>
              <th className="p-2.5">End Time</th>
              <th className="p-2.5">Reason</th>
              <th className="p-2.5 text-right">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {downtimeLogs.slice(0, 20).map((l) => {
              let dur = 0;
              if (l.endTime)
                dur = Math.round(
                  (l.endTime.getTime() - l.startTime.getTime()) / (1000 * 60),
                );
              return (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="p-2.5">
                    {new Date(l.startTime).toLocaleString()}
                  </td>
                  <td className="p-2.5">
                    {l.endTime
                      ? new Date(l.endTime).toLocaleString()
                      : "Active"}
                  </td>
                  <td className="p-2.5 font-bold font-sans">
                    {l.reason?.description || "Unclassified"}
                  </td>
                  <td className="p-2.5 text-right font-bold text-rose-600">
                    {dur} mins
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
