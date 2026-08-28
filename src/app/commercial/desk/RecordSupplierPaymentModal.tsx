"use client";

import { useState } from "react";
import { X } from "lucide-react";

export default function RecordSupplierPaymentModal({
  supplier,
  onClose,
  onSuccess,
}: {
  supplier: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState(
    supplier.balancePayable > 0 ? supplier.balancePayable.toString() : "",
  );
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/commercial/payables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: supplier.id,
          amount,
          method,
          reference,
          notes,
          paymentDate: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to record payment");
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-slate-800/60 rounded-2xl shadow-xl w-full max-w-xl overflow-hidden border border-slate-700">
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/60">
          <h2 className="text-lg font-bold text-white">
            Record Payment to {supplier.name}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:text-slate-300 rounded-lg hover:bg-slate-200 hover:bg-slate-800/90 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 text-rose-300 text-sm rounded-lg border border-rose-400/20">
              {error}
            </div>
          )}

          <div className="bg-slate-800/60 p-4 rounded-xl flex justify-between items-center border border-slate-600/50">
            <span className="text-sm font-bold text-slate-500 uppercase">
              Balance Payable:
            </span>
            <span className="font-mono font-black text-lg text-slate-200">
              â‚¹{supplier.balancePayable.toLocaleString("en-IN")}
            </span>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-1">
              Payment Amount (â‚¹) *
            </label>
            <input
              type="number"
              required
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800/60 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-lg"
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1">
                Payment Method *
              </label>
              <select
                required
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800/60 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CASH">Cash</option>
                <option value="RAZORPAY">Razorpay</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1">
                Reference / UTR / Cheque No.
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800/60 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                placeholder="e.g. UTR-123456"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-1">
              Internal Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800/60 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              placeholder="Optional remarks"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-slate-500/10 text-slate-300 hover:bg-slate-500/20 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !amount}
              className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-bold disabled:opacity-50"
            >
              {loading ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
