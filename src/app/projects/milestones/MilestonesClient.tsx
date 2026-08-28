"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  ClipboardCheck,
  Plus,
  FileCheck2,
  Send,
  Flag,
} from "lucide-react";

const DOC_LABEL: Record<string, string> = {
  PROGRESS_REPORT: "Progress report",
  TEST_CERT: "Test cert",
  DRAWING: "Drawing",
  HANDOVER: "Handover",
  INVOICE_SUPPORT: "Invoice support",
  OTHER: "Other",
};

export default function MilestonesClient() {
  const [projects, setProjects] = useState<any[]>([]);
  const [docTypes, setDocTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showMs, setShowMs] = useState(false);
  const [msForm, setMsForm] = useState({
    projectId: "",
    name: "",
    dueDate: "",
  });
  const [docTarget, setDocTarget] = useState<any>(null);
  const [docForm, setDocForm] = useState({
    docType: "PROGRESS_REPORT",
    title: "",
    notes: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/milestones");
      const d = await res.json();
      if (!res.ok) {
        setToast(d.error || "Failed to load");
        return;
      }
      setProjects(d.projects || []);
      setDocTypes(d.docTypes || []);
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
      const res = await fetch("/api/milestones", {
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
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-300 font-semibold">
            <ClipboardCheck className="w-4 h-4" /> M29 — Milestone Doc Packs
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Gate Invoicing Doc Packs
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Each milestone needs its doc pack (progress report, test cert,
            drawing, handover, invoice support). A milestone can only be marked
            complete when every doc is delivered.
          </p>
        </div>
        <button
          onClick={() => setShowMs(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" /> New milestone
        </button>
      </div>

      {projects.length === 0 && (
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-8 text-center text-slate-400">
          No projects with milestones yet.
        </div>
      )}

      {projects.map((p) => (
        <div
          key={p.id}
          className="rounded-2xl bg-slate-800/60 border border-slate-700/60 overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-slate-700/60 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-white">{p.name}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {p.clientName || "—"}
                {p.code && p.code !== p.id ? ` · ${p.code}` : ""}
              </div>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="rounded-full bg-slate-700/70 px-2.5 py-1 text-slate-200">
                {p.openMilestones} open milestone(s)
              </span>
              <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 text-amber-300">
                {p.docGaps} undelivered doc(s)
              </span>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-emerald-300">
                {p.readyToComplete} ready to complete
              </span>
            </div>
          </div>
          <div className="divide-y divide-slate-700/40">
            {p.milestones.map((m: any) => {
              const delivered = m.docs.filter((d: any) => d.deliveredAt).length;
              const pct = m.docs.length
                ? Math.round((delivered / m.docs.length) * 100)
                : 0;
              const isDone = m.status === "COMPLETED";
              return (
                <div key={m.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Flag
                        className={`w-4 h-4 ${isDone ? "text-emerald-400" : "text-amber-300"}`}
                      />
                      <div>
                        <div className="font-medium text-white">{m.name}</div>
                        <div className="text-xs text-slate-400">
                          Due {new Date(m.dueDate).toLocaleDateString("en-IN")}{" "}
                          · {delivered}/{m.docs.length} docs delivered
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-28 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isDone ? "bg-emerald-500" : pct === 100 ? "bg-emerald-400" : "bg-amber-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <button
                        onClick={() => {
                          setDocTarget(m);
                          setDocForm({
                            docType: "PROGRESS_REPORT",
                            title: "",
                            notes: "",
                          });
                        }}
                        disabled={isDone}
                        className="rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 px-2.5 py-1.5 text-xs text-white flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Doc
                      </button>
                      {!isDone && (
                        <button
                          onClick={async () => {
                            const ok = await api({
                              action: "complete-milestone",
                              data: { id: m.id },
                            });
                            if (!ok)
                              setToast(
                                "Doc pack incomplete — all docs must be delivered first",
                              );
                          }}
                          disabled={saving}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-2.5 py-1.5 text-xs text-white font-semibold flex items-center gap-1"
                        >
                          <FileCheck2 className="w-3.5 h-3.5" /> Complete
                        </button>
                      )}
                      {isDone && (
                        <span className="text-xs font-semibold text-emerald-300">
                          COMPLETED
                        </span>
                      )}
                    </div>
                  </div>
                  {m.docs.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {m.docs.map((d: any) => (
                        <div
                          key={d.id}
                          className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs border ${d.deliveredAt ? "bg-emerald-500/10 border-emerald-500/30" : "bg-slate-900/50 border-slate-700"}`}
                        >
                          <div>
                            <span className="text-white">{d.title}</span>
                            <span className="ml-2 rounded-full bg-slate-700/70 px-2 py-0.5 text-[10px] text-slate-300">
                              {DOC_LABEL[d.docType] || d.docType}
                            </span>
                          </div>
                          {d.deliveredAt ? (
                            <span className="text-emerald-300 whitespace-nowrap">
                              ✓{" "}
                              {new Date(d.deliveredAt).toLocaleDateString(
                                "en-IN",
                              )}
                            </span>
                          ) : (
                            <button
                              onClick={() =>
                                api({
                                  action: "deliver-doc",
                                  data: { id: d.id },
                                })
                              }
                              className="rounded-lg bg-slate-700 hover:bg-slate-600 px-2 py-1 text-[11px] text-white flex items-center gap-1"
                            >
                              <Send className="w-3 h-3" /> Mark delivered
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {showMs && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setShowMs(false)}
        >
          <div
            className="rounded-2xl bg-slate-800 border border-slate-700 p-6 w-full max-w-md space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-white">New milestone</h2>
            <select
              value={msForm.projectId}
              onChange={(e) =>
                setMsForm({ ...msForm, projectId: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
            >
              <option value="">Select project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Milestone name (e.g. FAT at customer site)"
              value={msForm.name}
              onChange={(e) => setMsForm({ ...msForm, name: e.target.value })}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
            />
            <input
              type="date"
              value={msForm.dueDate}
              onChange={(e) =>
                setMsForm({ ...msForm, dueDate: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={async () => {
                  const ok = await api({
                    action: "create-milestone",
                    data: msForm,
                  });
                  if (ok) {
                    setShowMs(false);
                    setMsForm({ projectId: "", name: "", dueDate: "" });
                  }
                }}
                disabled={
                  saving || !msForm.projectId || !msForm.name || !msForm.dueDate
                }
                className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Create
              </button>
              <button
                onClick={() => setShowMs(false)}
                className="rounded-xl bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {docTarget && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setDocTarget(null)}
        >
          <div
            className="rounded-2xl bg-slate-800 border border-slate-700 p-6 w-full max-w-md space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-white">
              Add doc — {docTarget.name}
            </h2>
            <select
              value={docForm.docType}
              onChange={(e) =>
                setDocForm({ ...docForm, docType: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
            >
              {docTypes.map((t) => (
                <option key={t} value={t}>
                  {DOC_LABEL[t] || t}
                </option>
              ))}
            </select>
            <input
              placeholder="Doc title (e.g. FAT Report — Rev B)"
              value={docForm.title}
              onChange={(e) =>
                setDocForm({ ...docForm, title: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
            />
            <input
              placeholder="Notes / file ref (optional)"
              value={docForm.notes}
              onChange={(e) =>
                setDocForm({ ...docForm, notes: e.target.value })
              }
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-white"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={async () => {
                  const ok = await api({
                    action: "add-doc",
                    data: { milestoneId: docTarget.id, ...docForm },
                  });
                  if (ok) setDocTarget(null);
                }}
                disabled={saving || !docForm.title}
                className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => setDocTarget(null)}
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
