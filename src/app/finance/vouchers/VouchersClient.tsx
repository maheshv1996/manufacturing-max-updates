"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  FileText,
  CheckCircle2,
  XCircle,
  Search,
  ShieldCheck,
  PenLine,
} from "lucide-react";

interface Voucher {
  id: string;
  voucherNumber: string;
  voucherType: string;
  amount: number;
  account: string;
  particulars: string;
  voucherDate: string;
  status: "PENDING_CHECK" | "POSTED" | "REJECTED";
  enteredBy: string;
  checkedBy: string | null;
  checkedAt: string | null;
  rejectReason: string | null;
  postedToTreasury: boolean;
  sourceAssetId: string | null;
}

const TYPE_COLOR: Record<string, string> = {
  PAYMENT: "text-rose-300 border-rose-500/40 bg-rose-500/10",
  RECEIPT: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  JOURNAL: "text-sky-300 border-sky-500/40 bg-sky-500/10",
  DEPRECIATION: "text-violet-300 border-violet-500/40 bg-violet-500/10",
  ADJUSTMENT: "text-amber-300 border-amber-500/40 bg-amber-500/10",
};

export default function VouchersClient() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [actionFor, setActionFor] = useState<Voucher | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const field = {
    voucherType: "PAYMENT",
    amount: "",
    account: "Main",
    particulars: "",
    voucherDate: new Date().toISOString().slice(0, 10),
  };
  const [newVoucher, setNewVoucher] = useState(field);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/vouchers");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setVouchers(data.vouchers || []);
      setStats(data.stats);
    } catch (e: any) {
      setMsg(e.message || "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showNew) setShowNew(false);
        if (actionFor) setActionFor(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showNew, actionFor]);

  const create = async () => {
    setMsg("");
    if (
      !newVoucher.amount ||
      Number(newVoucher.amount) <= 0 ||
      !newVoucher.particulars.trim()
    ) {
      setMsg("Amount (>0) and particulars are required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newVoucher),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(
          `Entered ${data.voucher.voucherNumber} — awaiting manager check`,
        );
        setShowNew(false);
        setNewVoucher(field);
        await fetchAll();
      } else {
        setMsg(data.error || "Failed to enter voucher");
      }
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (action: "check-post" | "reject") => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/vouchers/${actionFor!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "reject" ? { action, reason: rejectReason } : { action },
        ),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(
          action === "check-post"
            ? `${actionFor!.voucherNumber} checked & posted${actionFor!.voucherType === "PAYMENT" || actionFor!.voucherType === "RECEIPT" ? " → treasury" : ""}`
            : `${actionFor!.voucherNumber} rejected`,
        );
        setActionFor(null);
        setRejectReason("");
        await fetchAll();
      } else {
        setMsg(data.error || "Decision failed");
      }
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  };

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-emerald-300 font-semibold">{msg}</p>}

      {/* KPI row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Awaiting check",
              value: stats.pending,
              sub: fmt(stats.pendingValue),
              tone: "text-amber-400",
              icon: <Search className="h-5 w-5 text-amber-500" />,
            },
            {
              label: "Posted this year",
              value: stats.posted,
              sub: fmt(stats.postedValueYear),
              tone: "text-emerald-400",
              icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
            },
            {
              label: "Rejected",
              value: stats.rejected,
              sub: "sent back",
              tone: "text-rose-400",
              icon: <XCircle className="h-5 w-5 text-rose-500" />,
            },
            {
              label: "Maker → Checker",
              value: "4-eyes",
              sub: "unchecked never posts",
              tone: "text-sky-400",
              icon: <ShieldCheck className="h-5 w-5 text-sky-500" />,
            },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4"
            >
              <div className="flex items-center gap-2">
                {k.icon}
                <p className="text-xs text-slate-400">{k.label}</p>
              </div>
              <p className={`text-2xl font-black text-white mt-1 ${k.tone}`}>
                {k.value}
              </p>
              <p className="text-[11px] text-slate-500">{k.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs text-slate-500">
          Maker enters a voucher — it stays{" "}
          <span className="text-amber-300 font-bold">PENDING CHECK</span>. Only
          a manager check-and-post writes it to the books{""}{" "}
          <span className="text-slate-400">
            (cash types mirror to the treasury ledger; depreciation drafts book
            the asset entry).
          </span>
        </p>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-bold px-4 py-2 shadow-md transition-all"
        >
          <PenLine className="h-4 w-4" /> New Voucher (Maker)
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-700">
                <th className="py-3 px-4">Voucher</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Particulars</th>
                <th className="py-3 px-4">Maker</th>
                <th className="py-3 px-4">Checker</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin inline" /> Loading…
                  </td>
                </tr>
              )}
              {!loading && vouchers.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    No vouchers yet — enter the first one as maker.
                  </td>
                </tr>
              )}
              {vouchers.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-slate-700/60 hover:bg-slate-700/30 transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-bold text-blue-400">
                    {v.voucherNumber}
                    <span className="block text-[10px] text-slate-500">
                      {new Date(v.voucherDate).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${TYPE_COLOR[v.voucherType] || TYPE_COLOR.JOURNAL}`}
                    >
                      {v.voucherType}
                    </span>
                    <span className="block text-[10px] text-slate-600 mt-0.5">
                      {v.account}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-white">
                    {fmt(v.amount)}
                  </td>
                  <td className="py-3 px-4 text-slate-300 max-w-[260px]">
                    {v.particulars}
                    {v.rejectReason && (
                      <span className="block text-[11px] text-rose-400 mt-0.5">
                        Rejected: {v.rejectReason}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-400">
                    {v.enteredBy}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-400">
                    {v.checkedBy ? (
                      <span className="text-emerald-300 font-semibold">
                        {v.checkedBy}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${
                        v.status === "POSTED"
                          ? v.postedToTreasury
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                            : "bg-sky-500/15 text-sky-300 border-sky-500/40"
                          : v.status === "REJECTED"
                            ? "bg-rose-500/15 text-rose-300 border-rose-500/40"
                            : "bg-amber-500/15 text-amber-300 border-amber-500/40 animate-pulse"
                      }`}
                    >
                      {v.status === "POSTED"
                        ? `POSTED${v.postedToTreasury ? " · LEDGER" : ""}`
                        : v.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    {v.status === "PENDING_CHECK" ? (
                      <>
                        <button
                          onClick={() => {
                            setActionFor(v);
                            setRejectReason("");
                          }}
                          className="px-2.5 py-1 bg-slate-700/60 border border-slate-600 rounded-lg text-[11px] font-bold hover:bg-slate-600 transition-colors text-slate-200"
                          title="Manager only"
                        >
                          Check & Post
                        </button>
                        <button
                          onClick={() => {
                            setActionFor(v);
                            setRejectReason("");
                          }}
                          className="px-2.5 py-1 bg-rose-500/15 text-rose-300 border border-rose-500/40 rounded-lg text-[11px] font-bold hover:bg-rose-500/25 transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className="text-slate-600 text-xs">done</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New voucher modal (maker) */}
      {showNew && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowNew(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-voucher-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl"
          >
            <h3 id="new-voucher-modal-title" className="font-bold text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-400" /> Enter voucher
              (maker)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold">
                  Type *
                </label>
                <select
                  value={newVoucher.voucherType}
                  onChange={(e) =>
                    setNewVoucher({
                      ...newVoucher,
                      voucherType: e.target.value,
                    })
                  }
                  className="mt-1 w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {["PAYMENT", "RECEIPT", "JOURNAL", "ADJUSTMENT"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  value={newVoucher.amount}
                  onChange={(e) =>
                    setNewVoucher({ ...newVoucher, amount: e.target.value })
                  }
                  className="mt-1 w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">
                Particulars *
              </label>
              <input
                value={newVoucher.particulars}
                onChange={(e) =>
                  setNewVoucher({ ...newVoucher, particulars: e.target.value })
                }
                placeholder="e.g. Advance to Acme Traders against PO-2026-014"
                className="mt-1 w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold">
                  Date
                </label>
                <input
                  type="date"
                  value={newVoucher.voucherDate}
                  onChange={(e) =>
                    setNewVoucher({
                      ...newVoucher,
                      voucherDate: e.target.value,
                    })
                  }
                  className="mt-1 w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold">
                  Account
                </label>
                <input
                  value={newVoucher.account}
                  onChange={(e) =>
                    setNewVoucher({ ...newVoucher, account: e.target.value })
                  }
                  className="mt-1 w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="px-4 py-2 text-sm font-bold text-slate-400 hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={create}
                disabled={busy}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-sm transition-all flex items-center gap-2"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit
                for check
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decide modal (manager) */}
      {actionFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setActionFor(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="action-voucher-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl"
          >
            <h3 id="action-voucher-modal-title" className="font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Review {actionFor.voucherNumber}
            </h3>
            <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-4 space-y-1.5 text-sm">
              <p className="text-white font-bold">{actionFor.particulars}</p>
              <p className="text-slate-400 font-mono">
                {actionFor.voucherType} · {actionFor.account} ·{" "}
                {new Date(actionFor.voucherDate).toLocaleDateString()}
              </p>
              <p className="text-white text-lg font-black font-mono">
                {fmt(actionFor.amount)}
              </p>
              <p className="text-[11px] text-slate-500">
                Entered by {actionFor.enteredBy} · status PENDING CHECK
              </p>
            </div>
            {actionFor.voucherType === "DEPRECIATION" && (
              <p className="text-xs text-violet-300">
                Posting books the depreciation entry against the fixed asset and
                updates accumulated depreciation.
              </p>
            )}
            {actionFor.voucherType === "PAYMENT" ||
            actionFor.voucherType === "RECEIPT" ? (
              <p className="text-xs text-slate-400">
                Posting mirrors this to the treasury ledger (OUTFLOW/INFLOW).
              </p>
            ) : null}
            <input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reject reason (required to reject — audit trail)"
              className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setActionFor(null)}
                className="px-4 py-2 text-sm font-bold text-slate-400 hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => decide("reject")}
                disabled={busy || !rejectReason.trim()}
                className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-sm transition-all"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => decide("check-post")}
                disabled={busy}
                className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-sm transition-all flex items-center gap-2"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Check &
                Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
