"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  X,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Siren,
  CalendarDays,
} from "lucide-react";

export default function DpmClient() {
  const [rows, setRows] = useState<any[]>([]);
  const [blockers, setBlockers] = useState<any[]>([]);
  const [overdue, setOverdue] = useState<any[]>([]);
  const [today, setToday] = useState("");
  const [loading, setLoading] = useState(true);
  const [isManager, setIsManager] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockForm, setBlockForm] = useState({
    description: "",
    ownerDept: "production",
    dueDate: "",
    workOrderId: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const [r, me] = await Promise.all([
        fetch("/api/dpm"),
        fetch("/api/auth/me"),
      ]);
      if (r.ok) {
        const d = await r.json();
        setRows(d.rows || []);
        setBlockers(d.blockers || []);
        setOverdue(d.overdueCandidates || []);
        setToday(d.today || "");
      }
      if (me.ok) {
        const m = await me.json();
        setIsManager(m.user?.level === "MANAGER" || m.user?.isOwner === true);
      }
    } catch (e) {
      logClientError(e, "DpmClient");
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
      const res = await fetch("/api/dpm", {
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

  const addBlock = async () => {
    const ok = await api({ action: "addBlock", data: blockForm });
    if (ok) {
      setBlockOpen(false);
      setBlockForm({
        description: "",
        ownerDept: "production",
        dueDate: "",
        workOrderId: "",
      });
    }
  };

  const resolveBlock = async (b: any) => {
    const reason = window.prompt(
      `Resolve blocker: "${b.description.slice(0, 60)}…"`,
    );
    if (reason === null) return;
    await api({ action: "resolveBlock", data: { id: b.id, reason } });
  };

  const escalate = async (b: any) => {
    const reason = window.prompt(
      `Escalate overdue blocker: "${b.description.slice(0, 60)}…" — this creates an escalation entry.`,
    );
    if (reason === null) return;
    await api({ action: "escalate", data: { id: b.id, reason } });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  const openBlocks = blockers.filter((b) => b.status === "OPEN");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-300 font-semibold">
            <CalendarDays className="w-4 h-4" /> Daily Production Meeting ·{" "}
            {today}
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">DPM Board</h1>
          <p className="text-sm text-slate-400 mt-1">
            Daily plan vs actual per work order — blockers carry an owner
            department and due date.
          </p>
        </div>
        {isManager && (
          <button
            onClick={() => setBlockOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 px-4 py-2 text-sm font-medium hover:bg-indigo-500/30 transition-colors"
          >
            <Plus className="w-4 h-4" /> Raise Blocker
          </button>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4">
          <div className="text-2xl font-bold text-white">{rows.length}</div>
          <div className="text-xs text-slate-400 mt-1">WOs on plan</div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4">
          <div className="text-2xl font-bold text-sky-300">
            {rows.filter((r) => r.inScopeToday).length}
          </div>
          <div className="text-xs text-slate-400 mt-1">In today's plan</div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4">
          <div className="text-2xl font-bold text-amber-300">
            {openBlocks.length}
          </div>
          <div className="text-xs text-slate-400 mt-1">Open blockers</div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4">
          <div
            className={`text-2xl font-bold ${overdue.length ? "text-rose-300" : "text-white"}`}
          >
            {overdue.length}
          </div>
          <div className="text-xs text-slate-400 mt-1">Overdue → escalate</div>
        </div>
      </div>

      {/* Plan vs actual */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/60 text-xs uppercase tracking-wider text-slate-400 font-semibold">
          Daily plan vs actual per WO
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
                <th className="px-4 py-3">WO</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Today's plan</th>
                <th className="px-4 py-3">Produced today</th>
                <th className="px-4 py-3">Scrap</th>
                <th className="px-4 py-3">% of plan</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-slate-200">
                    {r.woNumber}
                  </td>
                  <td className="px-4 py-3 text-white">{r.productName}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {r.dailyPlan.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-100 font-semibold">
                    {r.producedToday.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {r.scrapToday > 0 ? (
                      <span className="text-rose-300 font-semibold">
                        {r.scrapToday}
                      </span>
                    ) : (
                      <span className="text-slate-500">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${r.pctToday >= 100 ? "bg-emerald-400" : r.pctToday >= 70 ? "bg-sky-400" : "bg-rose-400"}`}
                          style={{ width: `${Math.min(100, r.pctToday)}%` }}
                        />
                      </div>
                      <span
                        className={`text-xs font-bold ${r.pctToday >= 100 ? "text-emerald-300" : r.pctToday >= 70 ? "text-sky-300" : "text-rose-300"}`}
                      >
                        {r.pctToday}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border ${r.status === "IN_PROGRESS" ? "bg-blue-500/10 text-blue-300 border-blue-500/40" : "bg-slate-500/10 text-slate-400 border-slate-500/30"}`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No active work orders.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Blockers */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/60 text-xs uppercase tracking-wider text-slate-400 font-semibold">
          Blockers ({openBlocks.length} open)
        </div>
        <div className="divide-y divide-slate-800/60">
          {openBlocks.map((b) => {
            const isOverdue = b.dueDate && new Date(b.dueDate) < new Date();
            return (
              <div
                key={b.id}
                className="p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {isOverdue ? (
                      <Siren className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <span className="text-sm text-slate-200">
                      {b.description}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Owner:{" "}
                    <span className="text-slate-300 font-medium">
                      {b.ownerDept}
                    </span>
                    {b.workOrder && (
                      <span className="ml-2 font-mono">
                        {b.workOrder.woNumber}
                      </span>
                    )}
                    {b.dueDate && (
                      <span
                        className={`ml-2 ${isOverdue ? "text-rose-400 font-semibold" : ""}`}
                      >
                        due {new Date(b.dueDate).toLocaleDateString()}
                        {isOverdue ? " · OVERDUE" : ""}
                      </span>
                    )}
                    <span className="ml-2">· raised by {b.raisedBy}</span>
                  </div>
                </div>
                {isManager && (
                  <div className="flex items-center gap-2 shrink-0">
                    {isOverdue && (
                      <button
                        onClick={() => escalate(b)}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 border border-rose-500/40 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20 transition-colors"
                      >
                        <Siren className="w-3.5 h-3.5" /> Escalate
                      </button>
                    )}
                    <button
                      onClick={() => resolveBlock(b)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/40 px-2.5 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {openBlocks.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">
              No open blockers — clean board.
            </div>
          )}
        </div>
      </div>

      {/* Raise blocker modal */}
      {blockOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setBlockOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700/60 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Raise DPM Blocker
              </h2>
              <button
                onClick={() => setBlockOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="text-xs text-slate-400">Description *</label>
              <textarea
                value={blockForm.description}
                onChange={(e) =>
                  setBlockForm({ ...blockForm, description: e.target.value })
                }
                rows={3}
                placeholder="e.g. Raw material for WO-2026-007 not received"
                className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">
                  Owner department *
                </label>
                <select
                  value={blockForm.ownerDept}
                  onChange={(e) =>
                    setBlockForm({ ...blockForm, ownerDept: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
                >
                  {[
                    "production",
                    "quality",
                    "supply",
                    "maintenance",
                    "engineering",
                    "commercial",
                    "hr",
                  ].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Due date</label>
                <input
                  type="date"
                  value={blockForm.dueDate}
                  onChange={(e) =>
                    setBlockForm({ ...blockForm, dueDate: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
            <button
              onClick={addBlock}
              disabled={saving || !blockForm.description}
              className="w-full rounded-xl bg-indigo-500 text-white text-sm font-semibold py-2.5 hover:bg-indigo-400 disabled:opacity-40 transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                "Raise Blocker"
              )}
            </button>
          </div>
        </div>
      )}

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
