import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintWrapper from "@/app/components/print/PrintWrapper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function LeaderboardReportPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "people.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const operators = await prisma.user.findMany({
    where: { role: { name: "Operator" } },
  });

  const logs = await prisma.productionLog.findMany({
    take: 100,
    where: { startTime: { gte: monthStart } },
    include: { workOrder: { include: { product: true } } },
  });

  const rankings = operators
    .map((op) => {
      const userLogs = logs.filter((l) => l.operatorId === op.id);
      let goodQty = 0;
      let scrapQty = 0;
      let points = 0;

      userLogs.forEach((l) => {
        goodQty += l.goodQuantity;
        scrapQty += l.scrapQuantity;
        points += l.goodQuantity * 10 - l.scrapQuantity * 15;
      });

      const totalQty = goodQty + scrapQty;
      const scrapPct = totalQty > 0 ? (scrapQty / totalQty) * 100 : 0;

      return {
        operator: op,
        goodQty,
        scrapQty,
        scrapPct,
        points: Math.max(0, points),
      };
    })
    .sort((a, b) => b.points - a.points)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  return (
    <PrintWrapper
      title="Monthly Operator Leaderboard & Recognition"
      subtitle={`Month: ${now.toLocaleString("default", { month: "long", year: "numeric" })}`}
    >
      {/* TOP 3 MEDAL PODIUM */}
      <div className="grid grid-cols-3 gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center">
        {rankings.slice(0, 3).map((r) => {
          const medal =
            r.rank === 1
              ? "🥇 1st Place Champion"
              : r.rank === 2
                ? "🥈 2nd Place Runner-Up"
                : "🥉 3rd Place Honorable";
          return (
            <div
              key={r.operator.id}
              className="space-y-1 p-3 bg-slate-800/60 rounded-xl border border-slate-700 shadow-sm"
            >
              <div className="text-xl font-bold">{medal}</div>
              <div className="text-lg font-black text-slate-900">
                {r.operator.name}
              </div>
              <div className="text-xs font-mono font-black text-blue-600">
                {r.points.toLocaleString()} Points
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Good: {r.goodQty.toLocaleString()} pcs
              </div>
            </div>
          );
        })}
      </div>

      {/* FULL LEADERBOARD TABLE */}
      <div className="space-y-3">
        <h3 className="text-base font-extrabold uppercase tracking-wide text-slate-900 border-b pb-2">
          Full Operator Gamification Standings
        </h3>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-300 font-bold uppercase text-slate-700">
              <th className="p-2.5 w-16 text-center">Rank</th>
              <th className="p-2.5">Operator Name</th>
              <th className="p-2.5">User Handle</th>
              <th className="p-2.5 text-right">Good Production</th>
              <th className="p-2.5 text-right">Scrap Units</th>
              <th className="p-2.5 text-right">Scrap Rate %</th>
              <th className="p-2.5 text-right">Gamification Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rankings.map((r) => (
              <tr
                key={r.operator.id}
                className={
                  r.rank <= 3
                    ? "bg-amber-50/50 font-bold hover:bg-amber-100/50"
                    : "hover:bg-slate-50"
                }
              >
                <td className="p-2.5 text-center font-mono font-bold">
                  #{r.rank}
                </td>
                <td className="p-2.5 font-bold">{r.operator.name}</td>
                <td className="p-2.5 font-mono text-[11px] text-slate-600">
                  @{r.operator.username || r.operator.id.slice(-6)}
                </td>
                <td className="p-2.5 text-right font-mono font-bold">
                  {r.goodQty.toLocaleString()}
                </td>
                <td className="p-2.5 text-right font-mono text-rose-600">
                  {r.scrapQty.toLocaleString()}
                </td>
                <td className="p-2.5 text-right font-mono">
                  {r.scrapPct.toFixed(1)}%
                </td>
                <td className="p-2.5 text-right font-mono font-black text-sm text-blue-600">
                  {r.points.toLocaleString()} pts
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PrintWrapper>
  );
}
