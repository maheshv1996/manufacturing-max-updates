"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Briefcase,
  Users,
  CalendarDays,
  ClipboardCheck,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronRight,
  Ban,
  CheckCircle2,
} from "lucide-react";

type Req = any;
type Cand = any;
type Intv = any;
type Task = any;

const STAGES = ["SCREENING", "INTERVIEW", "OFFER", "HIRED", "REJECTED"];
const STAGE_COLORS: Record<string, string> = {
  SCREENING: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  INTERVIEW: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  OFFER: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  HIRED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  REJECTED: "bg-rose-500/10 text-rose-400 border-rose-500/30",
};
const REQ_STATUS: Record<string, string> = {
  OPEN: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  ON_HOLD: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  CLOSED: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  FILLED: "bg-blue-500/10 text-blue-400 border-blue-500/30",
};
const NEXT_STAGE: Record<string, string> = {
  SCREENING: "INTERVIEW",
  INTERVIEW: "OFFER",
  OFFER: "HIRED",
};

interface Field {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "textarea";
  options?: (string | { value: string; label: string })[];
  required?: boolean;
  placeholder?: string;
}

function FieldInput({
  field,
  form,
  setForm,
}: {
  field: Field;
  form: any;
  setForm: (f: any) => void;
}) {
  const cls =
    "w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white";
  if (field.type === "select") {
    return (
      <select
        required={field.required}
        value={form[field.key] ?? ""}
        onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
        className={cls}
      >
        {(field.options || []).map((o) => {
          const val = typeof o === "string" ? o : o.value;
          const lab = typeof o === "string" ? o : o.label;
          return (
            <option key={val} value={val}>
              {lab}
            </option>
          );
        })}
      </select>
    );
  }
  if (field.type === "textarea") {
    return (
      <textarea
        required={field.required}
        value={form[field.key] ?? ""}
        onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
        rows={3}
        className={cls}
      />
    );
  }
  return (
    <input
      required={field.required}
      type={field.type || "text"}
      value={form[field.key] ?? ""}
      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
      placeholder={field.placeholder}
      className={cls}
    />
  );
}

