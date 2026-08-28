"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Siren,
  CheckCircle2,
  AlertTriangle,
  Plus,
  MessageSquareWarning,
} from "lucide-react";

const STAGE_STYLE: Record<string, string> = {
  RAISED: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  ACKNOWLEDGED: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  INVESTIGATING: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  RESOLVED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
};
const STAGES = ["RAISED", "ACKNOWLEDGED", "INVESTIGATING", "RESOLVED"];

export default function GrievanceClient() {
  const [grievances, setGrievances] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    raised: 0,
    acknowledged: 0,
    investigating: 0,
    resolved: 0,
    overdue: 0,
  });
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showRaise, setShowRaise] = useState(false);
  const [form, setForm] = useState({
    category: "",
    description: "",
    userId: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/grievances");
      const d = await res.json();
      if (!res.ok) {
        setToast(d.error || "Failed to load");
        return;
      }
      setGrievances(d.grievances || []);
      setStats(d.stats || {});
      setUsers(d.users || []);
    } catch {
      setToast("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const api = async (url: string, body: any) => {
    setSaving(true);
    try {
      const res = await fetch(url, {
        method: "PATCH",
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

  const raise = async () => {
    const res = await fetch("/api/grievances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "raise", data: form }),
    });
    const d = await res.json();
    if (!res.ok) {
      setToast(d.error || "Failed");
      return;
    }
    setToast("Grievance raised");
    setShowRaise(false);
    setForm({ category: "", description: "", userId: "" });
    fetchData();
  };

  const promptReason = (label: string): string | null => {
    const r = window.prompt(`${label} — written note (audit trail):`);
    return r === null ? null : r.trim() || null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-300 font-semibold">
            <Siren className="w-4 h-4" /> M22 — Stage-tracked with timelines
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Grievance Register
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            RAISED → ACKNOWLEDGED → INVESTIGATING → RESOLVED. Acknowledge due in
            2 days, resolution due in 14 — overdue rows flagged red.
          </p>
        </div>
        <button
          onClick={() => setShowRaise(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" /> Raise grievance
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-white" },
          { label: "Raised", value: stats.raised, color: "text-rose-300" },
          {
            label: "Acknowledged",
            value: stats.acknowledged,
            color: "text-amber-300",
          },
          {
            label: "Investigating",
            value: stats.investigating,
            color: "text-sky-300",
          },
          {
            label: "Resolved",
            value: stats.resolved,
            color: "text-emerald-300",
          },
          { label: "SLA overdue", value: stats.overdue, color: "text-red-400" },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4"
          >
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-slate-400 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {grievances.map((g) => {
          const idx = STAGES.indexOf(g.stage);
          const overdue = g.ackOverdue || g.resolveOverdue;
          return (
            <div
              key={g.id}
              className={`rounded-2xl border p-4 space-y-3 ${overdue ? "bg-red-950/30 border-red-700/50" : "bg-slate-800/60 border-slate-700/60"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white">
                    {g.grievanceNumber}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STAGE_STYLE[g.stage] || ""}`}
                  >
                    {g.stage}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700/40 text-slate-300">
                    {g.category}
                  </span>
                  {overdue && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> TIMELINE OVERDUE{" "}
                      {g.ackOverdue ? "· ack" : ""}
                      {g.resolveOverdue ? "· resolve" : ""}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  {g.user?.name || "—"} · raised{" "}
                  {new Date(g.raisedAt).toLocaleDateString()}
                </div>
              </div>
              <p className="text-sm text-slate-300">{g.description}</p>
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                {STAGES.map((s, i) => (
                  <div key={s} className="flex items-center gap-1">
                    <span
                      className={`px-2 py-0.5 rounded-full border ${i <= idx ? "bg-indigo-500/20 text-indigo-200 border-indigo-500/40" : "bg-slate-800/40 text-slate-500 border-slate-700"}`}
                    >
                      {s}
                    </span>
                    {i < STAGES.length - 1 && (
                      <span className="text-slate-600">→</span>
                    )}
                  </div>
                ))}
                <span className="ml-2 text-slate-500">
                  {g.ackDue &&
                    g.stage === "RAISED" &&
                    `ack due ${new Date(g.ackDue).toLocaleDateString()}`}
                  {(g.stage === "ACKNOWLEDGED" ||
                    g.stage === "INVESTIGATING") &&
                    `resolve due ${new Date(g.resolveDue).toLocaleDateString()}`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] text-slate-500">
                  {g.acknowledgedAt &&
                    `Ack ${new Date(g.acknowledgedAt).toLocaleDateString()} ${g.acknowledgedBy || ""}`}
                  {g.investigatedAt &&
                    ` · Inv ${new Date(g.investigatedAt).toLocaleDateString()} ${g.investigatedBy || ""}`}
                  {g.resolvedAt &&
                    ` · Res ${new Date(g.resolvedAt).toLocaleDateString()} ${g.resolvedBy || ""}`}
                </div>
                <div className="flex gap-2">
                  {g.stage === "RAISED" && (
                    <button
                      onClick={() =>
                        api(`/api/grievances/${g.id}`, {
                          action: "acknowledge",
                          data: {},
                        })
                      }
                      disabled={saving}
                      className="rounded-lg bg-amber-600/80 hover:bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Acknowledge
                    </button>
                  )}
                  {g.stage === "ACKNOWLEDGED" && (
                    <button
                      onClick={() =>
                        api(`/api/grievances/${g.id}`, {
                          action: "start-investigation",
                          data: {},
                        })
                      }
                      disabled={saving}
                      className="rounded-lg bg-sky-600/80 hover:bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Start investigation
                    </button>
                  )}
                  {g.stage === "INVESTIGATING" && (
                    <button
                      onClick={() => {
                        const note = promptReason("Resolution");
                        if (note !== null)
                          api(`/api/grievances/${g.id}`, {
                            action: "resolve",
                            data: { reason: note },
                          });
                      }}
                      disabled={saving}
                      className="rounded-lg bg-emerald-600/80 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                    </button>
                  )}
                </div>
              </div>
              {g.resolution && (
                <p className="text-xs text-slate-400 bg-slate-900/40 rounded-lg px-3 py-2">
                  Resolution: {g.resolution}
                </p>
              )}
            </div>
          );
        })}
        {grievances.length === 0 && (
          <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-8 text-center text-slate-400">
            No grievances on the register.
          </div>
        )}
      </div>

      {showRaise && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setShowRaise(false)}
        >
          <div
            className="rounded-2xl bg-slate-800 border border-slate-700 p-6 w-full max-w-md space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-white flex items-center gap-2">
              <MessageSquareWarning className="w-4 h-4 text-rose-300" /> Raise
              grievance
            </h2>
            <input
              placeholder="Category (Harassment, Wages, Work conditions, Leave, Other…)"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <textarea
              placeholder="Describe the grievance"
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <select
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">Self (me)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.employeeNumber || ""}
                </option>
              ))}
            </select>
            <div className="flex gap-2 pt-2">
              <button
                onClick={raise}
                disabled={saving}
                className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Raise
              </button>
              <button
                onClick={() => setShowRaise(false)}
                className="rounded-xl bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 rounded-xl bg-slate-800 border border-slate-600 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
