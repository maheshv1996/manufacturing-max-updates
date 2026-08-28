"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Save,
  Plus,
  Loader2,
  CheckSquare,
  Square,
  ChevronRight,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type ProjectPhase = "DEFINE" | "MEASURE" | "ANALYZE" | "IMPROVE" | "CONTROL";
type ProjectStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";
type ActionItemStatus = "OPEN" | "DONE";
type FishboneCategory =
  "MAN" | "MACHINE" | "METHOD" | "MATERIAL" | "MEASUREMENT" | "ENVIRONMENT";

interface ActionItem {
  id: string;
  description: string;
  ownerName: string;
  dueDate: string;
  status: ActionItemStatus;
}

interface RcaRecord {
  id: string;
  problemStatement: string | null;
  why1: string | null;
  why2: string | null;
  why3: string | null;
  why4: string | null;
  why5: string | null;
  rootCause: string | null;
  fishboneCategory: FishboneCategory | null;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  type: "KAIZEN" | "DMAIC";
  phase: ProjectPhase;
  status: ProjectStatus;
  ownerName: string;
  expectedAnnualSavings: number | null;
  machine: { name: string; code: string } | null;
  rcaRecord: RcaRecord | null;
  actionItems: ActionItem[];
}

// ── DMAIC Stepper ──────────────────────────────────────────────────────────

const PHASES: ProjectPhase[] = [
  "DEFINE",
  "MEASURE",
  "ANALYZE",
  "IMPROVE",
  "CONTROL",
];
const PHASE_DESCRIPTIONS: Record<ProjectPhase, string> = {
  DEFINE: "Charter the problem, scope, team, and SIPOC map.",
  MEASURE: "Collect baseline data, validate measurement system.",
  ANALYZE: "Identify root causes with data — 5 Whys, fishbone, Pareto.",
  IMPROVE: "Pilot solutions, implement improvements.",
  CONTROL: "Sustain gains with control plan, SPC, standard work.",
};

