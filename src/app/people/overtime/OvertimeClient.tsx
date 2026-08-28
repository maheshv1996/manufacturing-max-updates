"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, X, Clock, CheckCircle2, XCircle, Wallet } from "lucide-react";

export default function OvertimeClient() {
  const [requests, setRequests] = useState<any[]>([]);
  const [pending, setPending] = useState(0);
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({ date: "", hours: "", reason: "" });

  const fetchData = useCallback(async () => {
    try {
      const [r, me] = await Promise.all([
        fetch("/api/overtime"),
        fetch("/api/auth/me"),
      ]);
      if (r.ok) {
        const d = await r.json();
        setRequests(d.requests || []);
        setPending(d.pending || 0);
        setIsManager(d.isManager);
      }
      if (me.ok) {
        const m = await me.json();
        setIsManager(m.user?.level === "MANAGER" || m.user?.isOwner === true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const api = async (body: any): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch("/api/overtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) {
        setToast(d.error || "Action failed");
        return false;
      }
      setToast("Saved");
      await fetchData();
      return true;
    } catch {
      setToast("Network error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitRequest = async () => {
    const ok = await api({ action: "request", data: form });
    if (ok) setForm({ date: "", hours: "", reason: "" });
  };

  const decide = async (
    id: string,
    action: "approve" | "reject",
    name: string,
  ) => {
    const reason = window.prompt(
      `${action === "approve" ? "Approve" : "Reject"} overtime for ${name}? Reason (audit trail):`,
    );
    if (reason === null) return;
    await api({ action, data: { id, reason } });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  const approvedHours = requests
    .filter((r) => r.status === "APPROVED")
    .reduce((a, r) => a + r.hours, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-300 font-semibold">
            <Clock className="w-4 h-4" /> Production → HR interlink
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Overtime Approval
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Floor requests overtime → manager approves → approved hours flow
            into payroll at 1.5×.
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4">
          <div className="text-2xl font-bold text-white">{requests.length}</div>
          <div className="text-xs text-slate-400 mt-1">Total requests</div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4">
          <div
            className={`text-2xl font-bold ${pending ? "text-amber-300" : "text-white"}`}
          >
            {pending}
          </div>
          <div className="text-xs text-slate-400 mt-1">Pending approval</div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4">
          <div className="text-2xl font-bold text-emerald-300">
            {approvedHours}h
          </div>
          <div className="text-xs text-slate-400 mt-1">Approved → payroll</div>
        </div>
      </div>

      {/* Request form */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-5">
        <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3 flex items-center gap-2">
          <Wallet className="w-3.5 h-3.5" /> Request overtime
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-400">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Hours</label>
            <input
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
              className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Reason *</label>
            <input
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="e.g. Customer rush order WO-2026-007"
              className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
            />
          </div>
        </div>
        <button
          onClick={submitRequest}
          disabled={saving || !form.date || !form.hours || !form.reason}
          className="mt-4 rounded-xl bg-indigo-500 text-white text-sm font-semibold px-5 py-2.5 hover:bg-indigo-400 disabled:opacity-40 transition-colors"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : (
            "Submit OT Request"
          )}
        </button>
      </div>

      {/* Requests table */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Hours</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                >
                  <td className="px-4 py-3 text-white">
                    {r.user?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {new Date(r.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-100">
                    {r.hours}h
                  </td>
                  <td className="px-4 py-3 text-slate-400 max-w-[280px] truncate">
                    {r.reason}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "PENDING" && (
                      <span className="text-xs rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/40 px-2 py-1">
                        PENDING
                      </span>
                    )}
                    {r.status === "APPROVED" && (
                      <span className="inline-flex items-center gap-1 text-xs rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/40 px-2 py-1">
                        <CheckCircle2 className="w-3 h-3" /> APPROVED
                      </span>
                    )}
                    {r.status === "REJECTED" && (
                      <span className="inline-flex items-center gap-1 text-xs rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/40 px-2 py-1">
                        <XCircle className="w-3 h-3" /> REJECTED
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {r.status === "PENDING" && isManager && (
                        <>
                          <button
                            onClick={() =>
                              decide(r.id, "approve", r.user?.name || "")
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/40 px-2.5 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Approve
                          </button>
                          <button
                            onClick={() =>
                              decide(r.id, "reject", r.user?.name || "")
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 border border-rose-500/40 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20 transition-colors"
                          >
                            <XCircle className="w-3 h-3" /> Reject
                          </button>
                        </>
                      )}
                      {r.status !== "PENDING" && r.approvedByName && (
                        <span className="text-[11px] text-slate-500">
                          {r.approvedByName}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No overtime requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Approved hours are summed at payslip generation (monthly) and paid at
        1.5× the hourly rate (gross ÷ 208).
      </p>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-800 border border-slate-600/60 px-4 py-3 text-sm text-white shadow-xl">
          {toast}
          <button
            onClick={() => setToast(null)}
            className="ml-3 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5 inline" />
          </button>
        </div>
      )}
    </div>
  );
}
