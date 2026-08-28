"use client";

import { useState } from "react";
import { format } from "date-fns";
import { DollarSign, History, Check } from "lucide-react";
import RecordSupplierPaymentModal from "./RecordSupplierPaymentModal";
import { useRouter } from "next/navigation";
import TallyExportButtons from "@/app/components/TallyExportButtons";

export default function CommercialDeskClient({
  suppliers,
  canEdit,
}: {
  suppliers: any[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const totalPurchased = suppliers.reduce(
    (sum, s) => sum + s.purchasedValue,
    0,
  );
  const totalPaid = suppliers.reduce((sum, s) => sum + s.paidValue, 0);
  const totalPayable = suppliers.reduce(
    (sum, s) => sum + (s.balancePayable > 0 ? s.balancePayable : 0),
    0,
  );

  const handlePaymentComplete = () => {
    setIsPaymentModalOpen(false);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Payables Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-bold text-slate-500 uppercase">
            Total Purchased Value
          </p>
          <p className="text-2xl font-black mt-1 font-mono text-white">
            â‚¹{totalPurchased.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-bold text-slate-500 uppercase">
            Total Paid
          </p>
          <p className="text-2xl font-black mt-1 font-mono text-emerald-400">
            â‚¹{totalPaid.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-bold text-rose-400 uppercase">
            Outstanding Payables
          </p>
          <p className="text-2xl font-black mt-1 font-mono text-rose-400">
            â‚¹{totalPayable.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* Payables by Supplier */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/60">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-rose-500" />
            Accounts Payable by Supplier
          </h2>
          <TallyExportButtons />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/60 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-bold uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-right">
                  Purchased (â‚¹)
                </th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-right">
                  Paid (â‚¹)
                </th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-right">
                  Balance Payable (â‚¹)
                </th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider">
                  Last Payment
                </th>
                {canEdit && (
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-right">
                    Action
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 divide-slate-800/60">
              {suppliers.map((supplier) => (
                <tr
                  key={supplier.id}
                  className="hover:bg-slate-50/60 hover:bg-slate-800/90/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-200">
                      {supplier.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {supplier.code}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-400">
                    {supplier.purchasedValue.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-500">
                    {supplier.paidValue.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={
                        supplier.balancePayable > 0
                          ? "font-mono font-bold text-rose-400"
                          : "font-mono font-bold text-slate-400"
                      }
                    >
                      {supplier.balancePayable.toLocaleString("en-IN")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {supplier.lastPaymentDate
                      ? format(
                          new Date(supplier.lastPaymentDate),
                          "MMM d, yyyy",
                        )
                      : "-"}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedSupplier(supplier);
                          setIsPaymentModalOpen(true);
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 rounded-lg transition-colors border border-blue-200 dark:border-blue-800"
                      >
                        Record Payment
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr>
                  <td
                    colSpan={canEdit ? 6 : 5}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No suppliers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment History List */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/60">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-slate-500" />
            Recent Payments
          </h2>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {suppliers
              .flatMap((s) =>
                s.payments.map((p: any) => ({ ...p, supplierName: s.name })),
              )
              .sort(
                (a, b) =>
                  new Date(b.paymentDate).getTime() -
                  new Date(a.paymentDate).getTime(),
              )
              .slice(0, 10)
              .map((payment: any) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 border border-slate-700 rounded-xl bg-slate-800/60"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-400 rounded-lg">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-200">
                        Payment to {payment.supplierName}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>
                          {format(new Date(payment.paymentDate), "MMM d, yyyy")}
                        </span>
                        <span>â€¢</span>
                        <span>{payment.method}</span>
                        {payment.reference && (
                          <>
                            <span>â€¢</span>
                            <span>Ref: {payment.reference}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="font-mono font-bold text-white">
                    â‚¹{payment.amount.toLocaleString("en-IN")}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {isPaymentModalOpen && selectedSupplier && (
        <RecordSupplierPaymentModal
          supplier={selectedSupplier}
          onClose={() => setIsPaymentModalOpen(false)}
          onSuccess={handlePaymentComplete}
        />
      )}
    </div>
  );
}
