"use client";


import { logClientError } from "@/lib/clientLogger";
import { useEffect, useState, useCallback } from "react";
import {
  Beaker,
  Plus,
  Search,
  X,
  Loader2,
  ChevronRight,
  TrendingUp,
  Activity,
  Save,
} from "lucide-react";
import Link from "next/link";

interface RndProject {
  id: string;
  name: string;
  code: string;
  clientName: string;
  status: string;
  iterationsCount: number;
  totalCost: number;
  passRate: number | null;
  description?: string;
}

export default function RndDashboardClient() {
  const [projects, setProjects] = useState<RndProject[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and Filter
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/rnd");
      if (!res.ok) throw new Error("Failed to fetch projects");
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err) {
      logClientError(err, "page");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = async () => {
    try {
      setError(null);
      if (!projectName.trim() || !clientName.trim()) {
        setError("Project Name and Client Name are required.");
        return;
      }

      setSaving(true);
      const res = await fetch("/api/rnd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          clientName,
          description,
        }),
      });
      if (!res.ok) throw new Error("Failed to create project");

      setShowCreateModal(false);
      setProjectName("");
      setClientName("");
      setDescription("");
      fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving project");
    } finally {
      setSaving(false);
    }
  };

  const filteredProjects = projects.filter((p) => {
    return (
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ── HEADER ── */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600/20 border border-purple-500/40 rounded-xl text-purple-400">
                <Beaker className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-white">
                  R&D & Prototype Lab
                </h1>
                <p className="text-slate-400 text-sm mt-0.5">
                  Manage prototype iterations, test campaigns, and experiment
                  costs
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            New R&D Project
          </button>
        </div>

        {/* ── CONTROLS & FILTER BAR ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search R&D projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* ── PROJECTS GRID ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            <span>Loading R&D projects...</span>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-12 text-center max-w-md mx-auto space-y-4">
            <Beaker className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-lg font-bold text-white">No Projects Found</h3>
            <p className="text-sm text-slate-400">
              Create your first R&D project to start tracking iterations and
              test campaigns.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm rounded-xl cursor-pointer"
            >
              + Create R&D Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <Link
                href={`/rnd/${project.id}`}
                key={project.id}
                className="group bg-slate-900 border border-slate-800 hover:border-purple-500/50 rounded-3xl p-6 shadow-xl space-y-6 transition-all hover:shadow-2xl hover:shadow-purple-900/20 flex flex-col"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 bg-slate-800/80 border border-slate-700/50 text-slate-300 font-mono text-xs font-bold rounded-lg">
                        🏢 {project.clientName}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        #{project.code}
                      </span>
                    </div>
                    <h2 className="text-xl font-extrabold text-white tracking-tight group-hover:text-purple-400 transition-colors">
                      {project.name}
                    </h2>
                  </div>
                </div>

                {project.description && (
                  <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed flex-grow">
                    {project.description}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-800/50">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-blue-400" />
                      Iterations
                    </p>
                    <p className="text-xl font-black text-white">
                      {project.iterationsCount}
                    </p>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      Pass Rate
                    </p>
                    <div className="flex items-end gap-2">
                      <p
                        className={`text-xl font-black ${project.passRate !== null ? (project.passRate >= 80 ? "text-emerald-400" : project.passRate >= 50 ? "text-amber-400" : "text-rose-400") : "text-slate-500"}`}
                      >
                        {project.passRate !== null
                          ? `${project.passRate}%`
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-slate-500 pt-2">
                  <span>Total Cost: ₹{project.totalCost.toLocaleString()}</span>
                  <div className="flex items-center gap-1 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    View Details <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* ── PROJECT CREATION MODAL ── */}
        {showCreateModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{
              background: "rgba(0,0,0,0.85)",
              backdropFilter: "blur(6px)",
            }}
          >
            <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-2xl font-black text-white">
                    New R&D Project
                  </h2>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="p-4 bg-rose-950/80 border border-rose-700 text-rose-200 rounded-2xl text-sm flex items-center gap-2">
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. NextGen Turbine Prototype"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DRDO"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Description / Scope
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe the research goals..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl cursor-pointer transition-colors"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={saving}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm rounded-xl flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Create Project
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
