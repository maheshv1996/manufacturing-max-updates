"use client";

import { useState } from "react";
import {
  CreditCard,
  History,
  Users,
  RefreshCcw,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { LicenseInfo } from "@/lib/licenseEngine";

export default function SubscriptionClient({
  license,
  paymentHistory,
  leadCount,
}: {
  license: LicenseInfo;
  paymentHistory: any[];
  leadCount: number;
}) {
  const [loading, setLoading] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualAmount, setManualAmount] = useState("");
  const [manualRef, setManualRef] = useState("");

  const daysRemaining = differenceInDays(
    new Date(license.nextDueDate),
    new Date(),
  );

  const handlePayNow = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/pay", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to initiate payment");
      }
    } catch (err) {
      alert("Error initiating payment");
    } finally {
      setLoading(false);
    }
  };

  const handleManualRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/billing/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(manualAmount),
          reference: manualRef,
        }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to record manual payment");
      }
    } catch (err) {
      alert("Error recording payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Billing & Plan
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Manage your Manufacturing Max subscription.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Current Plan Card */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-blue-500" />
                Current Plan: {license.plan}
              </h2>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  license.paymentStatus === "ACTIVE"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 text-green-400"
                    : license.paymentStatus === "TRIAL"
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 text-purple-400"
                      : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 text-rose-400"
                }`}
              >
                {license.paymentStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-slate-900 rounded-xl">
                <p className="text-sm text-slate-500 font-medium mb-1">
                  Next Due Date
                </p>
                <p className="text-lg font-bold text-white">
                  {format(new Date(license.nextDueDate), "dd MMM yyyy")}
                </p>
              </div>
              <div
                className={`p-4 rounded-xl ${daysRemaining < 7 ? "bg-rose-50 dark:bg-rose-900/20" : "bg-slate-900"}`}
              >
                <p
                  className={`text-sm font-medium mb-1 ${daysRemaining < 7 ? "text-rose-400" : "text-slate-500"}`}
                >
                  Days Remaining
                </p>
                <p
                  className={`text-lg font-bold ${daysRemaining < 7 ? "text-rose-300" : "text-white"}`}
                >
                  {daysRemaining > 0 ? daysRemaining : 0} days
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePayNow}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CreditCard className="w-5 h-5" />
                Pay Now
              </button>
              <button
                onClick={() => setShowManualModal(true)}
                className="px-4 bg-slate-800/60 hover:bg-slate-200 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Record Manual
              </button>
            </div>
          </div>

          {/* Payment History */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-700">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5" />
                Payment History
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-900/50 text-slate-500 font-semibold uppercase tracking-wider text-xs">
                  <tr>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Method</th>
                    <th className="px-6 py-3">Ref</th>
                    <th className="px-6 py-3">Extends To</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 divide-slate-800">
                  {paymentHistory.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-8 text-center text-slate-500"
                      >
                        No payments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    paymentHistory.map((p) => (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50/60 hover:bg-slate-800/90/20"
                      >
                        <td className="px-6 py-4 font-medium text-white">
                          {format(new Date(p.at), "dd MMM yyyy")}
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-slate-300">
                          ₹{p.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-slate-300">
                          {p.method}
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-slate-300 truncate max-w-[120px]">
                          {p.reference || "-"}
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-slate-300">
                          {format(new Date(p.extendsUntil), "dd MMM yyyy")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-indigo-500" />
              Lead Generation
            </h2>
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
              <p className="text-sm text-indigo-400 font-medium mb-1">
                Total Leads
              </p>
              <p className="text-3xl font-black text-indigo-300">{leadCount}</p>
            </div>
            <p className="text-xs text-slate-500 mt-4 leading-relaxed">
              Leads collected from your public landing page will be counted
              here.
            </p>
          </div>
        </div>
      </div>

      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-6">
              Record Manual Payment
            </h2>

            <form onSubmit={handleManualRecord} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  placeholder="e.g. 4999"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Reference / UTR / Remarks
                </label>
                <input
                  type="text"
                  value={manualRef}
                  onChange={(e) => setManualRef(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  placeholder="e.g. UPI-123456"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCcw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Record & Extend
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
