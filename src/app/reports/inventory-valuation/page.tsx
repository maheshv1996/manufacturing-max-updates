import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import Link from "next/link";
import {
  ArrowLeft,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const revalidate = 0;

export default async function InventoryValuationReportPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/reports/inventory-valuation");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  const materials = await (prisma as any).rawMaterial.findMany({
    orderBy: { name: "asc" },
  });

  const totalValuation = materials.reduce(
    (sum: number, m: any) => sum + m.currentStock * m.unitCost,
    0,
  );

  const lowStockCount = materials.filter(
    (m: any) => m.currentStock <= m.minStock,
  ).length;
  const okStockCount = materials.length - lowStockCount;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER & NAV */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <Link
              href="/reports"
              className="p-2 bg-slate-800/60 border border-slate-700 rounded-xl text-slate-600 text-slate-300 hover:bg-slate-800/90 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-emerald-400" />
                Raw Material Inventory Valuation Report
              </h1>
              <p className="text-xs text-slate-400">
                Asset valuation of on-hand raw material stock (Current Stock Ã—
                Unit Cost).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <PrintButton />
          </div>
        </div>

        {/* PRINT BRANDING HEADER */}
        <div className="hidden print:block border-b border-slate-300 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Manufacturing Max â€” Enterprise MES
          </h1>
          <h2 className="text-lg font-bold text-slate-700">
            Raw Material Asset Valuation Report
          </h2>
          <p className="text-xs text-slate-500">
            Generated on {new Date().toLocaleString()} â€¢ Total Inventory Asset
            Value: â‚¹{totalValuation.toLocaleString()}
          </p>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Total Inventory Asset Value
            </span>
            <p className="text-3xl font-black text-emerald-400 font-mono">
              â‚¹{totalValuation.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-400 font-medium">
              On-hand raw material assets
            </p>
          </div>

          <div className="p-5 bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Active SKUs Tracked
            </span>
            <p className="text-3xl font-black text-white font-mono">
              {materials.length} SKUs
            </p>
            <p className="text-[11px] text-slate-400 font-medium">
              Cataloged raw materials
            </p>
          </div>

          <div className="p-5 bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Healthy Stock Status
            </span>
            <p className="text-3xl font-black text-blue-400 font-mono">
              {okStockCount} / {materials.length}
            </p>
            <p className="text-[11px] text-slate-400 font-medium">
              Above minimum threshold
            </p>
          </div>

          <div className="p-5 bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Reorder Alerts
            </span>
            <p className="text-3xl font-black text-rose-400 font-mono">
              {lowStockCount} Items
            </p>
            <p className="text-[11px] text-slate-400 font-medium">
              Below minimum stock level
            </p>
          </div>
        </div>

        {/* VALUATION TABLE */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-800/60 border-b border-slate-700 text-slate-400 font-bold uppercase tracking-wider">
                <th className="p-4">Raw Material / SKU</th>
                <th className="p-4 text-right">Current Stock</th>
                <th className="p-4 text-right">Min Stock</th>
                <th className="p-4 text-right">Unit Cost (â‚¹)</th>
                <th className="p-4 text-right">Total Asset Valuation (â‚¹)</th>
                <th className="p-4 text-right">% Asset Share</th>
                <th className="p-4 text-center">Stock Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 divide-slate-800 font-mono">
              {materials.map((m: any) => {
                const itemValuation = m.currentStock * m.unitCost;
                const assetShare =
                  totalValuation > 0
                    ? ((itemValuation / totalValuation) * 100).toFixed(1)
                    : "0.0";
                const isLow = m.currentStock <= m.minStock;

                return (
                  <tr
                    key={m.id}
                    className={`hover:bg-slate-800/90/40 ${
                      isLow ? "bg-rose-50/40 dark:bg-rose-950/20" : ""
                    }`}
                  >
                    <td className="p-4 font-sans">
                      <p className="font-bold text-white text-sm">{m.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        SKU: {m.sku} â€¢ Unit: {m.unit}
                      </p>
                    </td>
                    <td className="p-4 text-right font-bold text-white text-sm">
                      {m.currentStock.toLocaleString()} {m.unit}
                    </td>
                    <td className="p-4 text-right text-slate-500">
                      {m.minStock.toLocaleString()} {m.unit}
                    </td>
                    <td className="p-4 text-right text-slate-300">
                      â‚¹{m.unitCost.toLocaleString()}
                    </td>
                    <td className="p-4 text-right font-black text-emerald-400 text-sm">
                      â‚¹{itemValuation.toLocaleString()}
                    </td>
                    <td className="p-4 text-right font-bold text-slate-300">
                      {assetShare}%
                    </td>
                    <td className="p-4 text-center font-sans">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                          isLow
                            ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 text-rose-300 dark:border-rose-900"
                            : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 text-emerald-300 dark:border-emerald-900"
                        }`}
                      >
                        {isLow ? (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                            <span>Reorder Now!</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>OK</span>
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-800/60 font-extrabold text-white border-t border-slate-600 text-sm">
                <td className="p-4 font-sans">
                  GRAND TOTAL INVENTORY VALUATION
                </td>
                <td colSpan={3}></td>
                <td className="p-4 text-right text-emerald-400 font-mono">
                  â‚¹{totalValuation.toLocaleString()}
                </td>
                <td className="p-4 text-right font-mono">100.0%</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
