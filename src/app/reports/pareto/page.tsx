import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintWrapper from "@/app/components/print/PrintWrapper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ParetoReportPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string }>;
}) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "ops.view") && !can(user, "reports.print")) {
    redirect("/");
  }

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
    include: { reason: true },
  });

  const reasonMap: Record<
    string,
    { desc: string; category: string; minutes: number; count: number }
  > = {};
  let totalDowntimeMin = 0;

  downtimeLogs.forEach((log) => {
    let dur = 0;
    if (log.endTime)
      dur = Math.round(
        (log.endTime.getTime() - log.startTime.getTime()) / (1000 * 60),
      );
    else
      dur = Math.round(
        ((log.startTime > end ? end : new Date()).getTime() -
          log.startTime.getTime()) /
          (1000 * 60),
      );
    if (dur < 0) dur = 0;

    totalDowntimeMin += dur;

    const desc = log.reason?.description || "Unclassified Downtime";
    const cat = log.reason?.category || "UNCLASSIFIED";

    if (!reasonMap[desc])
      reasonMap[desc] = { desc, category: cat, minutes: 0, count: 0 };
    reasonMap[desc].minutes += dur;
    reasonMap[desc].count += 1;
  });

  const sortedReasons = Object.values(reasonMap).sort(
    (a, b) => b.minutes - a.minutes,
  );

  let cumulativeMin = 0;
  const paretoData = sortedReasons.map((item) => {
    cumulativeMin += item.minutes;
    const itemPct =
      totalDowntimeMin > 0 ? (item.minutes / totalDowntimeMin) * 100 : 0;
    const cumPct =
      totalDowntimeMin > 0 ? (cumulativeMin / totalDowntimeMin) * 100 : 0;

    return {
      ...item,
      itemPct,
      cumPct,
    };
  });

  const topLossLimit = paretoData.filter((p) => p.cumPct <= 80).length || 1;

  return (
    <PrintWrapper
      title="Downtime Pareto Analysis Report"
      subtitle={`Period: ${start.toLocaleDateString()} — ${end.toLocaleDateString()}`}
      landscape={true}
    >
      {/* PARETO HIGHLIGHT */}
      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-800">
        <div>
          <strong className="text-amber-900 uppercase">
            80/20 Pareto Focus Rule:
          </strong>{" "}
          Top {topLossLimit} downtime reasons account for 80% of all factory
          production losses.
        </div>
        <div className="font-mono font-bold text-rose-600 text-sm">
          Total Loss: {totalDowntimeMin.toLocaleString()} mins
        </div>
      </div>

      {/* VISUAL PARETO BARS */}
      <div className="space-y-2 border p-4 rounded-xl bg-slate-50">
        <h4 className="text-xs font-extrabold uppercase text-slate-700 mb-3">
          Loss Magnitude Comparison
        </h4>
        {paretoData.slice(0, 8).map((p, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex justify-between text-xs font-bold">
              <span>
                #{idx + 1} {p.desc}
              </span>
              <span className="font-mono">
                {p.minutes} mins ({p.itemPct.toFixed(1)}% | Cum:{" "}
                {p.cumPct.toFixed(1)}%)
              </span>
            </div>
            <div className="h-4 bg-slate-200 rounded-full overflow-hidden flex">
              <div
                className="bg-rose-500 h-full transition-all"
                style={{ width: `${Math.min(100, p.itemPct)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* PARETO TABLE */}
      <div className="space-y-3 pt-4">
        <h3 className="text-base font-extrabold uppercase tracking-wide text-slate-900 border-b pb-2">
          Cumulative Downtime Pareto Table
        </h3>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-300 font-bold uppercase text-slate-700">
              <th className="p-2.5">Rank</th>
              <th className="p-2.5">Downtime Reason</th>
              <th className="p-2.5">Category</th>
              <th className="p-2.5 text-right">Occurrences</th>
              <th className="p-2.5 text-right">Duration (Mins)</th>
              <th className="p-2.5 text-right">% Contribution</th>
              <th className="p-2.5 text-right">Cumulative %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {paretoData.map((p, idx) => (
              <tr
                key={idx}
                className={
                  p.cumPct <= 80
                    ? "bg-amber-50/50 hover:bg-amber-100/50"
                    : "hover:bg-slate-50"
                }
              >
                <td className="p-2.5 font-bold font-mono">#{idx + 1}</td>
                <td className="p-2.5 font-bold">{p.desc}</td>
                <td className="p-2.5 font-mono text-[11px] text-slate-600">
                  {p.category}
                </td>
                <td className="p-2.5 text-right font-mono">{p.count}</td>
                <td className="p-2.5 text-right font-mono font-bold text-rose-600">
                  {p.minutes} mins
                </td>
                <td className="p-2.5 text-right font-mono">
                  {p.itemPct.toFixed(1)}%
                </td>
                <td className="p-2.5 text-right font-mono font-black">
                  {p.cumPct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PrintWrapper>
  );
}
