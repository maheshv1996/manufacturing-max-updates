"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import PrintButton from "@/app/components/print/PrintButton";

export default function ReceivablesClient({
  invoices,
  branding,
}: {
  invoices: any[];
  branding: any;
}) {
  const [filter, setFilter] = useState<"ALL" | "UNPAID_ONLY">("UNPAID_ONLY");

  const now = new Date();

  // Group by customer
  const customerLedger: Record<string, any> = {};

  invoices.forEach((inv) => {
    if (filter === "UNPAID_ONLY" && inv.status === "PAID") return;

    if (!customerLedger[inv.customerName]) {
      customerLedger[inv.customerName] = {
        name: inv.customerName,
        totalInvoiced: 0,
        totalPaid: 0,
        totalDue: 0,
        bucket0_30: 0,
        bucket31_60: 0,
        bucket61_90: 0,
        bucket90Plus: 0,
        invoices: [],
      };
    }

    const ledger = customerLedger[inv.customerName];
    const due = inv.totalValue - (inv.paidAmount || 0);

    ledger.totalInvoiced += inv.totalValue;
    ledger.totalPaid += inv.paidAmount || 0;
    ledger.totalDue += due;
    ledger.invoices.push(inv);

    if (due > 0) {
      const daysOld = Math.floor(
        (now.getTime() - new Date(inv.invoiceDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (daysOld <= 30) ledger.bucket0_30 += due;
      else if (daysOld <= 60) ledger.bucket31_60 += due;
      else if (daysOld <= 90) ledger.bucket61_90 += due;
      else ledger.bucket90Plus += due;
    }
  });

  const customers = Object.values(customerLedger).sort(
    (a, b) => b.totalDue - a.totalDue,
  );

  const grandTotals = customers.reduce(
    (acc, c) => ({
      invoiced: acc.invoiced + c.totalInvoiced,
      paid: acc.paid + c.totalPaid,
      due: acc.due + c.totalDue,
      b0_30: acc.b0_30 + c.bucket0_30,
      b31_60: acc.b31_60 + c.bucket31_60,
      b61_90: acc.b61_90 + c.bucket61_90,
      b90Plus: acc.b90Plus + c.bucket90Plus,
    }),
    {
      invoiced: 0,
      paid: 0,
      due: 0,
      b0_30: 0,
      b31_60: 0,
      b61_90: 0,
      b90Plus: 0,
    },
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* HEADER SECTION (Hidden when printing) */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-6 print:hidden">
          <div className="flex items-center gap-4">
            <Link
              href="/reports"
              className="p-2 bg-slate-800/60 border border-slate-700 rounded-xl hover:bg-slate-800/90 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <FileText className="w-6 h-6 text-purple-600" />
                Receivables &amp; Aging Report
              </h1>
              <p className="text-sm text-slate-500">
                Customer ledger and outstanding balances
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-800/60 border border-slate-600 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500"
            >
              <option value="UNPAID_ONLY">Unpaid Only</option>
              <option value="ALL">All Invoices</option>
            </select>
            <PrintButton />
          </div>
        </header>

        {/* PRINTABLE AREA */}
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm p-8 print:p-0 print:border-none print:shadow-none print:bg-transparent">
          {/* REPORT HEADER */}
          <div className="border-b-2 border-slate-100 pb-6 mb-8 flex justify-between items-end">
            <div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tight">
                Receivables Report
              </h2>
              <p className="text-slate-500 font-medium mt-1">
                Generated on: {now.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <h3 className="font-bold text-lg text-white">
                {branding?.companyName || "Manufacturing Max"}
              </h3>
              <p className="text-sm text-slate-500 whitespace-pre-line">
                {branding?.companyAddress ||
                  "123 Industrial Area, Phase 1\nPune, Maharashtra 411026"}
              </p>
              {branding?.companyGstin && (
                <p className="text-xs font-mono text-slate-500 mt-1">
                  GSTIN: {branding.companyGstin}
                </p>
              )}
            </div>
          </div>

          {/* GRAND TOTALS */}
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-4 mb-8 bg-slate-800/60 p-4 rounded-xl border border-slate-700">
            <div className="col-span-4 sm:col-span-3">
              <p className="text-xs font-bold text-slate-500 uppercase">
                Total Outstanding
              </p>
              <p className="text-2xl font-black text-blue-600 font-mono mt-1">
                ₹{grandTotals.due.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-slate-500 uppercase">0-30</p>
              <p className="font-mono font-bold mt-1">
                ₹{grandTotals.b0_30.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-slate-500 uppercase">
                31-60
              </p>
              <p className="font-mono font-bold mt-1">
                ₹{grandTotals.b31_60.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-amber-600 uppercase">
                61-90
              </p>
              <p className="font-mono font-bold text-amber-600 mt-1">
                ₹{grandTotals.b61_90.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-rose-600 uppercase">
                &gt;90
              </p>
              <p className="font-mono font-bold text-rose-600 mt-1">
                ₹{grandTotals.b90Plus.toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          {/* CUSTOMER LEDGERS */}
          <div className="space-y-8">
            {customers.map((c) => (
              <div key={c.name} className="break-inside-avoid">
                <div className="flex justify-between items-end border-b border-slate-600 pb-2 mb-3">
                  <h3 className="text-lg font-bold text-white">{c.name}</h3>
                  <div className="text-right flex gap-6">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Total Due
                      </span>
                      <span className="font-mono font-bold text-blue-600">
                        ₹{c.totalDue.toLocaleString("en-IN")}
                      </span>
                    </div>
                    {c.bucket90Plus > 0 && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-rose-500 block">
                          &gt;90 Days
                        </span>
                        <span className="font-mono font-bold text-rose-600">
                          ₹{c.bucket90Plus.toLocaleString("en-IN")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-500 border-b border-slate-700">
                    <tr>
                      <th className="py-2 font-medium">Invoice #</th>
                      <th className="py-2 font-medium">Date</th>
                      <th className="py-2 font-medium text-right">Value</th>
                      <th className="py-2 font-medium text-right">Paid</th>
                      <th className="py-2 font-medium text-right">Balance</th>
                      <th className="py-2 font-medium text-right">
                        Age (Days)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 divide-slate-800 font-mono text-xs">
                    {c.invoices.map((inv: any) => {
                      const due = inv.totalValue - (inv.paidAmount || 0);
                      const age = Math.floor(
                        (now.getTime() - new Date(inv.invoiceDate).getTime()) /
                          (1000 * 60 * 60 * 24),
                      );
                      return (
                        <tr key={inv.id}>
                          <td className="py-2">{inv.invoiceNumber}</td>
                          <td className="py-2">
                            {new Date(inv.invoiceDate).toLocaleDateString()}
                          </td>
                          <td className="py-2 text-right">
                            ₹{inv.totalValue.toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 text-right text-emerald-600">
                            ₹{(inv.paidAmount || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 text-right font-bold">
                            ₹{due.toLocaleString("en-IN")}
                          </td>
                          <td
                            className={`py-2 text-right ${due > 0 ? (age > 90 ? "text-rose-600 font-bold" : age > 60 ? "text-amber-600" : "") : "text-slate-400"}`}
                          >
                            {due > 0 ? age : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}

            {customers.length === 0 && (
              <div className="text-center py-12 text-slate-500 italic">
                No invoices found matching criteria.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