export default function RecruitmentClient() {
  const [tab, setTab] = useState<
    "reqs" | "pipeline" | "interviews" | "onboarding"
  >("reqs");
  const [reqs, setReqs] = useState<Req[]>([]);
  const [cands, setCands] = useState<Cand[]>([]);
  const [intvs, setIntvs] = useState<Intv[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<{ entity: string; row: any } | null>(null);
  const [form, setForm] = useState<any>({});

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/recruitment");
      if (res.ok) {
        const d = await res.json();
        setReqs(d.requisitions || []);
        setCands(d.candidates || []);
        setIntvs(d.interviews || []);
        setTasks(d.onboardingTasks || []);
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

  const api = async (entity: string, action: string, data: any) => {
    setSaving(true);
    try {
      const res = await fetch("/api/recruitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, action, data }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) alert(d.error || "Action failed");
      else await fetchData();
    } catch (e) {
      console.error(e);
      alert("Action failed");
    } finally {
      setSaving(false);
    }
  };

  const openModal = (entity: string, row: any, fields: Field[]) => {
    const init: any = {};
    for (const f of fields) {
      let v = row?.[f.key];
      if (f.type === "date" && v) v = new Date(v).toISOString().slice(0, 10);
      if (f.type === "number") v = v ?? "";
      if (f.type === "select" && f.options && v === undefined) {
        const first = f.options[0];
        v = typeof first === "string" ? first : first.value;
      }
      init[f.key] = v ?? "";
    }
    setForm(init);
    setModal({ entity, row });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal) return;
    const payload: any = { ...form };
    if (modal.row) payload.id = modal.row.id;
    await api(modal.entity, modal.row ? "update" : "create", payload);
    setModal(null);
  };

  const del = async (entity: string, row: any) => {
    if (!confirm("Delete this record? This cannot be undone.")) return;
    await api(entity, "delete", { id: row.id });
  };

  const FIELDS: Record<string, Field[]> = {
    requisitions: [
      {
        key: "title",
        label: "Job Title",
        required: true,
        placeholder: "e.g. CNC Machinist",
      },
      { key: "department", label: "Department", required: true },
      { key: "openings", label: "Openings", type: "number" },
      { key: "location", label: "Location" },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["OPEN", "ON_HOLD", "CLOSED", "FILLED"],
      },
      { key: "postedAt", label: "Posted Date", type: "date" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    candidates: [
      { key: "name", label: "Candidate Name", required: true },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      {
        key: "requisitionId",
        label: "Requisition",
        type: "select",
        options: [
          { value: "", label: "No requisition" },
          ...reqs.map((r) => ({
            value: r.id,
            label: `${r.title} (${r.department})`,
          })),
        ],
      },
      { key: "stage", label: "Stage", type: "select", options: STAGES },
      {
        key: "source",
        label: "Source",
        type: "select",
        options: [
          "REFERRAL",
          "LINKEDIN",
          "JOB_PORTAL",
          "CAMPUS",
          "AGENCY",
          "OTHER",
        ],
      },
      { key: "appliedAt", label: "Applied Date", type: "date" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    interviews: [
      {
        key: "candidateId",
        label: "Candidate",
        type: "select",
        options: [
          { value: "", label: "Select candidate" },
          ...cands.map((c) => ({ value: c.id, label: c.name })),
        ],
      },
      {
        key: "interviewType",
        label: "Type",
        type: "select",
        options: ["TECHNICAL", "HR", "MANAGEMENT", "PANEL"],
      },
      { key: "panelist", label: "Panelist" },
      { key: "scheduledAt", label: "Scheduled At", type: "date" },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["SCHEDULED", "DONE", "CANCELLED"],
      },
      { key: "feedback", label: "Feedback", type: "textarea" },
    ],
    onboardingTasks: [
      {
        key: "candidateId",
        label: "Hired Candidate",
        type: "select",
        options: [
          { value: "", label: "Select candidate" },
          ...cands
            .filter((c) => c.stage === "HIRED")
            .map((c) => ({ value: c.id, label: c.name })),
        ],
      },
      {
        key: "task",
        label: "Task",
        required: true,
        placeholder: "e.g. Issue laptop & badge",
      },
      { key: "dueDate", label: "Due Date", type: "date" },
      {
        key: "done",
        label: "Done",
        type: "select",
        options: ["false", "true"],
      },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  };

  const hiredCands = cands.filter((c) => c.stage === "HIRED");

  const TABS = [
    { id: "reqs" as const, label: "Requisitions", icon: Briefcase },
    { id: "pipeline" as const, label: "Candidate Pipeline", icon: Users },
    { id: "interviews" as const, label: "Interviews", icon: CalendarDays },
    { id: "onboarding" as const, label: "Onboarding", icon: ClipboardCheck },
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap print:hidden">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                tab === t.id
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-800/60 text-slate-600 text-slate-300 hover:bg-slate-200 hover:bg-slate-700 border border-slate-600"
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          {/* REQUISITIONS */}
          {tab === "reqs" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() =>
                    openModal("requisitions", null, FIELDS.requisitions)
                  }
                  disabled={saving}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" /> New Requisition
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {reqs.length === 0 && (
                  <div className="col-span-full text-center text-slate-400 italic py-10">
                    No job requisitions yet.
                  </div>
                )}
                {reqs.map((r) => (
                  <div
                    key={r.id}
                    className="bg-slate-800/60 rounded-2xl border border-slate-700 p-5 shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-white">{r.title}</h3>
                        <p className="text-xs text-slate-400">
                          {r.department} Â· {r.location || "Any"}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${REQ_STATUS[r.status] || REQ_STATUS.OPEN}`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>
                        <strong className="text-white">{r.openings}</strong>{" "}
                        openings
                      </span>
                      <span>
                        <strong className="text-white">
                          {r._count?.candidates || 0}
                        </strong>{" "}
                        candidates
                      </span>
                      <span>
                        Posted {new Date(r.postedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {r.notes && (
                      <p className="text-xs text-slate-400">{r.notes}</p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() =>
                          openModal("requisitions", r, FIELDS.requisitions)
                        }
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-200 hover:bg-slate-700 text-blue-400 rounded-lg text-xs font-bold"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => del("requisitions", r)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 hover:bg-rose-900/40 text-rose-400 rounded-lg text-xs font-bold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PIPELINE */}
          {tab === "pipeline" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() =>
                    openModal("candidates", null, FIELDS.candidates)
                  }
                  disabled={saving}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" /> Add Candidate
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {STAGES.map((stage) => (
                  <div
                    key={stage}
                    className="bg-slate-800/60 rounded-2xl border border-slate-700 p-3 space-y-2 min-h-[180px]"
                  >
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                        {stage}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        {cands.filter((c) => c.stage === stage).length}
                      </span>
                    </div>
                    {cands
                      .filter((c) => c.stage === stage)
                      .map((c) => (
                        <div
                          key={c.id}
                          className="bg-slate-800/60 rounded-xl border border-slate-600 p-3 shadow-sm space-y-1.5"
                        >
                          <div className="font-bold text-sm text-white">
                            {c.name}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {c.requisition?.title || "No requisition"} Â·{" "}
                            {c.source || "â€”"}
                          </div>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {NEXT_STAGE[c.stage] && (
                              <button
                                title={`Move to ${NEXT_STAGE[c.stage]}`}
                                onClick={() =>
                                  api("candidates", "moveStage", {
                                    id: c.id,
                                    stage: NEXT_STAGE[c.stage],
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[10px] font-bold"
                              >
                                <ChevronRight className="w-3 h-3" />{" "}
                                {NEXT_STAGE[c.stage]}
                              </button>
                            )}
                            {c.stage !== "REJECTED" && c.stage !== "HIRED" && (
                              <button
                                title="Reject"
                                onClick={() =>
                                  api("candidates", "moveStage", {
                                    id: c.id,
                                    stage: "REJECTED",
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 hover:bg-rose-900/40 text-rose-400 rounded-md text-[10px] font-bold border border-rose-200 dark:border-rose-800"
                              >
                                <Ban className="w-3 h-3" /> Reject
                              </button>
                            )}
                            <button
                              onClick={() =>
                                openModal("candidates", c, FIELDS.candidates)
                              }
                              className="inline-flex items-center px-2 py-1 bg-slate-800/60 text-slate-600 text-slate-300 rounded-md text-[10px] font-bold"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => del("candidates", c)}
                              className="inline-flex items-center px-2 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-400 rounded-md text-[10px] font-bold"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* INTERVIEWS */}
          {tab === "interviews" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() =>
                    openModal("interviews", null, FIELDS.interviews)
                  }
                  disabled={saving}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" /> Schedule Interview
                </button>
              </div>
              <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-slate-800/60 border-b border-slate-700">
                    <tr>
                      {[
                        "Candidate",
                        "Type",
                        "Panelist",
                        "Scheduled",
                        "Status",
                        "Feedback",
                        "Actions",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-5 py-3.5 font-semibold text-slate-200"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 divide-slate-800">
                    {intvs.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-5 py-10 text-center text-slate-400 italic"
                        >
                          No interviews scheduled.
                        </td>
                      </tr>
                    )}
                    {intvs.map((i) => (
                      <tr
                        key={i.id}
                        className="hover:bg-slate-800/90/20 transition-colors"
                      >
                        <td className="px-5 py-3 font-bold text-white">
                          {i.candidate?.name || "â€”"}
                        </td>
                        <td className="px-5 py-3 text-slate-600 text-slate-300">
                          {i.interviewType}
                        </td>
                        <td className="px-5 py-3 text-slate-600 text-slate-300">
                          {i.panelist || "â€”"}
                        </td>
                        <td className="px-5 py-3 text-slate-600 text-slate-300">
                          {new Date(i.scheduledAt).toLocaleString()}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${STAGE_COLORS[i.status] || "bg-slate-500/10 text-slate-400 border-slate-500/30"}`}
                          >
                            {i.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-400 max-w-[220px] truncate">
                          {i.feedback || "â€”"}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex gap-2">
                            {i.status !== "DONE" && (
                              <button
                                onClick={() =>
                                  api("interviews", "update", {
                                    id: i.id,
                                    status: "DONE",
                                  })
                                }
                                className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-400 rounded-lg text-xs font-bold border border-emerald-200 dark:border-emerald-800"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                                Done
                              </button>
                            )}
                            <button
                              onClick={() =>
                                openModal("interviews", i, FIELDS.interviews)
                              }
                              className="px-2.5 py-1.5 bg-slate-800/60 text-blue-400 rounded-lg text-xs font-bold"
                            >
                              <Pencil className="w-3.5 h-3.5 inline mr-1" />
                              Edit
                            </button>
                            <button
                              onClick={() => del("interviews", i)}
                              className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-400 rounded-lg text-xs font-bold"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ONBOARDING */}
          {tab === "onboarding" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() =>
                    openModal("onboardingTasks", null, FIELDS.onboardingTasks)
                  }
                  disabled={saving}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" /> Add Onboarding Task
                </button>
              </div>
              {hiredCands.length === 0 ? (
                <div className="text-center text-slate-400 italic py-10">
                  No hired candidates yet. Move a candidate to HIRED in the
                  pipeline to start onboarding.
                </div>
              ) : (
                <div className="space-y-4">
                  {hiredCands.map((c) => {
                    const cTasks = tasks.filter((t) => t.candidateId === c.id);
                    const doneCount = cTasks.filter((t) => t.done).length;
                    return (
                      <div
                        key={c.id}
                        className="bg-slate-800/60 rounded-2xl border border-slate-700 p-5 shadow-sm space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-white">{c.name}</h3>
                            <p className="text-xs text-slate-400">
                              {c.requisition?.title || "No requisition"} Â·
                              Joined{" "}
                              {new Date(c.appliedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-emerald-400">
                            {doneCount}/{cTasks.length} done
                          </span>
                        </div>
                        {cTasks.length === 0 && (
                          <p className="text-xs text-slate-400 italic">
                            No tasks yet.
                          </p>
                        )}
                        <div className="space-y-2">
                          {cTasks.map((t) => (
                            <div
                              key={t.id}
                              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${t.done ? "border-emerald-300/40 bg-emerald-50/40 dark:bg-emerald-950/20" : "border-slate-600"}`}
                            >
                              <input
                                type="checkbox"
                                checked={t.done}
                                onChange={(e) =>
                                  api("onboardingTasks", "toggleTask", {
                                    id: t.id,
                                    done: e.target.checked,
                                  })
                                }
                                className="w-4 h-4 accent-emerald-600"
                              />
                              <div className="flex-1">
                                <div
                                  className={`text-sm font-medium ${t.done ? "line-through text-slate-400" : "text-white"}`}
                                >
                                  {t.task}
                                </div>
                                {t.dueDate && (
                                  <div className="text-[11px] text-slate-400">
                                    Due{" "}
                                    {new Date(t.dueDate).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() =>
                                  openModal(
                                    "onboardingTasks",
                                    t,
                                    FIELDS.onboardingTasks,
                                  )
                                }
                                className="p-1.5 text-slate-400 hover:text-blue-500"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => del("onboardingTasks", t)}
                                className="p-1.5 text-slate-400 hover:text-rose-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* MODAL */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800/60 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">
                {modal.row ? "Edit" : "New"} Record
              </h3>
              <button
                onClick={() => setModal(null)}
                className="text-slate-400 hover:text-slate-600 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={save}
              className="p-6 space-y-4 max-h-[70vh] overflow-y-auto"
            >
              {FIELDS[modal.entity].map((f) => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    {f.label}
                    {f.required ? " *" : ""}
                  </label>
                  <FieldInput field={f} form={form} setForm={setForm} />
                </div>
              ))}
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="px-4 py-2 text-slate-400 hover:bg-slate-800/90 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : modal.row ? "Save Changes" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
