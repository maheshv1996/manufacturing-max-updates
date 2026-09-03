import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import Link from "next/link";
import { ArrowLeft, ShoppingBag, Filter } from "lucide-react";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const revalidate = 0;

export default async function PORegisterReportPage({
  searchParams,
}: {
  searchParams: Promise<{ supplierId?: string; status?: string }>;
}) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/reports/po-register");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  const { supplierId, status } = await searchParams;

  const suppliers = await (prisma as any).supplier.findMany({
    orderBy: { name: "asc" },
  });

  const whereCondition: any = {};
  if (supplierId && supplierId !== "ALL") {
    whereCondition.supplierId = supplierId;
  }
  if (status && status !== "ALL") {
    whereCondition.status = status;
  }

  const purchaseOrders = await (prisma as any).purchaseOrder.findMany({
    where: whereCondition,
    include: {
      supplier: true,
      rawMaterial: true,
      lines: {
        include: { rawMaterial: true },
        orderBy: { lineNo: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const poValue = (p: any) =>
    p.lines && p.lines.length
      ? p.lines.reduce(
          (s: number, l: any) => s + Number(l.qty) * Number(l.unitCost),
          0,
        )
      : p.qty * p.unitCost;
  const poOrderedQty = (p: any) =>
    p.lines && p.lines.length
      ? p.lines.reduce((s: number, l: any) => s + Number(l.qty), 0)
      : p.qty;
  const poOpenValue = (p: any) =>
    p.lines && p.lines.length
      ? p.lines.reduce(
          (s: number, l: any) =>
            s +
            (Number(l.qty) - Number(l.receivedQty || 0)) * Number(l.unitCost),
          0,
        )
      : (p.qty - p.receivedQty) * p.unitCost;

  const totalPOs = purchaseOrders.length;
  const totalValue = purchaseOrders
    .filter((p: any) => p.status !== "CANCELLED")
    .reduce((sum: number, p: any) => sum + poValue(p), 0);

  const openValue = purchaseOrders
    .filter((p: any) => p.status === "ORDERED" || p.status === "PARTIAL")
    .reduce((sum: number, p: any) => sum + poOpenValue(p), 0);

  const receivedPOs = purchaseOrders.filter(
    (p: any) => p.status === "RECEIVED",
  );
  const onTimeCount = receivedPOs.filter(
    (p: any) =>
      p.receivedAt &&
      p.expectedDate &&
      new Date(p.receivedAt) <= new Date(p.expectedDate),
  ).length;

  const onTimePct =
    receivedPOs.length > 0
      ? Math.round((onTimeCount / receivedPOs.length) * 100)
      : 100;

  const selectedSupplier = suppliers.find((s: any) => s.id === supplierId);

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
                <ShoppingBag className="w-6 h-6 text-blue-400" />
                Purchase Order Register Report
              </h1>
              <p className="text-xs text-slate-400">
                Complete procurement ledger of open & closed POs, supplier
                commitments, and fulfillment status.
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
            Purchase Order Register &amp; Procurement Ledger
          </h2>
          <p className="text-xs text-slate-500">
            Generated on {new Date().toLocaleString()}{" "}
            {selectedSupplier ? `• Supplier: ${selectedSupplier.name}` : ""}{" "}
            {status && status !== "ALL" ? `• Status: ${status}` : ""}
          </p>
        </div>

        {/* FILTER BAR */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <form className="flex flex-wrap items-center gap-3 w-full">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />

            <div className="flex-1 min-w-[200px]">
              <select
                name="supplierId"
                defaultValue={supplierId || "ALL"}
                className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Suppliers</option>
                {suppliers.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-48">
              <select
                name="status"
                defaultValue={status || "ALL"}
                className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="ORDERED">ORDERED</option>
                <option value="PARTIAL">PARTIAL</option>
                <option value="RECEIVED">RECEIVED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow transition-colors"
            >
              Apply Filters
            </button>
          </form>
        </div>

        {/* METRICS SUMMARY CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-800/60 border border-slate-700 p-4 rounded-2xl shadow-xs">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
              Total PO Count
            </span>
            <span className="text-xl font-black text-white">{totalPOs}</span>
          </div>

          <div className="bg-slate-800/60 border border-slate-700 p-4 rounded-2xl shadow-xs">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
              Total Commitment Value
            </span>
            <span className="text-xl font-black text-white">
              ₹{totalValue.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-800/60 border border-slate-700 p-4 rounded-2xl shadow-xs">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
              Open Pending Value
            </span>
            <span className="text-xl font-black text-amber-400">
              ₹{openValue.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-800/60 border border-slate-700 p-4 rounded-2xl shadow-xs">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
              On-Time Delivery %
            </span>
            <span className="text-xl font-black text-emerald-400">
              {onTimePct}%
            </span>
          </div>
        </div>

        {/* PO TABLE */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-800/60 text-slate-300 font-bold border-b border-slate-700">
                <tr>
                  <th className="px-4 py-3">PO Number</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Material</th>
                  <th className="px-4 py-3 text-right">Ordered Qty</th>
                  <th className="px-4 py-3 text-right">Unit Cost</th>
                  <th className="px-4 py-3 text-right">Total Value</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Expected Date</th>
                  <th className="px-4 py-3 text-right">Received Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {purchaseOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-8 text-center text-slate-400"
                    >
                      No purchase orders found matching selected filters.
                    </td>
                  </tr>
                ) : (
                  purchaseOrders.map((po: any) => {
                    const lines = po.lines && po.lines.length ? po.lines : null;
                    const multi = !!lines && lines.length > 1;
                    const statusBadge =
                      po.status === "RECEIVED"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 text-emerald-300"
                        : po.status === "PARTIAL"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 text-amber-300"
                          : po.status === "ORDERED"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 text-blue-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950 text-rose-300";

                    return (
                      <tr key={po.id} className="hover:bg-slate-800/90/30">
                        <td className="px-4 py-3 font-mono font-bold text-white">
                          {po.poNumber}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500">
                          {new Date(po.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-200">
                          {po.supplier?.name || "—"}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-200">
                          {(lines && lines[0]?.rawMaterial?.name) ||
                            po.rawMaterial?.name}
                          {multi ? ` +${lines.length - 1} more` : ""}
                        </td>
                        <td className="px-4 py-3 font-mono text-right font-bold">
                          {multi
                            ? lines.reduce(
                                (s: number, l: any) => s + Number(l.qty),
                                0,
                              )
                            : po.qty}{" "}
                          {(lines && lines[0]?.rawMaterial?.unit) ||
                            po.rawMaterial?.unit}
                        </td>
                        <td className="px-4 py-3 font-mono text-right text-slate-500">
                          {multi ? "—" : `₹${po.unitCost}`}
                        </td>
                        <td className="px-4 py-3 font-mono text-right font-bold text-white">
                          ₹{poValue(po).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${statusBadge}`}
                          >
                            {po.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500">
                          {po.expectedDate
                            ? new Date(po.expectedDate).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-right font-bold text-cyan-400">
                          {po.receivedQty} / {multi ? poOrderedQty(po) : po.qty}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
