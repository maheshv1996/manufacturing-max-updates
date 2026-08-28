"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, ArrowLeft, Calendar, Search } from "lucide-react";
import PrintButton from "@/app/components/print/PrintButton";

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerGstin?: string;
  invoiceDate: string;
  taxableValue: number;
  taxType: "INTRA" | "INTER";
  taxRatePct: number;
  cgstAmt: number;
  sgstAmt: number;
  igstAmt: number;
  totalValue: number;
  status: "UNPAID" | "PARTIAL" | "PAID";
}

export default function SalesRegisterClient({
  invoices,
  branding,
}: {
  invoices: InvoiceItem[];
  branding?: any;
}) {
  const [fromDate, setFromDate] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  );
  const [toDate, setToDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = invoices.filter((inv) => {
    const invDate = new Date(inv.invoiceDate).toISOString().slice(0, 10);
    const inDateRange =
      (!fromDate || invDate >= fromDate) && (!toDate || invDate <= toDate);
    const matchesStatus = statusFilter === "ALL" || inv.status === statusFilter;
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(search.toLowerCase());

    return inDateRange && matchesStatus && matchesSearch;
  });

  const totalTaxable = filtered.reduce((sum, i) => sum + i.taxableValue, 0);
  const totalCGST = filtered.reduce((sum, i) => sum + i.cgstAmt, 0);
  const totalSGST = filtered.reduce((sum, i) => sum + i.sgstAmt, 0);
  const totalIGST = filtered.reduce((sum, i) => sum + i.igstAmt, 0);
  const totalTax = totalCGST + totalSGST + totalIGST;
  const grandTotal = filtered.reduce((sum, i) => sum + i.totalValue, 0);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-8">
      {/* HEADER SECTION */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/reports"
            className="p-2.5 bg-slate-800/60 border border-slate-700 rounded-2xl hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <FileText className="w-7 h-7 text-emerald-600" />
              Sales &amp; GST Tax Invoice Register
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Comprehensive taxable sales ledger, GST tax splits
              (CGST/SGST/IGST), and collection status.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <PrintButton />
        </div>
      </div>

      {/* FILTER & DATE RANGE BAR */}
      <div className="max-w-7xl mx-auto bg-slate-800/60 border border-slate-700 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <Calendar className="w-4 h-4 text-emerald-600" /> From:
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-slate-800/60 border border-slate-600 text-white rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            To:
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-slate-800/60 border border-slate-600 text-white rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800/60 border border-slate-600 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1">
            {["ALL", "UNPAID", "PAID"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === st
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-slate-800/60 text-slate-400 hover:bg-slate-200"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SUMMARY STAT CARDS */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 print:grid-cols-4">
        <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
            Total Invoices Evaluated
          </span>
          <span className="text-xl font-black font-mono text-white mt-1 block">
            {filtered.length}
          </span>
        </div>

        <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
            Total Taxable Sales Value
          </span>
          <span className="text-xl font-black font-mono text-blue-400 mt-1 block">
            â‚¹{totalTaxable.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
            Total GST Collected
          </span>
          <span className="text-xl font-black font-mono text-emerald-400 mt-1 block">
            â‚¹{totalTax.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
            Grand Invoice Total
          </span>
          <span className="text-xl font-black font-mono text-purple-400 mt-1 block">
            â‚¹{grandTotal.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* PRINTABLE SALES REGISTER TABLE */}
      <div className="max-w-7xl mx-auto bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm overflow-hidden print:shadow-none print:border-none">
        {/* PRINT BRANDING HEADER */}
        <div className="p-6 border-b border-slate-200 hidden print:block">
          <h2 className="text-xl font-black text-slate-900">
            {branding?.companyName || "Apex Manufacturing Complex Ltd"}
          </h2>
          <p className="text-xs text-slate-500">
            GSTIN: {branding?.companyGstin || "27AAACA12341Z1"}
          </p>
          <h3 className="text-lg font-bold text-slate-800 mt-2">
            SALES &amp; GST TAX INVOICE REGISTER
          </h3>
          <p className="text-xs text-slate-500 font-mono">
            Date Range: {fromDate || "Beginning"} to {toDate || "Present"}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer Name &amp; GSTIN</th>
                <th className="py-3 px-4 text-right">Taxable Value (â‚¹)</th>
                <th className="py-3 px-4 text-right">CGST (â‚¹)</th>
                <th className="py-3 px-4 text-right">SGST (â‚¹)</th>
                <th className="py-3 px-4 text-right">IGST (â‚¹)</th>
                <th className="py-3 px-4 text-right">Grand Total (â‚¹)</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700 font-mono">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-12 text-center text-slate-400 italic"
                  >
                    No invoices found matching selected date range and filter
                    criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-50/60 hover:bg-slate-800/90/40"
                  >
                    <td className="py-3 px-4 font-bold text-purple-400">
                      <Link
                        href={`/reports/invoice/${inv.id}`}
                        className="hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-slate-300">
                      {new Date(inv.invoiceDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-sans font-bold text-white">
                      {inv.customerName}
                      {inv.customerGstin && (
                        <span className="block text-[11px] font-mono text-slate-400 font-normal">
                          {inv.customerGstin}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-white">
                      â‚¹
                      {inv.taxableValue.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-600">
                      {inv.cgstAmt > 0
                        ? `â‚¹${inv.cgstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                        : "â€”"}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-600">
                      {inv.sgstAmt > 0
                        ? `â‚¹${inv.sgstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                        : "â€”"}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-600">
                      {inv.igstAmt > 0
                        ? `â‚¹${inv.igstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                        : "â€”"}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-white text-sm">
                      â‚¹
                      {inv.totalValue.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          inv.status === "PAID"
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-400/30"
                            : "bg-rose-500/10 text-rose-300 border-rose-400/30"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* TOTALS FOOTER ROW */}
            <tfoot className="bg-slate-800/60 font-mono font-bold text-xs text-white border-t-2 border-slate-900">
              <tr>
                <td
                  colSpan={3}
                  className="py-3.5 px-4 font-sans font-black uppercase text-slate-600"
                >
                  TOTAL REGISTER SUMMARY ({filtered.length} INVOICES)
                </td>
                <td className="py-3.5 px-4 text-right text-blue-600 font-extrabold text-sm">
                  â‚¹
                  {totalTaxable.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="py-3.5 px-4 text-right text-emerald-600">
                  â‚¹
                  {totalCGST.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="py-3.5 px-4 text-right text-emerald-600">
                  â‚¹
                  {totalSGST.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="py-3.5 px-4 text-right text-emerald-600">
                  â‚¹
                  {totalIGST.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="py-3.5 px-4 text-right font-black text-purple-600 text-base">
                  â‚¹
                  {grandTotal.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="py-3.5 px-4 text-center font-sans text-slate-400">
                  â€”
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
