import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  TrendingUp,
  IndianRupee,
  PackageSearch,
  ArrowUpRight,
  ArrowDownRight,
  BrainCircuit,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const fmt = (v: number) =>
  Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 1 });

export default async function ProcurementIntelligencePage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "supply.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const now = new Date();

  const [scorecards, suppliers, spareParts, pos] = await Promise.all([
    prisma.supplierScorecard.findMany({
      orderBy: [{ supplierName: "asc" }, { period: "asc" }],
    }),
    prisma.supplier.findMany({
      include: {
        purchaseOrders: {
          include: { rawMaterial: { select: { name: true, sku: true } } },
        },
        payments: { select: { amount: true } },
      },
    }),
    prisma.sparePart.findMany({ orderBy: { name: "asc" } }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ["ORDERED", "PARTIAL"] } },
      include: {
        supplier: { select: { name: true } },
        rawMaterial: { select: { name: true, sku: true } },
      },
      orderBy: { expectedDate: "asc" },
    }),
  ]);

  // ---- Scorecard trends per supplier across periods ----
  const periods = Array.from(new Set(scorecards.map((s) => s.period))).sort();
  const bySupplier: Record<string, { period: string; overall: number }[]> = {};
  scorecards.forEach((s) => {
    (bySupplier[s.supplierName] = bySupplier[s.supplierName] || []).push({
      period: s.period,
      overall: s.overallScore,
    });
  });

  // ---- Spend analysis ----
  const spendRows = suppliers
    .map((sup) => {
      const purchased = sup.purchaseOrders.reduce(
        (sum, po) =>
          sum +
          (po.status === "RECEIVED"
            ? po.receivedQty * po.unitCost
            : po.qty * po.unitCost),
        0,
      );
      const paid = sup.payments.reduce((sum, p) => sum + p.amount, 0);
      return {
        name: sup.name,
        purchased,
        paid,
        poCount: sup.purchaseOrders.length,
      };
    })
    .filter((r) => r.purchased > 0)
    .sort((a, b) => b.purchased - a.purchased);
  const totalSpend = spendRows.reduce((s, r) => s + r.purchased, 0);
  const maxSpend = spendRows[0]?.purchased || 1;

  // ---- Below-min spares merged with open POs ----
  const belowMin = spareParts.filter((s) => s.currentQty <= s.minQty);
  const openPos = pos.filter(
    (p) => p.status === "ORDERED" || p.status === "PARTIAL",
  );
  const posBySupplier = openPos.reduce<Record<string, typeof openPos>>(
    (acc, po) => {
      const key = (po.supplier?.name || "").toLowerCase();
      (acc[key] = acc[key] || []).push(po);
      return acc;
    },
    {},
  );

  // Same weighted formula as the scorecard API â€” recompute so stored snapshots
  // (e.g. legacy rows with 0 scores) display the correct trend.
  const scoreOf = (d: any) => {
    const otd = Math.min(100, Math.max(0, Number(d.onTimeDelivery) || 0));
    const ppm = Math.min(
      100,
      Math.max(0, 100 - (Number(d.qualityPpm) || 0) / 1000),
    );
    const cost = Math.min(
      100,
      Math.max(0, 100 - Math.abs(Number(d.costVariance) || 0)),
    );
    const resp = Math.min(5, Math.max(1, Number(d.responsiveness) || 3)) * 20;
    return (
      Math.round((0.35 * otd + 0.35 * ppm + 0.15 * cost + 0.15 * resp) * 10) /
      10
    );
  };
  scorecards.forEach((s) => {
    s.overallScore = scoreOf(s);
  });

  const gradeCls = (g: string) =>
    g === "A"
      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
      : g === "B"
        ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
        : g === "C"
          ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
          : "bg-rose-500/10 text-rose-400 border border-rose-500/30";
  const gradeOf = (o: number) =>
    o >= 90 ? "A" : o >= 75 ? "B" : o >= 60 ? "C" : "D";

  const sectionTitle = (
    icon: any,
    title: string,
    desc: string,
    accent: string,
  ) => (
    <div className="flex items-center gap-3">
      <div className={`p-2.5 rounded-xl border ${accent}`}>{icon}</div>
      <div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="text-xs text-slate-400">{desc}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl border bg-blue-500/10 text-blue-400 border-blue-500/30">
          <BrainCircuit className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">
            Procurement Intelligence
          </h1>
          <p className="text-sm text-slate-400">
            Supplier scorecard trends, spend analysis and reorder visibility â€”
            the SQA and buyer briefing.
          </p>
        </div>
      </div>

      {/* TRENDS */}
      <section className="bg-slate-800/60 rounded-2xl border border-slate-700 p-6 shadow-sm space-y-5">
        {sectionTitle(
          <TrendingUp className="w-6 h-6 text-blue-400" />,
          "Supplier Scorecard Trends",
          "Weighted overall score per supplier across quarters",
          "bg-blue-500/10 text-blue-400 border-blue-500/30",
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-slate-800/60 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-200">
                  Supplier
                </th>
                {periods.map((p) => (
                  <th
                    key={p}
                    className="px-4 py-3 text-right font-semibold text-slate-200"
                  >
                    {p}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-semibold text-slate-200">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 divide-slate-800">
              {Object.keys(bySupplier).length === 0 && (
                <tr>
                  <td
                    colSpan={periods.length + 2}
                    className="px-4 py-8 text-center text-slate-400 italic"
                  >
                    No scorecards yet.
                  </td>
                </tr>
              )}
              {Object.entries(bySupplier).map(([name, rows]) => {
                const sorted = [...rows].sort((a, b) =>
                  a.period.localeCompare(b.period),
                );
                const last = sorted[sorted.length - 1]?.overall;
                const prev = sorted[sorted.length - 2]?.overall;
                const up = prev !== undefined ? last - prev : 0;
                return (
                  <tr
                    key={name}
                    className="hover:bg-slate-800/90/20 transition-colors"
                  >
                    <td className="px-4 py-3 font-bold text-white">{name}</td>
                    {periods.map((p) => {
                      const r = sorted.find((x) => x.period === p);
                      return (
                        <td key={p} className="px-4 py-3 text-right">
                          {r ? (
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${gradeCls(gradeOf(r.overall))}`}
                            >
                              {r.overall.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-slate-600">â€”</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right">
                      {up !== 0 ? (
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold ${up > 0 ? "text-emerald-500" : "text-rose-500"}`}
                        >
                          {up > 0 ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          )}
                          {Math.abs(up).toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-slate-600">â€”</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* SPEND */}
      <section className="bg-slate-800/60 rounded-2xl border border-slate-700 p-6 shadow-sm space-y-5">
        {sectionTitle(
          <IndianRupee className="w-6 h-6 text-emerald-400" />,
          "Supplier Spend Analysis",
          `Total committed spend â‚¹ ${fmt(totalSpend)} across ${spendRows.length} suppliers`,
          "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        )}
        <div className="space-y-3">
          {spendRows.length === 0 && (
            <p className="text-slate-400 italic text-sm">
              No purchase activity yet.
            </p>
          )}
          {spendRows.map((r) => (
            <div key={r.name}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold text-white">{r.name}</span>
                <span className="font-mono text-slate-600 text-slate-300">
                  â‚¹ {fmt(r.purchased)} Â· paid â‚¹ {fmt(r.paid)} Â·{" "}
                  {r.poCount} PO(s)
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-800/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${(r.purchased / maxSpend) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SPARES vs OPEN POs */}
      <section className="bg-slate-800/60 rounded-2xl border border-slate-700 p-6 shadow-sm space-y-5">
        {sectionTitle(
          <PackageSearch className="w-6 h-6 text-amber-400" />,
          "Below-Min Spares vs Open Purchase Orders",
          "Reorder candidates and the open POs that may cover them (matched by supplier)",
          "bg-amber-500/10 text-amber-400 border-amber-500/30",
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-rose-500 mb-3">
              Below-Min Spares ({belowMin.length})
            </h3>
            <div className="space-y-2">
              {belowMin.length === 0 && (
                <p className="text-slate-400 italic text-sm">
                  All spares above minimum.
                </p>
              )}
              {belowMin.map((s) => {
                const hasOpenPo =
                  s.supplierName && posBySupplier[s.supplierName.toLowerCase()];
                return (
                  <div
                    key={s.id}
                    className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-3 ${hasOpenPo ? "border-emerald-300/50 bg-emerald-50/40 dark:bg-emerald-950/20" : "border-rose-200 dark:border-rose-800/60 bg-rose-50/40 dark:bg-rose-950/10"}`}
                  >
                    <div>
                      <div className="font-semibold text-white text-sm">
                        {s.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {s.sku} Â· {s.machineCode || "â€”"} Â·{" "}
                        {s.supplierName || "no supplier"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-rose-400 text-sm">
                        {s.currentQty} / {s.minQty}
                      </div>
                      <div
                        className={`text-[10px] font-bold ${hasOpenPo ? "text-emerald-400" : "text-rose-500"}`}
                      >
                        {hasOpenPo ? "Open PO exists" : "No open PO"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-blue-500 mb-3">
              Open Purchase Orders ({openPos.length})
            </h3>
            <div className="space-y-2">
              {openPos.length === 0 && (
                <p className="text-slate-400 italic text-sm">No open POs.</p>
              )}
              {openPos.map((po) => (
                <div
                  key={po.id}
                  className="rounded-xl border border-slate-600 px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-semibold text-white text-sm font-mono">
                      {po.poNumber} Â·{" "}
                      {po.rawMaterial?.name || po.rawMaterial?.sku}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {po.supplier?.name} Â· {po.status}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm text-slate-300">
                      {po.qty} Ã— â‚¹{fmt(po.unitCost)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {po.expectedDate
                        ? `Due ${new Date(po.expectedDate).toLocaleDateString()}`
                        : "No ETA"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <p className="text-[10px] text-slate-400">
        Generated {now.toLocaleString()} Â· Procurement Intelligence Â·
        Manufacturing MAX
      </p>
    </div>
  );
}
