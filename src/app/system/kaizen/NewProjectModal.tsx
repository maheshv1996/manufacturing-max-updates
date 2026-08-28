"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Loader2 } from "lucide-react";

interface Machine {
  id: string;
  name: string;
  code: string;
}

export default function NewProjectModal({ machines }: { machines: Machine[] }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "KAIZEN",
    ownerName: "",
    machineId: "",
    expectedAnnualSavings: "",
  });

  const handleSubmit = async () => {
    setError(null);
    if (!form.title.trim() || !form.ownerName.trim()) {
      setError("Title and Owner are required.");
      return;
    }
    try {
      setSaving(true);
      const res = await fetch("/api/kaizen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setOpen(false);
      setForm({
        title: "",
        description: "",
        type: "KAIZEN",
        ownerName: "",
        machineId: "",
        expectedAnnualSavings: "",
      });
      router.push(`/system/kaizen/${data.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-sm cursor-pointer transition-colors shadow-lg shadow-purple-600/30"
      >
        <Plus className="w-4 h-4" />
        New Project
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)" }}
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                New Improvement Project
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-950/70 border border-rose-700 text-rose-300 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Project Title *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Reduce CNC-01 cycle time by 15%"
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Type
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="KAIZEN">KAIZEN</option>
                    <option value="DMAIC">DMAIC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Owner *
                  </label>
                  <input
                    type="text"
                    value={form.ownerName}
                    onChange={(e) =>
                      setForm({ ...form, ownerName: e.target.value })
                    }
                    placeholder="Your name"
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Brief description of the problem and improvement goal..."
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Machine (optional)
                  </label>
                  <select
                    value={form.machineId}
                    onChange={(e) =>
                      setForm({ ...form, machineId: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="">— None —</option>
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} · {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Expected Savings ($/yr)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.expectedAnnualSavings}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        expectedAnnualSavings: e.target.value,
                      })
                    }
                    placeholder="e.g. 25000"
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {saving ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