function DmaicStepper({
  projectId,
  currentPhase,
  currentStatus,
}: {
  projectId: string;
  currentPhase: ProjectPhase;
  currentStatus: ProjectStatus;
}) {
  const [phase, setPhase] = useState(currentPhase);
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const handlePhaseClick = async (newPhase: ProjectPhase) => {
    setSaving(true);
    const isComplete = newPhase === "CONTROL" && phase === "CONTROL";
    const res = await fetch(`/api/kaizen/${projectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPDATE_PHASE",
        phase: newPhase,
        status: isComplete ? "COMPLETED" : "IN_PROGRESS",
      }),
    });
    if (res.ok) {
      setPhase(newPhase);
      setStatus(isComplete ? "COMPLETED" : "IN_PROGRESS");
      router.refresh();
    }
    setSaving(false);
  };

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    setSaving(true);
    const res = await fetch(`/api/kaizen/${projectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "UPDATE_STATUS", status: newStatus }),
    });
    if (res.ok) {
      setStatus(newStatus);
      router.refresh();
    }
    setSaving(false);
  };

  const currentIdx = PHASES.indexOf(phase);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-white">DMAIC Phase</h2>
        <div className="flex items-center gap-2">
          {saving && (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          )}
          <select
            value={status}
            onChange={(e) =>
              handleStatusChange(e.target.value as ProjectStatus)
            }
            className="bg-slate-800 border border-slate-600 text-white rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="ON_HOLD">On Hold</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-0">
        {PHASES.map((p, i) => {
          const isActive = p === phase;
          const isDone = i < currentIdx;
          const isClickable = true;
          return (
            <div key={p} className="flex-1 flex items-center">
              <button
                onClick={() => isClickable && handlePhaseClick(p)}
                className={`flex flex-col items-center gap-2 w-full px-2 py-3 rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? "bg-blue-900/40 border border-blue-700"
                    : isDone
                      ? "hover:bg-slate-800"
                      : "hover:bg-slate-800 opacity-60"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 ${
                    isActive
                      ? "bg-blue-600 border-blue-400 text-white"
                      : isDone
                        ? "bg-teal-700 border-teal-500 text-white"
                        : "bg-slate-800 border-slate-600 text-slate-500"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <span
                  className={`text-xs font-bold uppercase ${isActive ? "text-blue-300" : isDone ? "text-teal-400" : "text-slate-500"}`}
                >
                  {p}
                </span>
              </button>
              {i < PHASES.length - 1 && (
                <ChevronRight
                  className={`w-4 h-4 shrink-0 ${i < currentIdx ? "text-teal-600" : "text-slate-700"}`}
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-sm text-slate-400 bg-slate-800 rounded-xl px-4 py-2.5">
        <span className="font-bold text-blue-400">{phase}: </span>
        {PHASE_DESCRIPTIONS[phase]}
      </p>
    </div>
  );
}

// ── 5 Whys Section ──────────────────────────────────────────────────────────

const FISHBONE_CATS: FishboneCategory[] = [
  "MAN",
  "MACHINE",
  "METHOD",
  "MATERIAL",
  "MEASUREMENT",
  "ENVIRONMENT",
];

function FiveWhysSection({
  projectId,
  initial,
}: {
  projectId: string;
  initial: RcaRecord | null;
}) {
  const [rca, setRca] = useState({
    problemStatement: initial?.problemStatement || "",
    why1: initial?.why1 || "",
    why2: initial?.why2 || "",
    why3: initial?.why3 || "",
    why4: initial?.why4 || "",
    why5: initial?.why5 || "",
    rootCause: initial?.rootCause || "",
    fishboneCategory:
      initial?.fishboneCategory || ("" as FishboneCategory | ""),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const res = await fetch(`/api/kaizen/${projectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "SAVE_RCA",
        ...rca,
        fishboneCategory: rca.fishboneCategory || null,
      }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    }
    setSaving(false);
  };

  const whyFields: {
    key: keyof typeof rca;
    label: string;
    placeholder: string;
  }[] = [
    {
      key: "why1",
      label: "Why 1",
      placeholder: "Why is the problem occurring?",
    },
    { key: "why2", label: "Why 2", placeholder: "Why does that happen?" },
    {
      key: "why3",
      label: "Why 3",
      placeholder: "Why does that cause the issue?",
    },
    {
      key: "why4",
      label: "Why 4",
      placeholder: "Why does that condition exist?",
    },
    {
      key: "why5",
      label: "Why 5 (Root)",
      placeholder: "The fundamental root cause",
    },
  ];

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-white">
            5 Whys Root Cause Analysis
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Chain of causal questions to reach the true root cause
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors ${
            saved
              ? "bg-teal-600 text-white"
              : "bg-purple-600 hover:bg-purple-500 text-white"
          } disabled:opacity-50`}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save RCA"}
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            Problem Statement
          </label>
          <textarea
            rows={2}
            value={rca.problemStatement}
            onChange={(e) =>
              setRca({ ...rca, problemStatement: e.target.value })
            }
            placeholder="Describe the defect, failure, or waste in measurable terms..."
            className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500 resize-none"
          />
        </div>

        <div className="pl-4 border-l-2 border-slate-700 space-y-3">
          {whyFields.map((field, idx) => (
            <div key={field.key} className="flex gap-3 items-start">
              <div
                className={`mt-2.5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                  idx === 4
                    ? "bg-rose-700 text-white"
                    : "bg-slate-700 text-slate-400"
                }`}
              >
                {idx + 1}
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  {field.label}
                </label>
                <textarea
                  rows={2}
                  value={String(rca[field.key])}
                  onChange={(e) =>
                    setRca({ ...rca, [field.key]: e.target.value })
                  }
                  placeholder={field.placeholder}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Root Cause (Summary)
            </label>
            <textarea
              rows={3}
              value={rca.rootCause}
              onChange={(e) => setRca({ ...rca, rootCause: e.target.value })}
              placeholder="Confirmed root cause to address with countermeasures..."
              className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Fishbone Category
            </label>
            <select
              value={rca.fishboneCategory}
              onChange={(e) =>
                setRca({
                  ...rca,
                  fishboneCategory: e.target.value as FishboneCategory | "",
                })
              }
              className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
            >
              <option value="">— Select category —</option>
              {FISHBONE_CATS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {rca.fishboneCategory && (
              <div className="mt-3 p-3 bg-slate-800 border border-slate-600 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">Fishbone branch</p>
                <p className="text-sm font-bold text-purple-400">
                  {rca.fishboneCategory}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {
                    {
                      MAN: "Operator skill, training, fatigue, or human error",
                      MACHINE: "Equipment wear, maintenance, calibration",
                      METHOD: "Process, procedure, SOP, work instruction",
                      MATERIAL: "Raw material variation, supplier quality",
                      MEASUREMENT: "Gauge R&R, measurement system error",
                      ENVIRONMENT: "Temperature, humidity, contamination",
                    }[rca.fishboneCategory]
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Action Items ────────────────────────────────────────────────────────────

function ActionItemsSection({
  projectId,
  initialItems,
}: {
  projectId: string;
  initialItems: ActionItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({
    description: "",
    ownerName: "",
    dueDate: "",
  });
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const doneCount = items.filter((i) => i.status === "DONE").length;

  const handleToggle = async (item: ActionItem) => {
    const newStatus: ActionItemStatus =
      item.status === "DONE" ? "OPEN" : "DONE";
    setSaving(item.id);
    const res = await fetch(`/api/kaizen/${projectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "TOGGLE_ACTION_ITEM",
        itemId: item.id,
        status: newStatus,
      }),
    });
    if (res.ok) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i)),
      );
      router.refresh();
    }
    setSaving(null);
  };

  const handleAdd = async () => {
    setError(null);
    if (
      !newItem.description.trim() ||
      !newItem.ownerName.trim() ||
      !newItem.dueDate
    ) {
      setError("All fields are required.");
      return;
    }
    setSaving("new");
    const res = await fetch(`/api/kaizen/${projectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ADD_ACTION_ITEM", ...newItem }),
    });
    const data = await res.json();
    if (res.ok) {
      setItems((prev) => [...prev, data]);
      setNewItem({ description: "", ownerName: "", dueDate: "" });
      setAdding(false);
      router.refresh();
    } else {
      setError(data.error || "Failed");
    }
    setSaving(null);
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-white">Action Items</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Countermeasures and tasks to drive improvement
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {items.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Progress</span>
            <span>
              {doneCount}/{items.length} done
            </span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all duration-500"
              style={{
                width: `${items.length > 0 ? (doneCount / items.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mb-3 p-3 bg-rose-950/70 border border-rose-700 text-rose-300 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
              item.status === "DONE"
                ? "bg-teal-950/20 border-teal-900"
                : "bg-slate-800 border-slate-700"
            }`}
          >
            <button
              onClick={() => handleToggle(item)}
              disabled={saving === item.id}
              className="mt-0.5 shrink-0 cursor-pointer text-teal-500 hover:text-teal-300 transition-colors"
            >
              {saving === item.id ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : item.status === "DONE" ? (
                <CheckSquare className="w-5 h-5" />
              ) : (
                <Square className="w-5 h-5 text-slate-500" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-semibold ${item.status === "DONE" ? "line-through text-slate-500" : "text-white"}`}
              >
                {item.description}
              </p>
              <div className="flex gap-3 mt-0.5 text-xs text-slate-500">
                <span>👤 {item.ownerName}</span>
                <span>
                  📅{" "}
                  {new Date(item.dueDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        ))}

        {items.length === 0 && !adding && (
          <p className="text-center text-slate-600 text-sm py-6">
            No action items yet. Add your first countermeasure.
          </p>
        )}
      </div>

      {adding && (
        <div className="mt-4 p-4 bg-slate-800 border border-slate-600 rounded-xl space-y-3">
          <p className="text-sm font-bold text-white">New Action Item</p>
          <input
            type="text"
            value={newItem.description}
            onChange={(e) =>
              setNewItem({ ...newItem, description: e.target.value })
            }
            placeholder="What needs to be done?"
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={newItem.ownerName}
              onChange={(e) =>
                setNewItem({ ...newItem, ownerName: e.target.value })
              }
              placeholder="Owner name"
              className="bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
            />
            <input
              type="date"
              value={newItem.dueDate}
              onChange={(e) =>
                setNewItem({ ...newItem, dueDate: e.target.value })
              }
              className="bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              className="flex-1 py-2 rounded-xl border border-slate-600 text-slate-400 text-sm hover:bg-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={saving === "new"}
              className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold cursor-pointer disabled:opacity-50"
            >
              {saving === "new" ? "Adding..." : "Add Item"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Export ─────────────────────────────────────────────────────────────

export default function KaizenDetailClient({ project }: { project: Project }) {
  const TYPE_COLORS: Record<string, string> = {
    KAIZEN: "bg-purple-900/60 border-purple-700 text-purple-300",
    DMAIC: "bg-blue-900/60 border-blue-700 text-blue-300",
  };
  const STATUS_COLORS: Record<string, string> = {
    OPEN: "bg-slate-700 text-slate-300",
    IN_PROGRESS: "bg-emerald-900/60 text-emerald-300",
    COMPLETED: "bg-teal-900/60 text-teal-300",
    ON_HOLD: "bg-amber-900/60 text-amber-300",
  };

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
        <div className="flex items-start gap-3 flex-wrap mb-3">
          <span
            className={`px-3 py-1 rounded-lg text-xs font-black uppercase border ${TYPE_COLORS[project.type]}`}
          >
            {project.type}
          </span>
          <span
            className={`px-3 py-1 rounded-lg text-xs font-bold ${STATUS_COLORS[project.status]}`}
          >
            {project.status.replace("_", " ")}
          </span>
        </div>
        <h1 className="text-2xl font-extrabold text-white mb-2 leading-snug">
          {project.title}
        </h1>
        {project.description && (
          <p className="text-slate-400 text-sm mb-4">{project.description}</p>
        )}
        <div className="flex gap-5 text-sm text-slate-500 flex-wrap">
          <span>
            👤 <span className="text-slate-300">{project.ownerName}</span>
          </span>
          {project.machine && (
            <span>
              🔧{" "}
              <span className="text-slate-300">
                {project.machine.code} — {project.machine.name}
              </span>
            </span>
          )}
          {project.expectedAnnualSavings && (
            <span>
              💰{" "}
              <span className="text-emerald-400 font-bold">
                ${project.expectedAnnualSavings.toLocaleString()}/yr savings
              </span>
            </span>
          )}
        </div>
      </div>

      {/* DMAIC Stepper — only for DMAIC */}
      {project.type === "DMAIC" && (
        <DmaicStepper
          projectId={project.id}
          currentPhase={project.phase}
          currentStatus={project.status}
        />
      )}

      {/* 5 Whys */}
      <FiveWhysSection projectId={project.id} initial={project.rcaRecord} />

      {/* Action Items */}
      <ActionItemsSection
        projectId={project.id}
        initialItems={project.actionItems}
      />
    </div>
  );
}
