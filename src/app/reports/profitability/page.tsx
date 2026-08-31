import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, DollarSign } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  calculateWorkOrderCost,
  WorkOrderCostBreakdown,
} from "@/lib/costingEngine";
import PrintButton from "@/app/components/print/PrintButton";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const revalidate = 0;

export default async function JobProfitabilityReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "finance.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const params = await searchParams;
  const { from, to } = params;

  // Build date filter
  const where: any = {};
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  // Fetch Work Orders with relations
  const workOrders = await prisma.workOrder.findMany({
    where,
    include: {
      product: true,
      productionLogs: true,
      scrapQuarantines: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate job costing for each work order
  const costingList: WorkOrderCostBreakdown[] = await Promise.all(
    workOrders.map((wo) => calculateWorkOrderCost(wo)),
  );

  // Sort by Margin % (loss-making work orders highlighted at top or sorted logically)
  const sortedCosting = [...costingList].sort(
    (a, b) => a.marginPercentage - b.marginPercentage,
  );

  // Aggregate Totals
  const totalRevenue = costingList.reduce((sum, item) => sum + item.revenue, 0);
  const totalCost = costingList.reduce((sum, item) => sum + item.totalCost, 0);
  const netProfit = totalRevenue - totalCost;
  const overallMarginPct =
    totalRevenue > 0
      ? Number(((netProfit / totalRevenue) * 100).toFixed(1))
      : 0;

  const profitableCount = costingList.filter(
    (item) => !item.isLossMaker,
  ).length;
  const lossCount = costingList.filter((item) => item.isLossMaker).length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* NAV HEADER (Hidden on Print) */}
        <div className="flex items-center justify-between gap-4 print:hidden">
          <Link
            href="/reports"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-200 bg-slate-800/60 border border-slate-700 rounded-xl hover:bg-slate-800/90 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Reports Hub
          </Link>
          <PrintButton />
        </div>

        {/* PRINTABLE REPORT CONTAINER */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 print:border-none print:shadow-none print:p-0">
          {/* REPORT HEADER */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-100 dark:bg-emerald-950 text-emerald-400 rounded-lg">
                  <DollarSign className="w-6 h-6" />
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Job Costing &amp; Profitability Report
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Executive Work Order profitability breakdown, financial margin
                analysis, and loss monitoring register.
              </p>
            </div>

            <div className="text-right text-xs text-slate-400 font-mono">
              <p className="font-bold text-white">
                Manufacturing MAX Enterprise MES
              </p>
              <p>
                Generated:{" "}
                {new Date().toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              {from && to && (
                <p className="text-blue-500 font-bold">
                  Range: {from} to {to}
                </p>
              )}
            </div>
          </div>

          {/* FINANCIAL SUMMARY KPI CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Revenue
              </span>
              <p className="text-2xl font-black text-white font-mono">
                â‚¹{totalRevenue.toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400">
                Total Billed & Quoted
              </p>
            </div>

            <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Factory Cost
              </span>
              <p className="text-2xl font-black text-white font-mono">
                â‚¹{totalCost.toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400">
                Mat + Lab + Mac + Scrap
              </p>
            </div>

            <div
              className={`p-4 border rounded-xl space-y-1 ${
                netProfit < 0
                  ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900"
                  : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900"
              }`}
            >
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Net Operating Profit
              </span>
              <p
                className={`text-2xl font-black font-mono ${netProfit < 0 ? "text-rose-400" : "text-emerald-400"}`}
              >
                â‚¹{netProfit.toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400">
                Overall Margin: {overallMarginPct}%
              </p>
            </div>

            <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Job Performance
              </span>
              <div className="flex items-center gap-2 pt-1 font-mono text-sm font-bold">
                <span className="text-emerald-400">
                  {profitableCount} Profitable
                </span>
                <span>/</span>
                <span className="text-rose-400">{lossCount} Loss</span>
              </div>
              <p className="text-[10px] text-slate-400">
                {lossCount > 0
                  ? `âš ï¸ ${lossCount} Loss-making job(s) flagged`
                  : "All jobs profitable"}
              </p>
            </div>
          </div>

          {/* PROFITABILITY REGISTER TABLE */}
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span>Work Order Profitability Breakdown</span>
              <span className="text-xs text-slate-400 font-normal">
                Sorted by Net Margin %
              </span>
            </h3>

            <div className="overflow-x-auto border border-slate-700 rounded-xl">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-slate-800/60 text-slate-400 border-b border-slate-700 uppercase font-bold">
                    <th className="p-3">WO #</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Product</th>
                    <th className="p-3 text-right">Good Qty</th>
                    <th className="p-3 text-right">Revenue (â‚¹)</th>
                    <th className="p-3 text-right">Total Cost (â‚¹)</th>
                    <th className="p-3 text-right">Profit / Loss (â‚¹)</th>
                    <th className="p-3 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {sortedCosting.map((item) => (
                    <tr
                      key={item.woId}
                      className={
                        item.isLossMaker
                          ? "bg-rose-50/80 dark:bg-rose-950/40 text-rose-300 font-bold border-l-4 border-l-rose-500"
                          : "hover:bg-slate-800/90/50"
                      }
                    >
                      <td className="p-3 font-bold text-white">
                        <Link
                          href={`/ops/work-orders/${item.woId}`}
                          className="hover:underline"
                        >
                          {item.woNumber}
                        </Link>
                      </td>
                      <td className="p-3 truncate max-w-[140px] font-sans">
                        {item.customerName}
                      </td>
                      <td className="p-3 truncate max-w-[160px] font-sans text-slate-300">
                        {item.productName}
                      </td>
                      <td className="p-3 text-right">
                        {item.goodQuantity.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-bold text-white">
                        â‚¹{item.revenue.toLocaleString()}
                      </td>
                      <td className="p-3 text-right text-slate-400">
                        â‚¹{item.totalCost.toLocaleString()}
                      </td>
                      <td
                        className={`p-3 text-right font-bold ${
                          item.isLossMaker
                            ? "text-rose-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {item.isLossMaker ? "-" : "+"}â‚¹
                        {Math.abs(item.profit).toLocaleString()}
                      </td>
                      <td className="p-3 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            item.isLossMaker
                              ? "bg-rose-200 dark:bg-rose-900 text-rose-200"
                              : "bg-emerald-100 dark:bg-emerald-950 text-emerald-300"
                          }`}
                        >
                          {item.marginPercentage}%
                        </span>
                      </td>
                    </tr>
                  ))}

                  {sortedCosting.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-8 text-center text-slate-500 font-sans"
                      >
                        No work order costing records found for the selected
                        criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-800/60 font-bold border-t-2 border-slate-600">
                    <td
                      colSpan={4}
                      className="p-3 text-white font-sans text-sm"
                    >
                      TOTAL PLANT SUMMARY ({costingList.length} Work Orders)
                    </td>
                    <td className="p-3 text-right text-white font-mono text-sm">
                      â‚¹{totalRevenue.toLocaleString()}
                    </td>
                    <td className="p-3 text-right text-slate-400 font-mono text-sm">
                      â‚¹{totalCost.toLocaleString()}
                    </td>
                    <td
                      className={`p-3 text-right font-mono text-sm ${
                        netProfit < 0 ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      {netProfit < 0 ? "-" : "+"}â‚¹
                      {Math.abs(netProfit).toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono text-sm text-white">
                      {overallMarginPct}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* REPORT FOOTER */}
          <div className="pt-4 border-t border-slate-700 text-[10px] text-slate-400 flex items-center justify-between">
            <span>
              Confidential Financial Document â€” For Internal Factory Executive
              Review Only.
            </span>
            <span>Page 1 of 1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
