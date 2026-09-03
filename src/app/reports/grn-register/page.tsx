import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fromPaiseRows } from "@/lib/money";
import PrintButton from "@/app/components/print/PrintButton";
import { PackageCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const MATCH_LABELS: Record<string, string> = {
  UNMATCHED: "Awaiting Invoice",
  PARTIAL: "Partial Receipt",
  MATCHED: "Matched",
  MISMATCHED: "MISMATCH",
};

export default async function GrnRegisterPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "supply.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const now = new Date();
  const [grns, invoices] = await Promise.all([
    prisma.goodsReceiptNote.findMany({
      include: {
        po: true,
        supplier: { select: { name: true } },
        rawMaterial: { select: { sku: true, name: true, unit: true } },
        supplierInvoice: true,
      },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.supplierInvoice.findMany({
      include: {
        supplier: { select: { name: true } },
        po: { select: { poNumber: true } },
        grn: { select: { grnNumber: true } },
      },
      orderBy: { invoiceDate: "desc" },
    }),
  ]);

  // Supplier invoice rows store paise — map to rupees for the printed register.
  const invoicesRupees = fromPaiseRows("SupplierInvoice", invoices);

  const matched = invoicesRupees.filter((i) => i.status === "MATCHED").length;
  const mismatched = invoices.filter((i) => i.status === "MISMATCHED").length;

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 font-sans print:p-0 print:max-w-full">
      <div className="flex items-center justify-between mb-8 print:mb-4">
        <div className="flex items-center gap-3">
          <PackageCheck className="w-7 h-7 text-cyan-600 print:hidden" />
          <div>
            <h1 className="text-2xl font-extrabold text-white print:text-black">
              Goods Receipt & 3-Way Match Register
            </h1>
            <p className="text-xs text-slate-500 print:text-gray-600 mt-0.5">
              Generated: {now.toLocaleString()} · {grns.length} GRN(s) ·{" "}
              {invoices.length} invoice(s) · {matched} matched · {mismatched}{" "}
              mismatched
            </p>
          </div>
        </div>
        <PrintButton />
      </div>

      <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-600 text-slate-300 print:text-gray-700 mb-2 mt-6">
        Goods Receipt Notes
      </h2>
      <div className="overflow-x-auto bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm print:shadow-none print:border print:border-gray-200 print:rounded-none">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider font-bold print:bg-gray-100 print:text-gray-700">
            <tr>
              <th className="p-3">GRN No.</th>
              <th className="p-3">PO</th>
              <th className="p-3">Supplier</th>
              <th className="p-3">Material</th>
              <th className="p-3">Received</th>
              <th className="p-3">Batch</th>
              <th className="p-3">Inspection</th>
              <th className="p-3">3-Way Match</th>
              <th className="p-3">Received By</th>
              <th className="p-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 divide-slate-800 print:divide-gray-200">
            {grns.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="p-6 text-center text-slate-400 italic font-sans"
                >
                  No goods receipts on record.
                </td>
              </tr>
            )}
            {grns.map((g) => (
              <tr key={g.id} className="align-top">
                <td className="p-3 font-mono font-bold">{g.grnNumber}</td>
                <td className="p-3 font-mono">{g.po?.poNumber}</td>
                <td className="p-3">{g.supplier?.name}</td>
                <td className="p-3">
                  {g.rawMaterial?.name}{" "}
                  <span className="text-slate-400 font-mono">
                    ({g.rawMaterial?.sku})
                  </span>
                </td>
                <td className="p-3 font-mono">
                  {g.receivedQty} {g.rawMaterial?.unit}
                </td>
                <td className="p-3 font-mono">{g.batchNo || "—"}</td>
                <td className="p-3">{g.inspectionStatus}</td>
                <td className="p-3 font-bold">
                  {MATCH_LABELS[g.matchStatus] || g.matchStatus}
                </td>
                <td className="p-3">{g.receivedBy}</td>
                <td className="p-3">{g.receivedAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-600 text-slate-300 print:text-gray-700 mb-2 mt-6">
        Supplier Invoices
      </h2>
      <div className="overflow-x-auto bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm print:shadow-none print:border print:border-gray-200 print:rounded-none">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider font-bold print:bg-gray-100 print:text-gray-700">
            <tr>
              <th className="p-3">Invoice No.</th>
              <th className="p-3">Supplier</th>
              <th className="p-3">PO</th>
              <th className="p-3">GRN</th>
              <th className="p-3">Net</th>
              <th className="p-3">Tax</th>
              <th className="p-3">Total</th>
              <th className="p-3">Status</th>
              <th className="p-3">Invoice Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 divide-slate-800 print:divide-gray-200">
            {invoices.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="p-6 text-center text-slate-400 italic font-sans"
                >
                  No supplier invoices on record.
                </td>
              </tr>
            )}
            {invoicesRupees.map((inv) => (
              <tr key={inv.id} className="align-top">
                <td className="p-3 font-mono font-bold">{inv.invoiceNumber}</td>
                <td className="p-3">{inv.supplier?.name}</td>
                <td className="p-3 font-mono">{inv.po?.poNumber || "—"}</td>
                <td className="p-3 font-mono">{inv.grn?.grnNumber || "—"}</td>
                <td className="p-3 font-mono">{inv.amount}</td>
                <td className="p-3 font-mono">{inv.taxAmount}</td>
                <td className="p-3 font-mono font-bold">{inv.totalAmount}</td>
                <td className="p-3 font-bold">{inv.status}</td>
                <td className="p-3">{inv.invoiceDate.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-slate-400 mt-4 print:text-gray-500">
        Manufacturing MAX · GRN & 3-Way Match Register (PO ⇄ GRN ⇄ Invoice)
        · Accounts Payable Control Evidence · Confidential
      </p>
    </main>
  );
}
