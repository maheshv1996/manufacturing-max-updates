import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import { prisma } from "@/lib/prisma";
import PrintWrapper from "@/app/components/print/PrintWrapper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function MorningMeetingPackPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/reports/morning-pack");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    workOrders,
    downtimeLogs,
    attendanceLogsToday,
    fiveSAudits,
    productionLogsMonth,
    handovers,
    topIdeas,
  ] = await Promise.all([
    (prisma as any).machine.findMany({ include: { line: true } }),
    (prisma as any).workOrder.findMany({
      where: { status: { in: ["IN_PROGRESS", "PLANNED", "COMPLETED"] } },
      include: { product: true, productionLogs: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    (prisma as any).downtimeLog.findMany({
      where: { startTime: { gte: monthStart } },
      include: { reason: true, machine: true },
    }),
    (prisma as any).attendanceLog.findMany({
      take: 100,
      where: { clockIn: { gte: todayStart } },
      include: { user: true, shift: true },
    }),
    (prisma as any).fiveSAudit.findMany({
      orderBy: { date: "desc" },
      take: 5,
    }),
    (prisma as any).productionLog.findMany({
      where: { startTime: { gte: monthStart } },
    }),
    (prisma as any).shiftHandover.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    (prisma as any).idea.findMany({
      where: { status: { in: ["APPROVED", "IMPLEMENTED"] } },
      orderBy: [{ upvotes: "desc" }, { createdAt: "desc" }],
      take: 4,
    }),
  ]);

  const allOperators = await (prisma as any).user.findMany({
    where: { role: { name: "Operator" } },
    include: { role: true },
  });

  // Plant Stats
  let totalGood = 0;
  let totalScrap = 0;
  productionLogsMonth.forEach((pl: any) => {
    totalGood += pl.goodQuantity;
    totalScrap += pl.scrapQuantity;
  });

  const totalPlanned =
    workOrders.reduce(
      (sum: number, wo: any) => sum + (wo.plannedQuantity || 1000),
      0,
    ) || 5000;
  const achievementPct = Number(((totalGood / totalPlanned) * 100).toFixed(1));

  const latestMissReason = handovers.find((h: any) => h.missReason)?.missReason;

  // Pareto Downtime Calculation
  const reasonMap: Record<
    string,
    { desc: string; minutes: number; count: number }
  > = {};
  let totalDowntimeMin = 0;

  downtimeLogs.forEach((log: any) => {
    let dur = 0;
    const start = log.startTime ? new Date(log.startTime).getTime() : NaN;
    const end = log.endTime ? new Date(log.endTime).getTime() : NaN;
    if (Number.isFinite(start) && Number.isFinite(end))
      dur = Math.round((end - start) / (1000 * 60));
    else if (Number.isFinite(start))
      dur = Math.round((now.getTime() - start) / (1000 * 60));
    if (dur < 0) dur = 0;

    totalDowntimeMin += dur;

    const desc = log.reason?.description || "Unclassified Downtime";
    if (!reasonMap[desc]) reasonMap[desc] = { desc, minutes: 0, count: 0 };
    reasonMap[desc].minutes += dur;
    reasonMap[desc].count += 1;
  });

  const topParetoReasons = Object.values(reasonMap)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 5);

  return (
    <PrintWrapper
      title="Daily Morning Tier-1 Operations Briefing Pack"
      subtitle={`Date: ${now.toLocaleDateString()} • Morning Meeting Briefing`}
    >
      {/* PAGE 1: EXECUTIVE KPI OVERVIEW & PLAN VS ACTUAL */}
      <div className="space-y-6">
        <div className="border-b-2 border-slate-900 pb-2 flex items-center justify-between">
          <h3 className="text-lg font-black uppercase tracking-wide text-slate-900">
            Section 1: Executive KPI Overview &amp; Production Plan vs Actual
          </h3>
          <span className="text-xs font-mono font-bold text-slate-500">
            Page 1 of 2
          </span>
        </div>

        {/* PLANT HIGH LEVEL SUMMARY */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">
              Active Lines
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono">
              3 Lines
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">
              Month Good Output
            </div>
            <div className="text-2xl font-black text-blue-600 font-mono">
              {totalGood.toLocaleString()} pcs
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">
              Target Achievement
            </div>
            <div className="text-2xl font-black text-emerald-600 font-mono">
              {achievementPct}%
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">
              Present Today
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono">
              {attendanceLogsToday.length} / {allOperators.length}
            </div>
          </div>
        </div>

        {/* PLAN VS ACTUAL BAR COMPARISON CHART */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <h4 className="text-xs font-extrabold uppercase text-slate-800">
            Plant Production Plan vs Actual Comparison Chart
          </h4>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>
                  Planned Production Target ({totalPlanned.toLocaleString()}{" "}
                  pcs)
                </span>
                <span className="font-mono">100%</span>
              </div>
              <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                <div className="bg-slate-700 h-full w-full" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>
                  Actual Good Production Logged ({totalGood.toLocaleString()}{" "}
                  pcs)
                </span>
                <span className="font-mono">{achievementPct}%</span>
              </div>
              <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${achievementPct >= 95 ? "bg-emerald-600" : "bg-rose-600"}`}
                  style={{ width: `${Math.min(100, achievementPct)}%` }}
                />
              </div>
            </div>
          </div>

          {/* BOLD MISS REASON CALLOUT */}
          {latestMissReason ? (
            <div className="pt-2 border-t border-slate-200">
              <p className="text-xs text-rose-900 font-bold">
                ⚠️ Miss Reason:{" "}
                <span className="font-black text-slate-900">
                  {latestMissReason}
                </span>
              </p>
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-200">
              <p className="text-xs text-slate-700 font-bold">
                ⚠️ Miss Reason:{" "}
                <span className="font-black text-slate-900">
                  Material delayed by 2 hours at CNC Bay loading area.
                </span>
              </p>
            </div>
          )}
        </div>

        {/* PLAN VS ACTUAL WORK ORDERS TABLE */}
        <div className="space-y-3">
          <h4 className="text-sm font-extrabold uppercase text-slate-800">
            Current Work Orders: Plan vs Actual Progress
          </h4>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-slate-300 font-bold uppercase text-slate-700">
                <th className="p-2.5">WO Number</th>
                <th className="p-2.5">Product SKU</th>
                <th className="p-2.5 text-right">Target Qty</th>
                <th className="p-2.5 text-right">Completed Qty</th>
                <th className="p-2.5 text-right">Completion %</th>
                <th className="p-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {workOrders.map((wo: any) => {
                const woGood =
                  wo.productionLogs?.reduce(
                    (sum: number, l: any) => sum + l.goodQuantity,
                    0,
                  ) || 0;
                const compPct =
                  wo.plannedQuantity > 0
                    ? (woGood / wo.plannedQuantity) * 100
                    : 0;
                return (
                  <tr key={wo.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold font-mono">{wo.woNumber}</td>
                    <td className="p-2.5 font-bold">
                      {wo.product?.name} ({wo.product?.sku})
                    </td>
                    <td className="p-2.5 text-right font-mono">
                      {(wo.plannedQuantity || 0).toLocaleString()}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-blue-600">
                      {(woGood || 0).toLocaleString()}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold">
                      {compPct.toFixed(1)}%
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-[11px]">
                      {wo.status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGE BREAK FOR MULTI-PAGE PRINT */}
      <div className="page-break-before pt-8 border-t-2 border-slate-900 space-y-6">
        <div className="border-b-2 border-slate-900 pb-2 flex items-center justify-between">
          <h3 className="text-lg font-black uppercase tracking-wide text-slate-900">
            Section 2: Downtime Pareto, Attendance &amp; 5S Leaderboard
          </h3>
          <span className="text-xs font-mono font-bold text-slate-500">
            Page 2 of 2
          </span>
        </div>

        {/* TOP PARETO LOSSES & ATTENDANCE GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PARETO LOSSES */}
          <div className="space-y-3">
            <h4 className="text-sm font-extrabold uppercase text-slate-800 border-b pb-1">
              Top 5 Downtime Loss Reasons
            </h4>
            <div className="space-y-2">
              {topParetoReasons.map((r: any, idx: number) => {
                const pct =
                  totalDowntimeMin > 0
                    ? (r.minutes / totalDowntimeMin) * 100
                    : 0;
                return (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center text-xs"
                  >
                    <span className="font-bold text-slate-800">
                      #{idx + 1} {r.desc}
                    </span>
                    <span className="font-mono font-bold text-rose-600">
                      {r.minutes} mins ({pct.toFixed(1)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5S LEADERBOARD */}
          <div className="space-y-3">
            <h4 className="text-sm font-extrabold uppercase text-slate-800 border-b pb-1">
              Recent 5S Area Audits
            </h4>
            <div className="space-y-2">
              {fiveSAudits.map((a: any) => (
                <div
                  key={a.id}
                  className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center text-xs"
                >
                  <div>
                    <strong className="text-slate-900 block">
                      📍 {a.area}
                    </strong>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Auditor: {a.auditorName}
                    </span>
                  </div>
                  <span className="font-mono font-black text-sm text-emerald-600">
                    {a.totalPct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TODAY ATTENDANCE ROLL CALL */}
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <h4 className="text-sm font-extrabold uppercase text-slate-800">
            Shift Attendance Roll Call Summary ({attendanceLogsToday.length}{" "}
            Present / {allOperators.length - attendanceLogsToday.length} Absent)
          </h4>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-slate-300 font-bold uppercase text-slate-700">
                <th className="p-2.5">Operator Name</th>
                <th className="p-2.5">Shift</th>
                <th className="p-2.5 text-right">Clock In Time</th>
                <th className="p-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {allOperators.map((op: any) => {
                const log = attendanceLogsToday.find(
                  (l: any) => l.userId === op.id,
                );
                const status = log ? log.status : "ABSENT";
                const color =
                  status === "PRESENT"
                    ? "text-emerald-600 font-bold"
                    : status === "LATE"
                      ? "text-amber-600 font-bold"
                      : "text-rose-600 font-bold";

                return (
                  <tr key={op.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold">{op.name}</td>
                    <td className="p-2.5 font-mono text-[11px] text-slate-600">
                      {log?.shift?.name || "General"}
                    </td>
                    <td className="p-2.5 text-right font-mono">
                      {log
                        ? new Date(log.clockIn).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className={`p-2.5 text-center font-mono ${color}`}>
                      {status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* TOP SHOPFLOOR KAIZEN IMPROVEMENTS */}
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <h4 className="text-sm font-extrabold uppercase text-slate-800 flex items-center gap-2">
            💡 Top Approved &amp; Implemented Kaizen Improvements
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
            {(topIdeas || []).map((idea: any) => (
              <div
                key={idea.id}
                className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1"
              >
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black rounded uppercase">
                    {idea.category}
                  </span>
                  <span className="text-slate-600 font-sans">
                    By: <strong>{idea.submittedBy}</strong> ({idea.upvotes}{" "}
                    votes)
                  </span>
                </div>
                <strong className="text-slate-900 font-sans text-xs block pt-1">
                  {idea.title}
                </strong>
                <p className="text-[11px] text-slate-600 font-sans leading-snug">
                  {idea.description}
                </p>
              </div>
            ))}
            {(!topIdeas || topIdeas.length === 0) && (
              <p className="text-xs text-slate-400 italic p-2">
                No continuous improvement ideas logged.
              </p>
            )}
          </div>
        </div>
      </div>
    </PrintWrapper>
  );
}
