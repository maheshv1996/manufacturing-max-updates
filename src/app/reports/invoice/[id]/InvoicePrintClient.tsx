"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PrintButton from "@/app/components/print/PrintButton";

interface InvoicePrintClientProps {
  invoice: any;
  branding: any;
  totalWords: string;
}

export default function InvoicePrintClient({
  invoice,
  branding,
  totalWords,
}: InvoicePrintClientProps) {
  const wo = invoice.workOrder;
  const prod = wo?.product;
  const dispatch = invoice.dispatchRecord;

  const totalTax = invoice.cgstAmt + invoice.sgstAmt + invoice.igstAmt;
  const qty = dispatch ? dispatch.dispatchedQty : wo?.plannedQuantity || 1;
  const unitPrice =
    taxableValueToUnitPrice(
      invoice.taxableValue,
      qty,
      wo?.quotedPrice,
      wo?.plannedQuantity,
    ) || invoice.taxableValue / qty;

  function taxableValueToUnitPrice(
    taxable: number,
    count: number,
    quoted?: number,
    planned?: number,
  ) {
    if (quoted && planned && planned > 0) return quoted / planned;
    if (count > 0) return taxable / count;
    return 100;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-900 p-4 sm:p-8">
      {/* NO-PRINT TOP NAVIGATION HEADER */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <Link
          href="/commercial/quotations"
          className="px-4 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Sales &amp; Invoices
        </Link>
        <div className="flex items-center gap-3">
          <PrintButton />
        </div>
      </div>

      {/* PRINTABLE GST TAX INVOICE LETTERHEAD CONTAINER */}
      <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-3xl shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-0 print:m-0 space-y-8 text-slate-900 font-sans">
        {/* 1. LETTERHEAD WITH BRANDING LOGO + COMPANY DETAILS */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b-2 border-slate-900 pb-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              {branding?.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt="Company Logo"
                  className="h-12 w-auto object-contain"
                />
              ) : (
                <div className="p-3 bg-blue-600 text-white rounded-2xl font-black text-xl tracking-wider">
                  APEX
                </div>
              )}
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {branding?.companyName || "Apex Manufacturing Complex Ltd"}
                </h1>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                  Precision Engineering &amp; Industrial Production
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 max-w-md pt-1">
              {branding?.companyAddress ||
                "100 Industrial Parkway, MIDC Area, Pune 411018, Maharashtra"}
            </p>

            <div className="flex items-center gap-4 text-xs font-mono font-bold text-slate-800 pt-1">
              <span>GSTIN: {branding?.companyGstin || "27AAACA12341Z1"}</span>
              <span>•</span>
              <span>
                State: {branding?.companyState || "Maharashtra"} (Code: 27)
              </span>
            </div>
          </div>

          <div className="text-right sm:self-center font-mono">
            <div className="inline-block px-4 py-1.5 bg-slate-900 text-white font-extrabold text-base rounded-xl tracking-widest uppercase">
              TAX INVOICE
            </div>
            <p className="text-lg font-black text-blue-600 mt-2">
              {invoice.invoiceNumber}
            </p>
            <p className="text-xs text-slate-500 font-sans">
              Original for Recipient
            </p>
          </div>
        </div>

        {/* 2. INVOICE META & BILL TO BLOCK */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-200 text-xs">
          {/* BILL TO */}
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">
              Billed To (Customer Details):
            </span>
            <strong className="text-base font-black text-slate-900 block">
              {invoice.customerName}
            </strong>
            <p className="text-slate-600 font-medium leading-relaxed">
              {invoice.customerAddress ||
                "Plot 42, Chakan Industrial Area, Pune 410501"}
            </p>
            <p className="font-mono font-bold text-slate-800 pt-1">
              GSTIN:{" "}
              <span className="text-blue-700">
                {invoice.customerGstin || "Unregistered / Consumer"}
              </span>
            </p>
          </div>

          {/* INVOICE DETAILS */}
          <div className="space-y-2 font-mono text-right sm:border-l sm:border-slate-200 sm:pl-6">
            <div className="flex justify-between sm:justify-end gap-4">
              <span className="text-slate-500 font-sans">Invoice Date:</span>
              <strong className="text-slate-900">
                {new Date(invoice.invoiceDate).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </strong>
            </div>

            <div className="flex justify-between sm:justify-end gap-4">
              <span className="text-slate-500 font-sans">
                Payment Due Date:
              </span>
              <strong className="text-slate-900">
                {invoice.dueDate
                  ? new Date(invoice.dueDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "NET-30 Days"}
              </strong>
            </div>

            {dispatch && (
              <div className="flex justify-between sm:justify-end gap-4">
                <span className="text-slate-500 font-sans">
                  Dispatch Challan #:
                </span>
                <strong className="text-purple-700">
                  {dispatch.challanNumber}
                </strong>
              </div>
            )}

            {wo && (
              <div className="flex justify-between sm:justify-end gap-4">
                <span className="text-slate-500 font-sans">Work Order #:</span>
                <strong className="text-blue-700">{wo.woNumber}</strong>
              </div>
            )}

            <div className="flex justify-between sm:justify-end gap-4 pt-1">
              <span className="text-slate-500 font-sans">Place of Supply:</span>
              <strong className="text-slate-900">
                {invoice.taxType === "INTRA"
                  ? "Intra-State (Same State)"
                  : "Inter-State (Outside State)"}
              </strong>
            </div>
          </div>
        </div>

        {/* 3. ITEMIZES LINE ITEMS TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider">
                <th className="p-3.5">#</th>
                <th className="p-3.5">Description of Goods / Products</th>
                <th className="p-3.5">HSN/SAC Code</th>
                <th className="p-3.5 text-right">Quantity</th>
                <th className="p-3.5 text-right">Unit Price (₹)</th>
                <th className="p-3.5 text-right">Taxable Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              <tr>
                <td className="p-3.5 text-slate-500 font-sans">1</td>
                <td className="p-3.5 font-sans">
                  <strong className="text-slate-900 text-sm block font-bold">
                    {prod?.name || "Precision Manufactured Assemblies"}
                  </strong>
                  <span className="text-[11px] text-slate-500 font-mono">
                    SKU: {prod?.sku || "SKU-PRODUCT-001"}
                  </span>
                </td>
                <td className="p-3.5 font-mono text-slate-600">8481.80</td>
                <td className="p-3.5 text-right font-bold text-slate-900">
                  {qty.toLocaleString("en-IN")} pcs
                </td>
                <td className="p-3.5 text-right text-slate-700">
                  ₹
                  {unitPrice.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="p-3.5 text-right font-bold text-slate-900 text-sm">
                  ₹
                  {invoice.taxableValue.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 4. TOTALS & TAX BREAKDOWN BLOCK */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-t-2 border-slate-200 pt-6">
          <div className="space-y-3 max-w-md text-xs">
            {/* INDIAN WORDS AMOUNT */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 block">
                Total Amount Chargeable (in Words):
              </span>
              <strong className="text-sm font-black text-slate-900 block leading-snug">
                {totalWords}
              </strong>
            </div>

            {invoice.notes && (
              <p className="text-xs text-slate-600 italic">
                <strong>Notes:</strong> {invoice.notes}
              </p>
            )}
          </div>

          <div className="w-full sm:w-80 bg-slate-50 p-5 rounded-2xl border border-slate-200 font-mono text-xs space-y-2.5">
            <div className="flex justify-between text-slate-600">
              <span>Taxable Value:</span>
              <span className="font-bold text-slate-900">
                ₹
                {invoice.taxableValue.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>

            {invoice.taxType === "INTRA" ? (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>CGST ({invoice.taxRatePct / 2}%):</span>
                  <span>
                    ₹
                    {invoice.cgstAmt.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>SGST ({invoice.taxRatePct / 2}%):</span>
                  <span>
                    ₹
                    {invoice.sgstAmt.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-slate-600">
                <span>IGST ({invoice.taxRatePct}%):</span>
                <span>
                  ₹
                  {invoice.igstAmt.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}

            <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-2">
              <span>Total Tax Amount:</span>
              <span className="font-bold text-emerald-600">
                ₹
                {totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between font-black text-lg text-slate-900 border-t-2 border-slate-900 pt-2.5">
              <span>Grand Total:</span>
              <span className="text-blue-600">
                ₹
                {invoice.totalValue.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </div>

        {/* 5. DECLARATION & SIGNATURE BLOCK */}
        <div className="pt-10 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-end gap-6 text-xs text-slate-600">
          <div className="max-w-md space-y-1">
            <strong className="text-slate-900 block font-bold">
              Declaration:
            </strong>
            <p className="text-[11px] leading-relaxed">
              We declare that this invoice shows the actual price of the goods
              described and that all particulars are true and correct.
            </p>
          </div>

          <div className="text-right space-y-8 font-sans">
            <p className="font-bold text-slate-900">
              For {branding?.companyName || "Apex Manufacturing Complex Ltd"}
            </p>
            <div className="w-48 border-b-2 border-slate-400 ml-auto" />
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Authorised Signatory
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
