import { prisma } from "@/lib/prisma";
import { Timer } from "lucide-react";

const fmt = (v: number) => Number(v || 0).toFixed(1);

export default async function WorkOrderStandardTimeCard({ wo }: { wo: any }) {
  const sku = wo?.product?.sku || null;

  const [studies, logs] = await Promise.all([
    prisma.timeStudy.findMany({
      where: sku ? { productSku: sku } : { productSku: null },
      orderBy: { operationName: "asc" },
    }),
    prisma.productionLog.findMany({
      where: { workOrderId: wo.id, endTime: { not: null } },
      select: { startTime: true, endTime: true, goodQuantity: true },
    }),
  ]);

  const standardTotal = studies.reduce(
    (s, t) => s + (t.standardTimeMin || 0),
    0,
  );
  const actualMin = logs.reduce((s, l) => {
    const mins =
      (new Date(l.endTime!).getTime() - new Date(l.startTime).getTime()) /
      60000;
    return s + (mins > 0 ? mins : 0);
  }, 0);
  const actualPerUnit =
    actualMin > 0 && logs.reduce((s, l) => s + (l.goodQuantity || 0), 0) > 0
      ? actualMin / logs.reduce((s, l) => s + (l.goodQuantity || 0), 0)
      : null;

  const efficiency =
    standardTotal > 0 && actualMin > 0
      ? (standardTotal / actualMin) * 100
      : null;

  return (
    <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-100 dark:bg-violet-950/60 text-violet-400 rounded-xl">
            <Timer className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Standard vs Actual Time
            </h2>
            <p className="text-xs text-slate-400">
              {sku
                ? `Product ${sku} — SAM rollup vs shop-floor run time`
                : "No product SKU on this work order"}
            </p>
          </div>
        </div>
        {efficiency !== null && (
          <span
            className={`px-3 py-1.5 rounded-full text-sm font-black border ${
              efficiency >= 100
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : efficiency >= 80
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/30"
            }`}
          >
            Efficiency {fmt(efficiency)}%
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-slate-600">
          <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">
            Standard SAM
          </div>
          <div className="text-xl font-black font-mono text-white">
            {fmt(standardTotal)}{" "}
            <span className="text-xs font-sans font-semibold text-slate-400">
              min
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            {studies.length} operation(s)
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-600">
          <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">
            Actual Run Time
          </div>
          <div className="text-xl font-black font-mono text-white">
            {fmt(actualMin)}{" "}
            <span className="text-xs font-sans font-semibold text-slate-400">
              min
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            {logs.length} production log(s)
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-600">
          <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">
            Actual / unit
          </div>
          <div className="text-xl font-black font-mono text-white">
            {actualPerUnit != null ? fmt(actualPerUnit) : "—"}{" "}
            <span className="text-xs font-sans font-semibold text-slate-400">
              min
            </span>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-600">
          <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">
            Variance
          </div>
          <div
            className={`text-xl font-black font-mono ${efficiency !== null && efficiency < 100 ? "text-rose-500" : "text-emerald-400"}`}
          >
            {efficiency !== null
              ? `${efficiency >= 100 ? "+" : ""}${fmt(efficiency - 100)}%`
              : "—"}
          </div>
        </div>
      </div>

      {studies.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-800/60 border-b border-slate-700">
              <tr>
                {[
                  "Operation",
                  "Dept",
                  "Standard (min)",
                  "Measured (min)",
                  "Sample",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 font-semibold text-slate-200"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 divide-slate-800">
              {studies.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2.5 font-medium text-white">
                    {t.operationName}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">
                    {t.department || "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-right">
                    {fmt(t.standardTimeMin)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-right">
                    {t.measuredTimeMin != null ? fmt(t.measuredTimeMin) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">
                    {t.sampleSize || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {studies.length === 0 && (
        <p className="text-xs text-slate-400 italic">
          No time studies recorded for this product yet — add them in Time
          Study to unlock the rollup.
        </p>
      )}
    </section>
  );
}
