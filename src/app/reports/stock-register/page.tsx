import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import Link from "next/link";
import { ArrowLeft, Boxes, Filter } from "lucide-react";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const revalidate = 0;

export default async function StockRegisterReportPage({
  searchParams,
}: {
  searchParams: Promise<{ materialId?: string }>;
}) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/reports/stock-register");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  const { materialId } = await searchParams;

  const rawMaterials = await (prisma as any).rawMaterial.findMany({
    orderBy: { name: "asc" },
  });

  const whereCondition: any = {};
  if (materialId && materialId !== "ALL") {
    whereCondition.rawMaterialId = materialId;
  }

  const transactions = await (prisma as any).inventoryTransaction.findMany({
    where: whereCondition,
    include: {
      rawMaterial: true,
      workOrder: { select: { woNumber: true, customerName: true } },
    },
    orderBy: { at: "desc" },
    take: 200,
  });

  const totalInQty = transactions
    .filter((t: any) => t.type === "IN")
    .reduce((sum: number, t: any) => sum + t.qty, 0);

  const totalOutQty = transactions
    .filter((t: any) => t.type === "OUT")
    .reduce((sum: number, t: any) => sum + t.qty, 0);

  const totalValueIssued = transactions
    .filter((t: any) => t.type === "OUT")
    .reduce((sum: number, t: any) => sum + t.qty * (t.unitCost || 0), 0);

  const selectedMaterial = rawMaterials.find((m: any) => m.id === materialId);

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
                <Boxes className="w-6 h-6 text-blue-400" />
                Raw Material Stock Register
              </h1>
              <p className="text-xs text-slate-400">
                Complete inventory movement ledger, receipts, job issuances, and
                lot batch traceability.
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
            Manufacturing Max — Enterprise MES
          </h1>
          <h2 className="text-lg font-bold text-slate-700">
            Raw Material Stock Register &amp; Batch Traceability Ledger
          </h2>
          <p className="text-xs text-slate-500">
            Generated on {new Date().toLocaleString()}{" "}
            {selectedMaterial
              ? `• Filtered Material: ${selectedMaterial.name} (${selectedMaterial.sku})`
              : ""}
          </p>
        </div>

        {/* FILTER BAR */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <form className="flex items-center gap-3 w-full max-w-md">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              name="materialId"
              defaultValue={materialId || "ALL"}
              className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Raw Materials (Entire Ledger)</option>
              {rawMaterials.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.sku})
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition-colors shrink-0"
            >
              Apply Filter
            </button>
          </form>

          <span className="text-xs text-slate-500 font-mono">
            Showing last {transactions.length} movement record(s)
          </span>
        </div>

        {/* SUMMARY METRICS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Inward Receipts
            </span>
            <p className="text-2xl font-black text-emerald-400 font-mono">
              +{totalInQty.toLocaleString()} units
            </p>
          </div>

          <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Job Issuances
            </span>
            <p className="text-2xl font-black text-blue-400 font-mono">
              -{totalOutQty.toLocaleString()} units
            </p>
          </div>

          <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Issued Value
            </span>
            <p className="text-2xl font-black text-white font-mono">
              ₹{totalValueIssued.toLocaleString()}
            </p>
          </div>
        </div>

        {/* TRANSACTIONS TABLE */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-800/60 border-b border-slate-700 text-slate-400 font-bold uppercase tracking-wider">
                <th className="p-4">Date / Time</th>
                <th className="p-4">Raw Material / SKU</th>
                <th className="p-4 text-center">Type</th>
                <th className="p-4 text-right">Quantity</th>
                <th className="p-4">Batch / Lot #</th>
                <th className="p-4">Reference / Order</th>
                <th className="p-4 text-right">Unit Cost</th>
                <th className="p-4 text-right">Total Value</th>
                <th className="p-4 text-right">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 divide-slate-800 font-mono">
              {transactions.map((tx: any) => {
                const totalValue = tx.qty * (tx.unitCost || 0);

                return (
                  <tr key={tx.id} className="hover:bg-slate-800/90/40">
                    <td className="p-4 text-slate-500 font-sans">
                      {new Date(tx.at).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="p-4 font-sans">
                      <p className="font-bold text-white">
                        {tx.rawMaterial.name}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        SKU: {tx.rawMaterial.sku}
                      </p>
                    </td>
                    <td className="p-4 text-center font-sans">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                          tx.type === "IN"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 text-emerald-300"
                            : tx.type === "OUT"
                              ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 text-blue-300"
                              : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 text-amber-300"
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td className="p-4 text-right font-black text-white text-sm">
                      {tx.type === "OUT" ? "-" : tx.type === "IN" ? "+" : ""}
                      {tx.qty} {tx.rawMaterial.unit}
                    </td>
                    <td className="p-4 font-mono text-slate-300">
                      {tx.batchNo ? (
                        <span className="px-2 py-0.5 bg-slate-800/60 rounded font-bold border border-slate-600 text-[11px]">
                          {tx.batchNo}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="p-4 font-sans text-slate-300">
                      <p className="font-bold">{tx.reference || "—"}</p>
                      {tx.workOrder && (
                        <p className="text-[11px] text-blue-400 font-mono">
                          {tx.workOrder.woNumber} (
                          {tx.workOrder.customerName || "Customer"})
                        </p>
                      )}
                    </td>
                    <td className="p-4 text-right text-slate-600 text-slate-300">
                      ₹{(tx.unitCost || 0).toLocaleString()}
                    </td>
                    <td className="p-4 text-right font-bold text-white">
                      ₹{totalValue.toLocaleString()}
                    </td>
                    <td className="p-4 text-right font-sans text-slate-500">
                      {tx.actorName}
                    </td>
                  </tr>
                );
              })}

              {transactions.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="p-8 text-center text-slate-500 font-sans"
                  >
                    No transaction history found for selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
