"use client";

import { useState, useEffect } from "react";
import {
  ArrowUp,
  ArrowDown,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  X,
} from "lucide-react";

const KNOWN_TARGETS = [
  { label: "/ (Dashboard)", value: "/" },
  {
    label: "/quotations (Sales & Quotations)",
    value: "/commercial/quotations",
  },
  { label: "/work-orders (Work Orders)", value: "/ops/work-orders" },
  { label: "/operator (Operator Station)", value: "/terminal" },
  { label: "/andon (Andon Floor View)", value: "/ops/andon" },
  {
    label: "/attendance (Attendance & Efficiency)",
    value: "/people/attendance",
  },
  { label: "/schedule (Master Schedule)", value: "/ops/schedule" },
  { label: "/spc (SPC Quality)", value: "/ops/spc" },
  { label: "/kaizen (Kaizen & LSS Projects)", value: "/system/kaizen" },
  { label: "/handover (Shift Handover)", value: "/people/handover" },
  { label: "/reconcile (Log Reconciliation)", value: "/supply/reconcile" },
  { label: "/lean (Lean Analytics)", value: "/system/lean" },
  { label: "/reports/daily (Daily Reports)", value: "/reports/daily" },
  { label: "/digest (Executive Digest)", value: "/digest" },
  { label: "/leaderboard (Leaderboard)", value: "/people/leaderboard" },
  { label: "print-pack (Action: Print Morning Pack)", value: "print-pack" },
];

export default function RoutinesTab() {
  const [activeRole, setActiveRole] = useState<
    "ADMIN" | "SUPERVISOR" | "OPERATOR"
  >("OPERATOR");
  const [steps, setSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Edit / Add Modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    initialData: any | null;
    title: string;
    target: string;
    timeLabel: string;
  }>({
    isOpen: false,
    initialData: null,
    title: "",
    target: KNOWN_TARGETS[0].value,
    timeLabel: "",
  });

  const fetchSteps = async (role: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/routines?role=${role}`);
      if (res.ok) {
        const json = await res.json();
        setSteps(json.steps || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSteps(activeRole);
  }, [activeRole]);

  const handleReorder = async (index: number, direction: "up" | "down") => {
    const newSteps = [...steps];
    const targetIdx = direction === "up" ? index - 1 : index + 1;

    if (targetIdx < 0 || targetIdx >= newSteps.length) return;

    // Swap items
    const temp = newSteps[index];
    newSteps[index] = newSteps[targetIdx];
    newSteps[targetIdx] = temp;

    // Update seq property
    const updatedSteps = newSteps.map((s, idx) => ({ ...s, seq: idx + 1 }));
    setSteps(updatedSteps);

    try {
      await fetch("/api/routines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reorder",
          role: activeRole,
          steps: updatedSteps.map((s) => ({ id: s.id, seq: s.seq })),
        }),
      });
    } catch (err) {
      console.error("Failed to reorder steps:", err);
      fetchSteps(activeRole);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this routine step?")) return;

    try {
      const res = await fetch("/api/routines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      if (res.ok) {
        fetchSteps(activeRole);
      }
    } catch (err) {
      console.error("Failed to delete step:", err);
    }
  };

  const handleOpenAdd = () => {
    setModalState({
      isOpen: true,
      initialData: null,
      title: "",
      target: KNOWN_TARGETS[0].value,
      timeLabel: "",
    });
  };

  const handleOpenEdit = (step: any) => {
    setModalState({
      isOpen: true,
      initialData: step,
      title: step.title,
      target: step.target,
      timeLabel: step.timeLabel || "",
    });
  };

  const handleSaveStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const isEdit = Boolean(modalState.initialData);
      const res = await fetch("/api/routines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isEdit ? "update" : "create",
          id: modalState.initialData?.id,
          role: activeRole,
          title: modalState.title,
          target: modalState.target,
          timeLabel: modalState.timeLabel,
        }),
      });

      if (res.ok) {
        setModalState((prev) => ({ ...prev, isOpen: false }));
        fetchSteps(activeRole);
      } else {
        alert("Failed to save routine step");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Role Filter Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div className="flex gap-2">
          {(["OPERATOR", "SUPERVISOR", "ADMIN"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setActiveRole(r)}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold tracking-wider transition-all ${
                activeRole === r
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              {r} ROUTINE
            </button>
          ))}
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-500/20 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Step to {activeRole}
        </button>
      </div>

      {/* Routine Steps Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : steps.length === 0 ? (
        <div className="text-center p-12 bg-slate-900 rounded-xl border border-slate-800">
          <p className="text-slate-400">
            No routine steps configured for {activeRole}.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-800/50 text-slate-300 font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Seq</th>
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">Time Label</th>
                  <th className="px-6 py-4">Target Route / Action</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {steps.map((step, idx) => (
                  <tr
                    key={step.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-slate-400">
                      #{step.seq}
                    </td>
                    <td className="px-6 py-4 font-bold text-white">
                      {step.title}
                    </td>
                    <td className="px-6 py-4">
                      {step.timeLabel ? (
                        <span className="px-2.5 py-1 bg-slate-800 rounded border border-slate-700 text-xs font-mono text-cyan-300">
                          ⏱ {step.timeLabel}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-blue-400">
                      {step.target}
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button
                        disabled={idx === 0}
                        onClick={() => handleReorder(idx, "up")}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded border border-slate-700 transition-colors"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        disabled={idx === steps.length - 1}
                        onClick={() => handleReorder(idx, "down")}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded border border-slate-700 transition-colors"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(step)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition-colors border border-slate-700 text-xs font-bold"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(step.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 rounded-lg transition-colors border border-rose-800/60 text-xs font-bold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Step Modal */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-xl font-bold text-white">
                {modalState.initialData
                  ? "Edit Routine Step"
                  : "Add Routine Step"}
              </h3>
              <button
                onClick={() =>
                  setModalState((prev) => ({ ...prev, isOpen: false }))
                }
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStep} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  Step Title *
                </label>
                <input
                  type="text"
                  required
                  value={modalState.title}
                  onChange={(e) =>
                    setModalState((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-blue-500"
                  placeholder="e.g. 5S & machine check"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  Time Label (Optional)
                </label>
                <input
                  type="text"
                  value={modalState.timeLabel}
                  onChange={(e) =>
                    setModalState((prev) => ({
                      ...prev,
                      timeLabel: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Start of shift, +5 min, 08:00 AM"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  Target Route / Action *
                </label>
                <select
                  value={modalState.target}
                  onChange={(e) =>
                    setModalState((prev) => ({
                      ...prev,
                      target: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-blue-500 mb-2"
                >
                  {KNOWN_TARGETS.map((kt) => (
                    <option key={kt.value} value={kt.value}>
                      {kt.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={modalState.target}
                  onChange={(e) =>
                    setModalState((prev) => ({
                      ...prev,
                      target: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-800/50 border border-slate-700/80 rounded-xl px-4 py-2 text-xs text-slate-300 font-mono focus:outline-none"
                  placeholder="Or enter custom URL/action"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() =>
                    setModalState((prev) => ({ ...prev, isOpen: false }))
                  }
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/30 transition-all disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Step"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
