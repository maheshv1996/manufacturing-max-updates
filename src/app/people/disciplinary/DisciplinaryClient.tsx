"use client";

import PageHeader from "@/app/components/shared/PageHeader";

import {useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Gavel,
  Plus,
  AlertTriangle,
  CalendarDays,
  Scale,
  Users
} from "lucide-react";

const STAGE_STYLE: Record<string, string> = {
  NOTICE: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  HEARING: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  DECISION: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  CLOSED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
};
const DECISION_STYLE: Record<string, string> = {
  NO_ACTION: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  WARNING: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  FINAL_WARNING: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  SUSPENSION: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  TERMINATION: "bg-red-600/30 text-red-300 border-red-500/40",
};
const STAGES = ["NOTICE", "HEARING", "DECISION", "CLOSED"];
const DECISIONS = [
  "NO_ACTION",
  "WARNING",
  "FINAL_WARNING",
  "SUSPENSION",
  "TERMINATION",
];

export default function DisciplinaryClient() {
  const [cases, setCases] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    notice: 0,
    hearing: 0,
    decision: 0,
    closed: 0,
    overdue: 0,
  });
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showOpen, setShowOpen] = useState(false);
  const [form, setForm] = useState({
    userId: "",
    category: "",
    description: "",
    hearingDate: "",
  });
  const [decisionFor, setDecisionFor] = useState<any>(null);
  const [decision, setDecision] = useState("WARNING");
  const [decisionNote, setDecisionNote] = useState("");
  const [hearingFor, setHearingFor] = useState<any>(null);
  const [hearingDate, setHearingDate] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/disciplinary");
      const d = await res.json();
      if (!res.ok) {
        setToast(d.error || "Failed to load");
        return;
      }
      setCases(d.cases || []);
      setStats(d.stats || {});
      setUsers(d.users || []);
      setCategories(d.categories || []);
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

  const openCase = async () => {
    const res = await fetch("/api/disciplinary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "open-case", data: form }),
    });
    const d = await res.json();
    if (!res.ok) {
      setToast(d.error || "Failed");
      return;
    }
    setToast("Case opened");
    setShowOpen(false);
    setForm({ userId: "", category: "", description: "", hearingDate: "" });
    fetchData();
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
            <Gavel className="w-4 h-4" /> M22 — Stage-tracked with timelines
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Disciplinary Register
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            NOTICE → HEARING → DECISION → CLOSED. Hearing due in 7 days of
            notice, decision due in 7 days of hearing — overdue rows flagged
            red.
          </p>
        </div>
        <button
          onClick={() => setShowOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" /> Open case
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-white" },
          {
            label: "Notice issued",
            value: stats.notice,
            color: "text-rose-300",
          },
          { label: "Hearing", value: stats.hearing, color: "text-amber-300" },
          { label: "Decision", value: stats.decision, color: "text-sky-300" },
          { label: "Closed", value: stats.closed, color: "text-emerald-300" },
          {
            label: "Timeline overdue",
            value: stats.overdue,
            color: "text-red-400",
          },
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
        {cases.map((c) => {
          const idx = STAGES.indexOf(c.stage);
          const overdue = c.hearingOverdue || c.decisionOverdue;
          return (
            <div
              key={c.id}
              className={`rounded-2xl border p-4 space-y-3 ${overdue ? "bg-red-950/30 border-red-700/50" : "bg-slate-800/60 border-slate-700/60"}`}
            >
      <PageHeader
        title="Disciplinary"
        description="Roster, attendance, leave and workforce operations."
        icon={<Users className="w-6 h-6" />}
        iconTone="violet"
      />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white">
                    {c.caseNumber}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STAGE_STYLE[c.stage] || ""}`}
                  >
                    {c.stage}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700/40 text-slate-300">
                    {c.category}
                  </span>
                  {c.decision && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${DECISION_STYLE[c.decision] || ""}`}
                    >
                      {c.decision}
                    </span>
                  )}
                  {overdue && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> TIMELINE OVERDUE{" "}
                      {c.hearingOverdue ? "· hearing" : ""}
                      {c.decisionOverdue ? "· decision" : ""}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  {c.user?.name || "—"} · notice{" "}
                  {new Date(c.noticeIssuedAt).toLocaleDateString()}
                </div>
              </div>
              <p className="text-sm text-slate-300">{c.description}</p>
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
                  {c.stage === "NOTICE" &&
                    `hearing due ${new Date(c.hearingDue).toLocaleDateString()}`}
                  {(c.stage === "HEARING" || c.stage === "DECISION") &&
                    `decision due ${new Date(c.decisionDue).toLocaleDateString()}`}
                  {c.hearingDate &&
                    c.stage === "HEARING" &&
                    ` · hearing ${new Date(c.hearingDate).toLocaleDateString()}`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] text-slate-500">
                  {c.hearingHeldAt &&
                    `Hearing ${new Date(c.hearingHeldAt).toLocaleDateString()} `}
                  {c.decidedAt &&
                    ` · Decision ${new Date(c.decidedAt).toLocaleDateString()} ${c.decidedBy || ""}`}
                  {c.closedAt &&
                    ` · Closed ${new Date(c.closedAt).toLocaleDateString()} ${c.closedBy || ""}`}
                </div>
                <div className="flex gap-2">
                  {c.stage === "NOTICE" && (
                    <button
                      onClick={() => {
                        setHearingFor(c);
                        setHearingDate(new Date().toISOString().slice(0, 10));
                      }}
                      disabled={saving}
                      className="rounded-lg bg-amber-600/80 hover:bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white flex items-center gap-1"
                    >
                      <CalendarDays className="w-3.5 h-3.5" /> Schedule hearing
                    </button>
                  )}
                  {c.stage === "HEARING" && (
                    <button
                      onClick={() => {
                        setDecisionFor(c);
                        setDecision("WARNING");
                        setDecisionNote("");
                      }}
                      disabled={saving}
                      className="rounded-lg bg-sky-600/80 hover:bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white flex items-center gap-1"
                    >
                      <Scale className="w-3.5 h-3.5" /> Record decision
                    </button>
                  )}
                  {c.stage === "DECISION" && (
                    <button
                      onClick={() =>
                        api(`/api/disciplinary/${c.id}`, {
                          action: "close",
                          data: {},
                        })
                      }
                      disabled={saving}
                      className="rounded-lg bg-emerald-600/80 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Close case
                    </button>
                  )}
                </div>
              </div>
              {c.decisionNote && (
                <p className="text-xs text-slate-400 bg-slate-900/40 rounded-lg px-3 py-2">
                  Decision note: {c.decisionNote}
                </p>
              )}
            </div>
          );
        })}
        {cases.length === 0 && (
          <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-8 text-center text-slate-400">
            No disciplinary cases on the register.
          </div>
        )}
      </div>

      {showOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setShowOpen(false)}
        >
          <div
            className="rounded-2xl bg-slate-800 border border-slate-700 p-6 w-full max-w-md space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-white">Open disciplinary case</h2>
            <select
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">Employee…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.employeeNumber || ""}
                </option>
              ))}
            </select>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">Category…</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <textarea
              placeholder="Describe the misconduct"
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <input
              type="date"
              value={form.hearingDate}
              onChange={(e) =>
                setForm({ ...form, hearingDate: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={openCase}
                disabled={saving}
                className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Open case
              </button>
              <button
                onClick={() => setShowOpen(false)}
                className="rounded-xl bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {hearingFor && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setHearingFor(null)}
        >
          <div
            className="rounded-2xl bg-slate-800 border border-slate-700 p-6 w-full max-w-sm space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-white">
              Schedule hearing — {hearingFor.caseNumber}
            </h2>
            <input
              type="date"
              value={hearingDate}
              onChange={(e) => setHearingDate(e.target.value)}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={async () => {
                  const ok = await api(`/api/disciplinary/${hearingFor.id}`, {
                    action: "schedule-hearing",
                    data: { hearingDate },
                  });
                  if (ok) setHearingFor(null);
                }}
                disabled={saving}
                className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Schedule
              </button>
              <button
                onClick={() => setHearingFor(null)}
                className="rounded-xl bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {decisionFor && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setDecisionFor(null)}
        >
          <div
            className="rounded-2xl bg-slate-800 border border-slate-700 p-6 w-full max-w-sm space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-white">
              Record decision — {decisionFor.caseNumber}
            </h2>
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              {DECISIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <textarea
              placeholder="Decision note (mandatory)"
              rows={3}
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={async () => {
                  const ok = await api(`/api/disciplinary/${decisionFor.id}`, {
                    action: "record-decision",
                    data: { decision, reason: decisionNote },
                  });
                  if (ok) setDecisionFor(null);
                }}
                disabled={saving}
                className="flex-1 rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Record
              </button>
              <button
                onClick={() => setDecisionFor(null)}
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
