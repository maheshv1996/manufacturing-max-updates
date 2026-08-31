"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Save,
} from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";

interface SubFunctionData {
  name: string;
  desc: string;
  href: string;
}

interface DepartmentData {
  id: string;
  title: string;
  short: string;
  desc: string;
  hub: string;
  functions: SubFunctionData[];
}

export default function DepartmentsManagerClient() {
  const [departments, setDepartments] = useState<DepartmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDept, setEditingDept] = useState<DepartmentData | null>(null);

  // New Department Form State
  const [newTitle, setNewTitle] = useState("");
  const [newShort, setNewShort] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newHub, setNewHub] = useState("");

  const fetchDepartments = async () => {
    try {
      const res = await fetch("/api/system/departments");
      const data = await res.json();
      if (data.success) {
        setDepartments(data.departments);
        if (data.departments.length > 0 && !editingDept) {
          setEditingDept(data.departments[0]);
        }
      }
    } catch (err) {
      logClientError(err, "DepartmentsManagerClient");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newShort.trim()) {
      toast.error("Title and Short Name are required");
      return;
    }

    try {
      const res = await fetch("/api/system/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          short: newShort,
          desc: newDesc,
          hub: newHub || `/${newShort.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
          functions: [],
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to create department");

      setDepartments(data.departments);
      setEditingDept(data.department);
      soundFx.playSuccess();
      toast.success(`Created custom department "${newTitle}"!`);
      setNewTitle("");
      setNewShort("");
      setNewDesc("");
      setNewHub("");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdate = async () => {
    if (!editingDept) return;
    try {
      const res = await fetch("/api/system/departments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingDept),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to update department");

      setDepartments(data.departments);
      soundFx.playSuccess();
      toast.success(`Updated department "${editingDept.title}"!`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}"? Existing operational records will remain safe.`)) return;

    try {
      const res = await fetch(`/api/system/departments?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to delete department");

      setDepartments(data.departments);
      if (editingDept?.id === id) {
        setEditingDept(data.departments[0] || null);
      }
      soundFx.playClick();
      toast.success(`Removed "${name}"`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-slate-950/40 border border-blue-500/20 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-mono font-bold border border-blue-500/30">
              DYNAMIC ORG ARCHITECTURE
            </span>
            <span className="text-xs text-white/50 font-mono">N DEPARTMENTS // 100% USER-DEFINED</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Dynamic Department & Cell Architecture Studio
          </h1>
          <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
            There is no fixed limit of departments. You can add N custom departments, rename any existing unit, attach custom operational capabilities, or delete unused modules anytime.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-black/40 border border-blue-500/30 text-right font-mono">
          <div className="text-[10px] text-white/50 uppercase font-bold">Configured Departments</div>
          <div className="text-2xl font-black text-cyan-300">{departments.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Department List */}
        <div className="space-y-3">
          <h2 className="text-xs font-mono font-bold text-white/70 uppercase tracking-wider flex items-center justify-between">
            <span>Your Active Departments</span>
            <span className="text-cyan-400">{departments.length} Total</span>
          </h2>

          {loading ? (
            <div className="p-8 text-center text-xs text-white/40 font-mono">Loading departments...</div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {departments.map((dept) => {
                const isSelected = editingDept?.id === dept.id;
                return (
                  <div
                    key={dept.id}
                    onClick={() => {
                      setEditingDept({ ...dept });
                      soundFx.playClick();
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-blue-500/15 border-blue-400 ring-1 ring-blue-400/30"
                        : "bg-white/[0.02] hover:bg-white/[0.05] border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-extrabold text-white">{dept.title}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-white/10 text-white/80">
                        {dept.short}
                      </span>
                    </div>

                    <p className="text-[11px] text-white/50 line-clamp-1 leading-relaxed">
                      {dept.desc}
                    </p>

                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/10 text-[10px] text-white/60 font-mono">
                      <span>{dept.functions?.length || 0} Sub-Functions</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(dept.id, dept.title);
                        }}
                        className="text-red-400/70 hover:text-red-300 transition-colors p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Department Editor & Creator */}
        <div className="lg:col-span-2 space-y-6">
          {/* Edit Selected Department Form */}
          {editingDept && (
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-mono font-bold text-white uppercase">
                    Edit / Rename Department: {editingDept.title}
                  </h3>
                </div>
                <button
                  onClick={handleUpdate}
                  className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-mono text-white/60 block mb-1">Full Department Title *</label>
                  <input
                    value={editingDept.title}
                    onChange={(e) => setEditingDept({ ...editingDept, title: e.target.value })}
                    className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-white/60 block mb-1">Short Tab Label *</label>
                  <input
                    value={editingDept.short}
                    onChange={(e) => setEditingDept({ ...editingDept, short: e.target.value })}
                    className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[10px] font-mono text-white/60 block mb-1">Department Description / Scope</label>
                  <input
                    value={editingDept.desc}
                    onChange={(e) => setEditingDept({ ...editingDept, desc: e.target.value })}
                    className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white"
                  />
                </div>
              </div>

              {/* Sub-functions List */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-mono font-bold text-white/80 uppercase flex items-center justify-between">
                  <span>Attached Sub-Functions & Tools ({editingDept.functions?.length || 0})</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {editingDept.functions?.map((fn, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-black/30 border border-white/10 text-xs">
                      <div className="font-bold text-white">{fn.name}</div>
                      <div className="text-[10px] text-white/50 font-mono">{fn.href}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Add Brand New Department Form */}
          <form onSubmit={handleCreate} className="p-6 rounded-3xl bg-blue-950/10 border border-blue-500/20 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <Plus className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-mono font-bold text-white uppercase">
                Add a Brand New Custom Department / Manufacturing Cell
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-mono text-white/60 block mb-1">Department Title *</label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="E.g. 5-Axis Titanium Aerospace Cell"
                  className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-white/60 block mb-1">Short Name *</label>
                <input
                  value={newShort}
                  onChange={(e) => setNewShort(e.target.value)}
                  placeholder="E.g. Titanium Cell"
                  className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-white/60 block mb-1">Scope / Description</label>
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="E.g. Titanium blisks & turbine rings"
                  className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow cursor-pointer flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create Custom Department</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
