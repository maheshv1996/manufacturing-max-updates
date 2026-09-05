"use client";

import PageHeader from "@/app/components/shared/PageHeader";

import {useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Trophy,
  CheckCircle2,
  Plus,
  GraduationCap,
  ClipboardCheck,
  Users
} from "lucide-react";

const STATUS_STYLE: Record<string, string> = {
  SCHEDULED: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  ATTENDED: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  PASSED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  FAILED: "bg-rose-500/20 text-rose-300 border-rose-500/40",
};
const PROG_STYLE: Record<string, string> = {
  PLANNED: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  COMPLETED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
};

export default function TrainingClient() {
  const [programs, setPrograms] = useState<any[]>([]);
  const [overall, setOverall] = useState({
    programs: 0,
    attended: 0,
    scored: 0,
    passed: 0,
    effectiveness: 0,
  });
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "",
    trainer: "",
    scheduledDate: "",
    passingScore: "70",
  });
  const [scoreFor, setScoreFor] = useState<{
    programId: string;
    userId: string;
    name: string;
  } | null>(null);
  const [score, setScore] = useState("");
  const [attendeeFor] = useState<string | null>(null);

  useEffect(() => {
    if (!showCreate && !scoreFor) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowCreate(false);
        setScoreFor(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCreate, scoreFor]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/training");
      const d = await res.json();
      if (!res.ok) {
        setToast(d.error || "Failed to load");
        return;
      }
      setPrograms(d.programs || []);
      setOverall(d.overall || {});
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

  const api = async (body: any) => {
    setSaving(true);
    try {
      const res = await fetch("/api/training", {
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
            <GraduationCap className="w-4 h-4" /> M21 — Post-training check
            closes the record
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Training Effectiveness
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Each attendee's post-training check (score vs pass mark) closes
            their record; when all are decided the program closes as COMPLETED.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" /> New program
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          {
            label: "Programs",
            value: overall.programs,
            icon: Trophy,
            color: "text-indigo-300",
          },
          {
            label: "Attendees",
            value: overall.attended,
            icon: GraduationCap,
            color: "text-sky-300",
          },
          {
            label: "Checks recorded",
            value: overall.scored,
            icon: ClipboardCheck,
            color: "text-violet-300",
          },
          {
            label: "Passed",
            value: overall.passed,
            icon: CheckCircle2,
            color: "text-emerald-300",
          },
          {
            label: "Effectiveness %",
            value: `${overall.effectiveness}%`,
            icon: Trophy,
            color: "text-amber-300",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4"
          >
            <div className="text-2xl font-bold text-white flex items-center gap-2">
              <k.icon className={`w-5 h-5 ${k.color}`} />
              {k.value}
            </div>
            <div className="text-xs text-slate-400 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {programs.map((p) => {
        const scored = p.attendees.filter(
          (a: any) => a.score !== null && a.score !== undefined,
        );
        const pendingCheck = p.attendees.filter(
          (a: any) => a.status === "ATTENDED" || a.status === "SCHEDULED",
        );
        return (
          <div
            key={p.id}
            className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4 space-y-3"
          >
      <PageHeader
        title="Training"
        description="Roster, attendance, leave and workforce operations."
        icon={<Users className="w-6 h-6" />}
        iconTone="violet"
      />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white">
                    {p.programNumber}
                  </span>
                  <span className="text-sm text-slate-300">{p.title}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${PROG_STYLE[p.status] || ""}`}
                  >
                    {p.status}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${pendingCheck.length > 0 && p.status === "PLANNED" ? "bg-sky-500/20 text-sky-300 border-sky-500/40" : "bg-slate-700/40 text-slate-300"}`}
                  >
                    {pendingCheck.length > 0
                      ? `${pendingCheck.length} awaiting check`
                      : "all decided"}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {p.category} ·{" "}
                  {p.trainer ? `Trainer ${p.trainer}` : "No trainer"} ·{" "}
                  {new Date(p.scheduledDate).toLocaleDateString()} · pass mark{" "}
                  {p.passingScore}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-white">
                  {p.effectiveness}%
                </div>
                <div className="text-xs text-slate-400">effectiveness</div>
                <div className="w-40 h-1.5 rounded-full bg-slate-700 mt-1">
                  <div
                    className="h-1.5 rounded-full bg-emerald-500"
                    style={{ width: `${p.effectiveness}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
                    <th className="p-2">Employee</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Score</th>
                    <th className="p-2">Checked by</th>
                    <th className="p-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {p.attendees.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-4 text-center text-slate-400"
                      >
                        No attendees yet.
                      </td>
                    </tr>
                  )}
                  {p.attendees.map((a: any) => (
                    <tr
                      key={a.id}
                      className="border-b border-slate-700/40 last:border-0"
                    >
                      <td className="p-2 text-white">
                        {a.user?.name || "—"}{" "}
                        <span className="text-xs text-slate-400">
                          {a.user?.employeeNumber || ""}
                        </span>
                      </td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLE[a.status] || ""}`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="p-2 text-slate-300">
                        {a.score !== null && a.score !== undefined
                          ? `${a.score}%`
                          : "—"}
                      </td>
                      <td className="p-2 text-slate-400">
                        {a.checkedBy || "—"}
                      </td>
                      <td className="p-2 text-right space-x-2">
                        {a.status === "SCHEDULED" && (
                          <button
                            onClick={() =>
                              api({
                                action: "mark-attended",
                                data: { programId: p.id, userId: a.userId },
                              })
                            }
                            className="text-xs font-semibold text-sky-300 hover:text-sky-200"
                          >
                            Mark attended
                          </button>
                        )}
                        {(a.status === "ATTENDED" ||
                          a.status === "SCHEDULED") && (
                          <button
                            onClick={() => {
                              setScoreFor({
                                programId: p.id,
                                userId: a.userId,
                                name: a.user?.name || "attendee",
                              });
                              setScore("");
                            }}
                            className="text-xs font-semibold text-emerald-300 hover:text-emerald-200"
                          >
                            Record check
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={attendeeFor === p.id ? "pick" : ""}
                onChange={(e) => {
                  if (e.target.value !== "pick") return;
                  const u = users.find((x) => x.id === e.target.value);
                  if (u)
                    api({
                      action: "add-attendee",
                      data: { programId: p.id, userId: u.id },
                    });
                }}
                className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="">+ Add attendee</option>
                {users
                  .filter(
                    (u) => !p.attendees.some((a: any) => a.userId === u.id),
                  )
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.employeeNumber || ""}
                    </option>
                  ))}
              </select>
              <span className="text-xs text-slate-500">
                {scored.length} of {p.attendees.length} checked
              </span>
            </div>
          </div>
        );
      })}
      {programs.length === 0 && (
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-8 text-center text-slate-400">
          No training programs yet — create one to start tracking effectiveness.
        </div>
      )}

      {showCreate && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="rounded-2xl bg-slate-800 border border-slate-700 p-6 w-full max-w-md space-y-3"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="training-create-title"
          >
            <h2 id="training-create-title" className="font-semibold text-white">New training program</h2>
            <input
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <input
              placeholder="Category (e.g. Safety, CNC, Quality)"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <input
              placeholder="Trainer (optional)"
              value={form.trainer}
              onChange={(e) => setForm({ ...form, trainer: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <input
              type="date"
              value={form.scheduledDate}
              onChange={(e) =>
                setForm({ ...form, scheduledDate: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <input
              placeholder="Passing score % (default 70)"
              value={form.passingScore}
              onChange={(e) =>
                setForm({ ...form, passingScore: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={async () => {
                  const ok = await api({
                    action: "create-program",
                    data: form,
                  });
                  if (ok) setShowCreate(false);
                }}
                disabled={saving}
                className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {scoreFor && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setScoreFor(null)}
        >
          <div
            className="rounded-2xl bg-slate-800 border border-slate-700 p-6 w-full max-w-sm space-y-3"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="training-score-title"
          >
            <h2 id="training-score-title" className="font-semibold text-white">
              Post-training check — {scoreFor.name}
            </h2>
            <input
              type="number"
              min={0}
              max={100}
              placeholder="Score 0–100"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={async () => {
                  const ok = await api({
                    action: "record-score",
                    data: {
                      programId: scoreFor.programId,
                      userId: scoreFor.userId,
                      score: Number(score),
                    },
                  });
                  if (ok) setScoreFor(null);
                }}
                disabled={saving}
                className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Record — closes the record
              </button>
              <button
                type="button"
                onClick={() => setScoreFor(null)}
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
