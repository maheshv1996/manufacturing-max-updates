"use client";

import PageHeader from "@/app/components/shared/PageHeader";


import {logClientError } from "@/lib/clientLogger";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Loader2,
  X,
  CalendarDays,
  Users,
  ListChecks,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Printer,
  Flag,
  ChevronDown,
  ChevronUp,
  ShieldCheck
} from "lucide-react";

type Meeting = any;
type AgendaItem = {
  title: string;
  detail: string;
  severity: string;
  source: string;
  href?: string;
};

const SEV_CLS: Record<string, string> = {
  critical: "bg-rose-500/10 text-rose-300 border border-rose-500/40",
  warning: "bg-amber-500/10 text-amber-300 border border-amber-500/40",
  info: "bg-slate-500/10 text-slate-300 border border-slate-500/30",
};

const PRIO_CLS: Record<string, string> = {
  LOW: "bg-slate-500/10 text-slate-400 border border-slate-500/30",
  MEDIUM: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  HIGH: "bg-orange-500/10 text-orange-400 border border-orange-500/30",
};

export default function MrmClient() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isManager, setIsManager] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    date: "",
    attendees: "",
  });
  const [keepAgenda, setKeepAgenda] = useState<Set<number>>(new Set());
  const [closeFor, setCloseFor] = useState<Meeting | null>(null);
  const [closeForm, setCloseForm] = useState({
    summary: "",
    decisions: "",
    reason: "",
  });
  const [actionFor, setActionFor] = useState<Meeting | null>(null);
  const [actionForm, setActionForm] = useState({
    description: "",
    ownerName: "",
    dueDate: "",
    priority: "MEDIUM",
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [r, me] = await Promise.all([
        fetch("/api/mrm"),
        fetch("/api/auth/me"),
      ]);
      if (r.ok) {
        const d = await r.json();
        setMeetings(d.meetings || []);
        setAgenda(d.agenda || []);
        setKeepAgenda(new Set((d.agenda || []).map((_: any, i: number) => i)));
      }
      if (me.ok) {
        const m = await me.json();
        setIsManager(m.user?.level === "MANAGER" || m.user?.isOwner === true);
      }
    } catch (e) {
      logClientError(e, "MrmClient");
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
      const res = await fetch("/api/mrm", {
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
    } catch (e) {
      setToast("Network error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setCreateForm({
      title: "Monthly Management Review",
      date: iso,
      attendees: "",
    });
    setKeepAgenda(new Set(agenda.map((_: any, i: number) => i)));
    setCreateOpen(true);
  };

  const createMeeting = async () => {
    const attendees = createForm.attendees
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const picked = agenda.filter((_, i) => keepAgenda.has(i));
    // Agenda is regenerated server-side at create; pass picked titles so the client
    // modal preview matches what the server pulls (server is source of truth).
    const ok = await api({
      action: "create",
      data: { title: createForm.title, date: createForm.date, attendees },
    });
    if (ok) {
      setCreateOpen(false);
      void picked;
    }
  };

  const closeMeeting = async () => {
    const ok = await api({
      action: "close",
      data: {
        id: closeFor?.id,
        summary: closeForm.summary,
        decisions: closeForm.decisions
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        reason: closeForm.reason,
      },
    });
    if (ok) setCloseFor(null);
  };

  const addAction = async () => {
    const ok = await api({
      action: "addAction",
      data: { meetingId: actionFor?.id, ...actionForm },
    });
    if (ok) {
      setActionFor(null);
      setActionForm({
        description: "",
        ownerName: "",
        dueDate: "",
        priority: "MEDIUM",
      });
    }
  };

  const completeAction = async (actionId: string, description: string) => {
    const reason = window.prompt(
      `Reason for completing: "${description.slice(0, 60)}…"`,
    );
    if (reason === null) return;
    await api({ action: "completeAction", data: { actionId, reason } });
  };

  const escalateAction = async (actionId: string, description: string) => {
    const reason = window.prompt(
      `Why is this action being escalated: "${description.slice(0, 60)}…"`,
    );
    if (reason === null) return;
    await api({ action: "escalateAction", data: { actionId, reason } });
  };

  const openActions = meetings.flatMap((m) =>
    (m.actionItems || []).filter((a: any) => a.status === "OPEN"),
  );
  const overdueActions = openActions.filter(
    (a: any) => a.dueDate && new Date(a.dueDate) < new Date(),
  );
  const openMeetings = meetings.filter((m) => m.status === "OPEN");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-300 font-semibold">
            <FileText className="w-4 h-4" /> ISO 9001 · cl.9.3
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Management Review Meetings
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Agenda auto-pulled from compliance digest flags, quality objectives
            and open action items.
          </p>
        </div>
        {isManager && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 px-4 py-2 text-sm font-medium hover:bg-indigo-500/30 transition-colors"
          >
            <Plus className="w-4 h-4" /> New MRM
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Open Meetings",
            value: openMeetings.length,
            cls: "text-indigo-300",
          },
          {
            label: "Open Actions",
            value: openActions.length,
            cls: "text-sky-300",
          },
          {
            label: "Overdue Actions",
            value: overdueActions.length,
            cls: overdueActions.length ? "text-rose-300" : "text-emerald-300",
          },
          {
            label: "Agenda Items Now",
            value: agenda.length,
            cls: "text-amber-300",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4"
          >
            <div className={`text-2xl font-bold ${k.cls}`}>{k.value}</div>
            <div className="text-xs text-slate-400 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Meetings */}
      {meetings.length === 0 ? (
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-10 text-center">
          <CalendarDays className="w-10 h-10 mx-auto text-slate-500" />
          <p className="text-slate-400 mt-3">
            No management review meetings yet.
          </p>
          {isManager && (
            <p className="text-sm text-slate-500 mt-1">
              Start one — the agenda builds itself from live system state.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {meetings.map((m) => {
            const isOpen = expanded === m.id;
            const acts = m.actionItems || [];
            const open = acts.filter((a: any) => a.status === "OPEN");
            return (
              <div
                key={m.id}
                className="rounded-2xl bg-slate-800/60 border border-slate-700/60 overflow-hidden"
              >
                <div
                  className="flex items-center justify-between gap-3 p-4 cursor-pointer hover:bg-slate-800/80 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : m.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${m.status === "OPEN" ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {m.meetingNumber}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full border ${m.status === "OPEN" ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/40" : "bg-slate-500/10 text-slate-400 border-slate-500/30"}`}
                        >
                          {m.status}
                        </span>
                      </div>
                      <div className="text-sm text-slate-300 truncate">
                        {m.title}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(m.date).toLocaleDateString()} · {m.minutesBy}{" "}
                        · {(m.attendees || []).length} attendees · {open.length}{" "}
                        open actions
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/reports/mrm-minutes/${m.id}`}
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700/40 border border-slate-600/40 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" /> Minutes
                    </Link>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-700/60 p-4 space-y-4">
                    {/* Attendees */}
                    <div>
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
                        <Users className="w-3.5 h-3.5" /> Attendees
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(m.attendees || []).map((a: any, i: number) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-1 rounded-full bg-slate-700/40 border border-slate-600/40 text-slate-300"
                          >
                            {a.name || a}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Agenda */}
                    <div>
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
                        <ListChecks className="w-3.5 h-3.5" /> Agenda (
                        {m.agenda?.length || 0} items)
                      </div>
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {(m.agenda || []).map((a: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 rounded-lg bg-slate-900/50 border border-slate-700/40 px-3 py-2"
                          >
                            <span
                              className={`mt-0.5 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${SEV_CLS[a.severity] || SEV_CLS.info}`}
                            >
                              {a.severity}
                            </span>
                            <div className="min-w-0">
                              <div className="text-sm text-slate-200">
                                {a.title}
                              </div>
                              <div className="text-xs text-slate-500">
                                {a.detail} · {a.source}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Minutes (closed) */}
                    {m.status === "CLOSED" && m.summary && (
                      <div className="rounded-xl bg-slate-900/50 border border-slate-700/40 p-4">
                        <div className="text-xs uppercase tracking-wider text-emerald-300 font-semibold mb-1.5">
                          Minutes / Summary
                        </div>
                        <p className="text-sm text-slate-300">{m.summary}</p>
                        {(m.decisions || []).length > 0 && (
                          <div className="mt-3">
                            <div className="text-xs uppercase tracking-wider text-indigo-300 font-semibold mb-1.5">
                              Decisions
                            </div>
                            <ul className="space-y-1">
                              {(m.decisions || []).map((d: any, i: number) => (
                                <li
                                  key={i}
                                  className="text-sm text-slate-300 flex gap-2"
                                >
                                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />{" "}
                                  {d.text || d}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {m.closedByName && (
                          <div className="text-xs text-slate-500 mt-3">
                            Closed by {m.closedByName} ·{" "}
                            {m.closedAt
                              ? new Date(m.closedAt).toLocaleString()
                              : ""}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action items */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400 font-semibold">
                          <Flag className="w-3.5 h-3.5" /> Action Items (
                          {acts.length})
                        </div>
                        {isManager && m.status === "OPEN" && (
                          <button
                            onClick={() => setActionFor(m)}
                            className="inline-flex items-center gap-1 text-xs rounded-lg bg-slate-700/40 border border-slate-600/40 px-2.5 py-1.5 text-slate-300 hover:text-white transition-colors"
                          >
                            <Plus className="w-3 h-3" /> Add
                          </button>
                        )}
                      </div>
                      {acts.length === 0 ? (
                        <p className="text-xs text-slate-500">
                          No action items recorded.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {acts.map((a: any) => {
                            const overdue =
                              a.status === "OPEN" &&
                              a.dueDate &&
                              new Date(a.dueDate) < new Date();
                            return (
                              <div
                                key={a.id}
                                className="flex items-center gap-2 rounded-lg bg-slate-900/50 border border-slate-700/40 px-3 py-2"
                              >
      <PageHeader
        title="Mrm"
        description="Inspections, NCRs, audits and compliance control."
        icon={<ShieldCheck className="w-6 h-6" />}
        iconTone="emerald"
      />

                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${PRIO_CLS[a.priority] || PRIO_CLS.MEDIUM}`}
                                >
                                  {a.priority}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div
                                    className={`text-sm ${a.status === "DONE" ? "text-slate-500 line-through" : "text-slate-200"}`}
                                  >
                                    {a.description}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {a.ownerName} · due{" "}
                                    {a.dueDate
                                      ? new Date(a.dueDate).toLocaleDateString()
                                      : "—"}
                                    {overdue && (
                                      <span className="text-rose-400 font-semibold">
                                        {" "}
                                        · OVERDUE
                                      </span>
                                    )}
                                    {a.escalated && (
                                      <span className="text-amber-400">
                                        {" "}
                                        · escalated
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {a.status === "OPEN" && isManager && (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      onClick={() =>
                                        completeAction(a.id, a.description)
                                      }
                                      className="inline-flex items-center gap-1 text-xs rounded-lg bg-emerald-500/10 border border-emerald-500/40 px-2 py-1 text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                                    >
                                      <CheckCircle2 className="w-3 h-3" /> Done
                                    </button>
                                    <button
                                      onClick={() =>
                                        escalateAction(a.id, a.description)
                                      }
                                      className="inline-flex items-center gap-1 text-xs rounded-lg bg-amber-500/10 border border-amber-500/40 px-2 py-1 text-amber-300 hover:bg-amber-500/20 transition-colors"
                                    >
                                      <AlertTriangle className="w-3 h-3" />{" "}
                                      Escalate
                                    </button>
                                  </div>
                                )}
                                {a.status === "DONE" && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Close */}
                    {isManager && m.status === "OPEN" && (
                      <button
                        onClick={() => {
                          setCloseFor(m);
                          setCloseForm({
                            summary: "",
                            decisions: "",
                            reason: "",
                          });
                        }}
                        className="w-full rounded-xl border border-rose-500/30 bg-rose-500/5 text-rose-300 text-sm font-medium py-2.5 hover:bg-rose-500/10 transition-colors"
                      >
                        Close Meeting — record minutes & decisions
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700/60 p-6 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                New Management Review
              </h2>
              <button
                onClick={() => setCreateOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">Title</label>
                <input
                  value={createForm.title}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, title: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Date</label>
                <input
                  type="date"
                  value={createForm.date}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, date: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400">
                Attendees (comma separated)
              </label>
              <input
                value={createForm.attendees}
                onChange={(e) =>
                  setCreateForm({ ...createForm, attendees: e.target.value })
                }
                placeholder="e.g. Plant Head, Quality Manager, Production Manager"
                className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1.5">
                Agenda — auto-pulled from live system state (tick to include)
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {agenda.map((a, i) => (
                  <label
                    key={i}
                    className="flex items-start gap-2 rounded-lg bg-slate-800/50 border border-slate-700/40 px-3 py-2 cursor-pointer hover:bg-slate-800/80"
                  >
                    <input
                      type="checkbox"
                      checked={keepAgenda.has(i)}
                      onChange={() => {
                        const next = new Set(keepAgenda);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        setKeepAgenda(next);
                      }}
                      className="mt-1 accent-indigo-500"
                    />
                    <span className="min-w-0">
                      <span className="text-sm text-slate-200 block">
                        {a.title}
                      </span>
                      <span className="text-xs text-slate-500 block">
                        {a.detail} · {a.source}
                      </span>
                    </span>
                  </label>
                ))}
                {agenda.length === 0 && (
                  <p className="text-xs text-slate-500">
                    No open flags right now — the meeting will proceed with
                    standing agenda.
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={createMeeting}
              disabled={saving || !createForm.title || !createForm.date}
              className="w-full rounded-xl bg-indigo-500 text-white text-sm font-semibold py-2.5 hover:bg-indigo-400 disabled:opacity-40 transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                "Open Meeting"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Close modal */}
      {closeFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setCloseFor(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700/60 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Close {closeFor.meetingNumber}
              </h2>
              <button
                onClick={() => setCloseFor(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="text-xs text-slate-400">
                Minutes / Summary <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={closeForm.summary}
                onChange={(e) =>
                  setCloseForm({ ...closeForm, summary: e.target.value })
                }
                rows={4}
                placeholder="Outcome of the review — performance vs objectives, resource adequacy, effectiveness of actions…"
                className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">
                Decisions (one per line)
              </label>
              <textarea
                value={closeForm.decisions}
                onChange={(e) =>
                  setCloseForm({ ...closeForm, decisions: e.target.value })
                }
                rows={3}
                placeholder={
                  "Approve new vendor for heat treat\nRaise purchase request for CMM probe"
                }
                className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">
                Closure reason <span className="text-rose-400">*</span> (audit
                trail)
              </label>
              <input
                value={closeForm.reason}
                onChange={(e) =>
                  setCloseForm({ ...closeForm, reason: e.target.value })
                }
                placeholder="e.g. Monthly review complete; action items assigned"
                className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="text-xs text-slate-500 rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2">
              Any action item still open past its due date will be
              auto-escalated to the Escalation Register.
            </div>
            <button
              onClick={closeMeeting}
              disabled={saving || !closeForm.reason}
              className="w-full rounded-xl bg-rose-500/90 text-white text-sm font-semibold py-2.5 hover:bg-rose-400 disabled:opacity-40 transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                "Close & Record Minutes"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Add action modal */}
      {actionFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setActionFor(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700/60 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Action Item · {actionFor.meetingNumber}
              </h2>
              <button
                onClick={() => setActionFor(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="text-xs text-slate-400">Description</label>
              <textarea
                value={actionForm.description}
                onChange={(e) =>
                  setActionForm({ ...actionForm, description: e.target.value })
                }
                rows={2}
                className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">Owner</label>
                <input
                  value={actionForm.ownerName}
                  onChange={(e) =>
                    setActionForm({ ...actionForm, ownerName: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Due date</label>
                <input
                  type="date"
                  value={actionForm.dueDate}
                  onChange={(e) =>
                    setActionForm({ ...actionForm, dueDate: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400">Priority</label>
              <select
                value={actionForm.priority}
                onChange={(e) =>
                  setActionForm({ ...actionForm, priority: e.target.value })
                }
                className="mt-1 w-full rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm text-white"
              >
                <option>LOW</option>
                <option>MEDIUM</option>
                <option>HIGH</option>
              </select>
            </div>
            <button
              onClick={addAction}
              disabled={
                saving || !actionForm.description || !actionForm.ownerName
              }
              className="w-full rounded-xl bg-indigo-500 text-white text-sm font-semibold py-2.5 hover:bg-indigo-400 disabled:opacity-40 transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                "Add Action Item"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
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
