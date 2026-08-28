"use client";

import { Printer, ArrowLeft, DollarSign } from "lucide-react";
import Link from "next/link";
import TallyExportButtons from "@/app/components/TallyExportButtons";

export default function SupplierPayablesClient({
  suppliers,
  branding,
}: {
  suppliers: any[];
  branding: any;
}) {
  const totalPurchased = suppliers.reduce(
    (sum, s) => sum + s.purchasedValue,
    0,
  );
  const totalPaid = suppliers.reduce((sum, s) => sum + s.paidValue, 0);
  const totalPayable = suppliers.reduce(
    (sum, s) => sum + (s.balancePayable > 0 ? s.balancePayable : 0),
    0,
  );

  return (
    <div className="min-h-screen bg-slate-800/60 pb-20">
      {/* Top Nav (Screen Only) */}
      <div className="print:hidden bg-slate-900 border-b border-slate-700 p-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/reports"
              className="p-2 hover:bg-slate-800/90 rounded-lg text-slate-500 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-rose-500" />
              Supplier Ledger & Payables Report
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <TallyExportButtons types={["PAYABLES", "PARTIES", "PAYMENTS"]} />
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-colors shadow-blue-500/20"
            >
              <Printer className="w-4 h-4" />
              Print Report
            </button>
          </div>
        </div>
      </div>

      {/* A4 Report Canvas */}
      <div className="max-w-4xl mx-auto mt-8 print:mt-0 print:max-w-full">
        <div className="bg-white print:shadow-none shadow-xl border border-slate-200 print:border-none sm:rounded-xl overflow-hidden print:w-[210mm] print:h-[297mm] mx-auto text-black bg-white">
          <div className="p-10 print:p-8 space-y-8">
            {/* Header */}
            <div className="border-b-2 border-slate-900 pb-6 flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">
                  Accounts Payable
                </h1>
                <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-wider">
                  Supplier Ledger Summary
                </p>
                <p className="text-sm text-slate-600 mt-3">
                  Report Date:{" "}
                  <span className="font-bold">
                    {new Date().toLocaleDateString("en-IN")}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-black text-slate-900">
                  {branding?.companyName || "Manufacturing Max"}
                </h2>
                <p className="text-sm text-slate-600 whitespace-pre-wrap mt-1">
                  {branding?.companyAddress || "123 Industrial Area"}
                </p>
                {branding?.companyGstin && (
                  <p className="text-sm text-slate-600 mt-1">
                    GSTIN:{" "}
                    <span className="font-bold">{branding.companyGstin}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-3 gap-6">
              <div className="border border-slate-300 rounded-lg p-4">
                <p className="text-xs font-bold text-slate-500 uppercase">
                  Total Value Purchased
                </p>
                <p className="text-2xl font-black font-mono mt-1 text-slate-900">
                  â‚¹{totalPurchased.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="border border-emerald-400/30 bg-emerald-500/10 rounded-lg p-4">
                <p className="text-xs font-bold text-emerald-300 uppercase">
                  Total Paid
                </p>
                <p className="text-2xl font-black font-mono mt-1 text-emerald-200">
                  â‚¹{totalPaid.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="border border-rose-400/30 bg-rose-500/10 rounded-lg p-4">
                <p className="text-xs font-bold text-rose-300 uppercase">
                  Total Outstanding
                </p>
                <p className="text-2xl font-black font-mono mt-1 text-rose-200">
                  â‚¹{totalPayable.toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            {/* Table */}
            <div>
              <table className="w-full text-sm text-left border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-800/60 text-slate-300">
                    <th className="border border-slate-300 px-3 py-2 font-bold uppercase w-1/3">
                      Supplier
                    </th>
                    <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-right">
                      Purchased (â‚¹)
                    </th>
                    <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-right">
                      Paid (â‚¹)
                    </th>
                    <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-right bg-slate-200">
                      Balance (â‚¹)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id} className="border-b border-slate-200">
                      <td className="border border-slate-300 px-3 py-2">
                        <div className="font-bold text-slate-900">
                          {supplier.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {supplier.code}
                        </div>
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-right font-mono">
                        {supplier.purchasedValue.toLocaleString("en-IN")}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-right font-mono">
                        {supplier.paidValue.toLocaleString("en-IN")}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-right font-mono font-bold bg-slate-50">
                        {supplier.balancePayable.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                  {suppliers.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="border border-slate-300 px-3 py-8 text-center text-slate-500"
                      >
                        No supplier data available.
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-100 font-bold text-slate-900">
                    <td className="border border-slate-300 px-3 py-2 text-right uppercase">
                      Total
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-right font-mono">
                      {totalPurchased.toLocaleString("en-IN")}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-right font-mono">
                      {totalPaid.toLocaleString("en-IN")}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-right font-mono">
                      {totalPayable.toLocaleString("en-IN")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="pt-8 border-t border-slate-300 text-xs text-slate-500 flex justify-between items-center print:pt-12">
              <p>Generated by Manufacturing Max</p>
              <p>Authorized Signature: _______________________</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
