import { prisma } from "@/lib/prisma";
import PrintWrapper from "@/app/components/print/PrintWrapper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function OperatorEfficiencyPage({
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

  const operators = await prisma.user.findMany({
    where: { role: { name: "Operator" } },
  });

  const productionLogs = await prisma.productionLog.findMany({
    take: 100,
    where: { startTime: { gte: start, lte: end } },
    include: { workOrder: { include: { product: true } }, machine: true },
  });

  const stats = operators.map((op) => {
    const userLogs = productionLogs.filter((l) => l.operatorId === op.id);

    let totalGood = 0;
    let totalScrap = 0;
    let standardEarnedSeconds = 0;
    let loggedMinutes = 0;

    userLogs.forEach((l) => {
      totalGood += l.goodQuantity;
      totalScrap += l.scrapQuantity;

      const cycleSec =
        l.workOrder?.product?.targetCycleTimeSeconds ||
        l.machine?.idealCycleTimeSeconds ||
        60;
      standardEarnedSeconds += l.goodQuantity * cycleSec;

      if (l.endTime) {
        loggedMinutes += Math.max(
          0,
          (l.endTime.getTime() - l.startTime.getTime()) / (1000 * 60),
        );
      } else {
        loggedMinutes += 60;
      }
    });

    const hoursLogged = loggedMinutes / 60;
    const totalQty = totalGood + totalScrap;
    const scrapPct = totalQty > 0 ? (totalScrap / totalQty) * 100 : 0;

    const loggedSeconds = Math.max(1, loggedMinutes * 60);
    const efficiencyPct = Math.min(
      150,
      (standardEarnedSeconds / loggedSeconds) * 100,
    );

    const rating =
      efficiencyPct >= 95
        ? "Master Operator (A+)"
        : efficiencyPct >= 85
          ? "Proficient (A)"
          : efficiencyPct >= 70
            ? "Developing (B)"
            : "Needs Support (C)";

    return {
      operator: op,
      totalGood,
      totalScrap,
      totalQty,
      scrapPct,
      hoursLogged,
      efficiencyPct,
      rating,
    };
  });

  return (
    <PrintWrapper
      title="Operator Efficiency & Skill Register"
      subtitle={`Period: ${start.toLocaleDateString()} — ${end.toLocaleDateString()}`}
    >
      <div className="space-y-3">
        <h3 className="text-base font-extrabold uppercase tracking-wide text-slate-900 border-b pb-2">
          Operator Performance Summary
        </h3>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-300 font-bold uppercase text-slate-700">
              <th className="p-2.5">Operator Name</th>
              <th className="p-2.5">User Handle</th>
              <th className="p-2.5 text-right">Hours Logged</th>
              <th className="p-2.5 text-right">Good Quantity</th>
              <th className="p-2.5 text-right">Scrap Quantity</th>
              <th className="p-2.5 text-right">Scrap %</th>
              <th className="p-2.5 text-right">Efficiency %</th>
              <th className="p-2.5 text-center">Skill Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {stats.map((s) => (
              <tr key={s.operator.id} className="hover:bg-slate-50">
                <td className="p-2.5 font-bold">{s.operator.name}</td>
                <td className="p-2.5 font-mono text-[11px] text-slate-600">
                  @{s.operator.username || s.operator.id.slice(-6)}
                </td>
                <td className="p-2.5 text-right font-mono">
                  {s.hoursLogged.toFixed(1)} hrs
                </td>
                <td className="p-2.5 text-right font-mono font-bold">
                  {s.totalGood.toLocaleString()}
                </td>
                <td className="p-2.5 text-right font-mono text-rose-600">
                  {s.totalScrap.toLocaleString()}
                </td>
                <td className="p-2.5 text-right font-mono">
                  {s.scrapPct.toFixed(1)}%
                </td>
                <td className="p-2.5 text-right font-mono font-black text-sm text-blue-600">
                  {s.efficiencyPct.toFixed(1)}%
                </td>
                <td className="p-2.5 text-center font-mono font-bold text-[11px]">
                  {s.rating}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PrintWrapper>
  );
}
