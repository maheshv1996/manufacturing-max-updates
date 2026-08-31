"use client";


import { logClientError } from "@/lib/clientLogger";
import { useEffect, useState, useCallback } from "react";
import SubFunctionGrid from "@/app/components/shared/SubFunctionGrid";
import {
  FolderKanban,
  Plus,
  Search,
  Calendar,
  AlertTriangle,
  Clock,
  Building2,
  Layers,
  X,
  Save,
  Loader2,
  Trash2,
  Wrench,
  Gauge,
  ShieldAlert,
} from "lucide-react";

interface Machine {
  id: string;
  name: string;
  code: string;
  stationName?: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  routingSteps?: any[];
}

interface Operation {
  id: string;
  code: string;
  name: string;
}

interface WorkOrder {
  id: string;
  woNumber: string;
  plannedQuantity: number;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";
  currentSeq: number;
  product?: Product;
}

interface BottleneckWarning {
  id: string;
  type:
    "STATION_OVERLOAD" | "WORK_ORDER_HOLD" | "TARGET_DATE_RISK" | "LONG_SETUP";
  severity: "HIGH" | "CRITICAL" | "WARNING";
  title: string;
  message: string;
  stationName?: string;
  machineCode?: string;
  woNumber?: string;
}

interface MachineLoadSummary {
  machineId: string | null;
  stationName: string;
  machineCode: string;
  machineName: string;
  totalSetupHours: number;
  totalRunHours: number;
  totalLoadHours: number;
  activeOpCount: number;
  utilizationPct: number;
  isOverloaded: boolean;
}

interface Project {
  id: string;
  name: string;
  code: string;
  clientName: string;
  targetCompletionDate: string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";
  completionPercentage: number;
  description?: string;
  workOrders: WorkOrder[];
  machineLoads?: Record<string, MachineLoadSummary>;
  bottlenecks?: BottleneckWarning[];
  health?: "HIGH" | "MEDIUM" | "LOW";
  salesOwner?: string | null;
  milestones?: Milestone[];
}

interface Milestone {
  id: string;
  name: string;
  dueDate: string;
  status: "OPEN" | "COMPLETED";
  completedAt?: string | null;
}

const STATUS_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  OPEN: {
    bg: "bg-blue-950/60",
    text: "text-blue-300",
    border: "border-blue-700/50",
  },
  IN_PROGRESS: {
    bg: "bg-emerald-950/60",
    text: "text-emerald-300",
    border: "border-emerald-700/50",
  },
  COMPLETED: {
    bg: "bg-slate-800/80",
    text: "text-slate-300",
    border: "border-slate-600",
  },
  ON_HOLD: {
    bg: "bg-amber-950/60",
    text: "text-amber-300",
    border: "border-amber-700/50",
  },
};

const SEVERITY_BADGES: Record<string, string> = {
  CRITICAL: "bg-rose-950 border-rose-700 text-rose-300",
  HIGH: "bg-amber-950 border-amber-700 text-amber-300",
  WARNING: "bg-yellow-950 border-yellow-700 text-yellow-300",
};

export default function ProjectsDashboardClient() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // New Project Form Data
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [projectStatus, setProjectStatus] = useState<Project["status"]>("OPEN");
  const [description, setDescription] = useState("");

  // Sub-component Work Orders configuration
  const [subComponents, setSubComponents] = useState<
    Array<{
      woNumber: string;
      productId: string;
      plannedQuantity: number;
      routingSteps: Array<{
        seq: number;
        operationCode: string;
        operationName: string;
        machineId: string;
        stationName: string;
        setupTimeMin: number;
        cycleTimeMin: number;
        instructions: string;
      }>;
    }>
  >([
    {
      woNumber: `WO-${Math.floor(1000 + Math.random() * 9000)}`,
      productId: "",
      plannedQuantity: 500,
      routingSteps: [
        {
          seq: 1,
          operationCode: "OP10",
          operationName: "CNC Milling Pass",
          machineId: "",
          stationName: "CNC Bay 01",
          setupTimeMin: 20,
          cycleTimeMin: 1.5,
          instructions: "Secure part in Vice 01. Run facing program.",
        },
        {
          seq: 2,
          operationCode: "OP20",
          operationName: "Lathe Turning",
          machineId: "",
          stationName: "Lathe Station 03",
          setupTimeMin: 15,
          cycleTimeMin: 1.0,
          instructions: "Perform outer diameter finish turning pass.",
        },
      ],
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      const data = await res.json();
      setProjects(data.projects || []);
      setMachines(data.machines || []);
      setProducts(data.products || []);
      setOperations(data.operations || []);

      // Set default productId if available
      if (data.products?.length > 0 && !subComponents[0].productId) {
        setSubComponents((prev) =>
          prev.map((sc) => ({ ...sc, productId: data.products[0].id })),
        );
      }
    } catch (err) {
      logClientError(err, "page");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Handle Form Submission
  const handleSaveProject = async () => {
    try {
      setError(null);
      if (!projectName.trim() || !clientName.trim() || !targetDate) {
        setError(
          "Project Name, Client Name, and Target Completion Date are required.",
        );
        return;
      }

      setSaving(true);
      if (editingProject) {
        // Update Project
        const res = await fetch(`/api/projects/${editingProject.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: projectName,
            clientName,
            targetCompletionDate: targetDate,
            status: projectStatus,
            description,
          }),
        });
        if (!res.ok) throw new Error("Failed to update project");
      } else {
        // Create New Project with sub-components
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: projectName,
            clientName,
            targetCompletionDate: targetDate,
            status: projectStatus,
            description,
            batchWorkOrders: subComponents.filter(
              (sc) => sc.productId && sc.plannedQuantity > 0,
            ),
          }),
        });
        if (!res.ok) throw new Error("Failed to create project");
      }

      setShowCreateModal(false);
      resetForm();
      fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving project");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this project? Linked work orders will be unlinked.",
      )
    )
      return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete project");
      fetchProjects();
    } catch (err) {
      alert("Error deleting project");
    }
  };

  const resetForm = () => {
    setEditingProject(null);
    setProjectName("");
    setClientName("");
    setTargetDate(
      new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    );
    setProjectStatus("OPEN");
    setDescription("");
    setSubComponents([
      {
        woNumber: `WO-${Math.floor(1000 + Math.random() * 9000)}`,
        productId: products[0]?.id || "",
        plannedQuantity: 500,
        routingSteps: [
          {
            seq: 1,
            operationCode: "OP10",
            operationName: "CNC Milling Pass",
            machineId: machines[0]?.id || "",
            stationName: "CNC Bay 01",
            setupTimeMin: 20,
            cycleTimeMin: 1.5,
            instructions: "Secure part in Vice 01. Run facing program.",
          },
          {
            seq: 2,
            operationCode: "OP20",
            operationName: "Lathe Turning",
            machineId: machines[1]?.id || "",
            stationName: "Lathe Station 03",
            setupTimeMin: 15,
            cycleTimeMin: 1.0,
            instructions: "Perform outer diameter finish turning pass.",
          },
        ],
      },
    ]);
  };

  // Add Sub-component WO
  const addSubComponent = () => {
    setSubComponents((prev) => [
      ...prev,
      {
        woNumber: `WO-${Math.floor(1000 + Math.random() * 9000)}`,
        productId: products[0]?.id || "",
        plannedQuantity: 500,
        routingSteps: [
          {
            seq: 1,
            operationCode: "OP10",
            operationName: "Milling",
            machineId: machines[0]?.id || "",
            stationName: "CNC Bay",
            setupTimeMin: 15,
            cycleTimeMin: 1.5,
            instructions: "Perform primary machining operation.",
          },
        ],
      },
    ]);
  };

  // Filtered Projects
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate Metrics
  const totalProjects = projects.length;
  const inProgressProjects = projects.filter(
    (p) => p.status === "IN_PROGRESS",
  ).length;
  const bottleneckCount = projects.reduce(
    (acc, p) => acc + (p.bottlenecks?.length || 0),
    0,
  );
  const avgCompletion =
    totalProjects > 0
      ? Math.round(
          projects.reduce((acc, p) => acc + p.completionPercentage, 0) /
            totalProjects,
        )
      : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ── HEADER ── */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/20 border border-blue-500/40 rounded-xl text-blue-400">
                <FolderKanban className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-white">
                  Project Portfolio & Multi-Op Routing
                </h1>
                <p className="text-slate-400 text-sm mt-0.5">
                  Multi-Work Order scheduling, machine capacity planning, and
                  critical-path bottleneck tracking
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            Create New Project
          </button>
        </div>

        {/* Tile-first: sub-function tiles with breadcrumb back to the gateway */}
        <SubFunctionGrid deptId="projects" />

        {/* ── METRICS SUMMARY CARDS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total Projects
              </p>
              <p className="text-3xl font-black text-white mt-1">
                {totalProjects}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Active client portfolios
              </p>
            </div>
            <div className="p-3 bg-slate-800 rounded-2xl text-slate-300">
              <Building2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                In Production
              </p>
              <p className="text-3xl font-black text-emerald-400 mt-1">
                {inProgressProjects}
              </p>
              <p className="text-xs text-emerald-500/80 mt-1">
                Active manufacturing steps
              </p>
            </div>
            <div className="p-3 bg-emerald-950/60 border border-emerald-800/50 rounded-2xl text-emerald-400">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Avg Completion
              </p>
              <p className="text-3xl font-black text-cyan-400 mt-1">
                {avgCompletion}%
              </p>
              <p className="text-xs text-cyan-500/80 mt-1">
                Derived from operation steps
              </p>
            </div>
            <div className="p-3 bg-cyan-950/60 border border-cyan-800/50 rounded-2xl text-cyan-400">
              <Gauge className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Bottlenecks Alert
              </p>
              <p className="text-3xl font-black text-amber-400 mt-1">
                {bottleneckCount}
              </p>
              <p className="text-xs text-amber-500/80 mt-1">
                Critical path constraints
              </p>
            </div>
            <div className="p-3 bg-amber-950/60 border border-amber-800/50 rounded-2xl text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* ── CONTROLS & FILTER BAR ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search projects or clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            {["ALL", "OPEN", "IN_PROGRESS", "ON_HOLD", "COMPLETED"].map(
              (st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === st
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                      : "bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  {st.replace("_", " ")}
                </button>
              ),
            )}
          </div>
        </div>

        {/* ── P29 PROGRAM HEALTH STRIP ── */}
        {(() => {
          const atRisk = filteredProjects.filter(
            (p) => p.health === "HIGH" || p.health === "MEDIUM",
          );
          if (atRisk.length === 0) return null;
          return (
            <div className="bg-rose-950/30 border-2 border-rose-700/50 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-rose-300">
                <AlertTriangle className="w-4 h-4" /> Program Health —{" "}
                {atRisk.filter((p) => p.health === "HIGH").length} at risk
              </div>
              {atRisk.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.5 rounded ${p.health === "HIGH" ? "bg-rose-600 text-white" : "bg-amber-500 text-black"}`}
                  >
                    {p.health === "HIGH" ? "AT RISK" : "DUE SOON"}
                  </span>
                  <span className="font-mono font-bold text-rose-200">
                    {p.code}
                  </span>
                  <span className="text-slate-300 truncate">{p.name}</span>
                  <span className="text-xs text-slate-500 hidden sm:inline">
                    {p.salesOwner ? `· owner ${p.salesOwner}` : ""}
                  </span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── PROJECTS OVERVIEW CARDS ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span>Loading projects portfolio...</span>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-12 text-center max-w-md mx-auto space-y-4">
            <FolderKanban className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-lg font-bold text-white">No Projects Found</h3>
            <p className="text-sm text-slate-400">
              Create your first project portfolio to group work orders and
              configure sequential machine routing steps.
            </p>
            <button
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl cursor-pointer"
            >
              + Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredProjects.map((project) => {
              const statusStyle =
                STATUS_COLORS[project.status] || STATUS_COLORS.OPEN;
              const targetDateObj = new Date(project.targetCompletionDate);
              const isOverdue =
                targetDateObj < new Date() && project.status !== "COMPLETED";

              return (
                <div
                  key={project.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-6 shadow-xl space-y-6 transition-all hover:shadow-2xl"
                >
                  {/* Card Top Banner */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 bg-cyan-950/80 border border-cyan-700/50 text-cyan-300 font-mono text-xs font-bold rounded-lg">
                          🏢 {project.clientName}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          #{project.code}
                        </span>
                      </div>
                      <h2 className="text-xl font-extrabold text-white tracking-tight">
                        {project.name}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {project.health === "HIGH" && (
                        <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-rose-600 text-white border border-rose-500 shadow-[0_0_12px_rgba(225,29,72,0.4)]">
                          ⚠ AT RISK
                        </span>
                      )}
                      {project.health === "MEDIUM" && (
                        <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-amber-500 text-black">
                          DUE SOON
                        </span>
                      )}
                      <span
                        className={`px-3 py-1 text-xs font-bold rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                      >
                        {project.status.replace("_", " ")}
                      </span>
                      <button
                        onClick={() => handleDeleteProject(project.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Delete project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {project.description && (
                    <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
                      {project.description}
                    </p>
                  )}

                  {/* Overall Derived Completion Progress Bar */}
                  <div className="space-y-2 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-blue-400" />
                        Overall Derived Completion
                      </span>
                      <span className="text-cyan-300 font-mono text-sm">
                        {project.completionPercentage}%
                      </span>
                    </div>

                    <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden p-0.5 border border-slate-700">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all duration-700 shadow-sm shadow-blue-500/50"
                        style={{ width: `${project.completionPercentage}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 font-mono pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Target: {targetDateObj.toLocaleDateString()}
                        {isOverdue && (
                          <span className="text-rose-400 font-bold ml-1">
                            (Overdue)
                          </span>
                        )}
                      </span>
                      <span>
                        {project.workOrders.length} Sub-component Work Orders
                      </span>
                    </div>
                  </div>

                  {/* P29 Milestones */}
                  {project.milestones && project.milestones.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Milestones
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {project.milestones.map((ms) => {
                          const overdue =
                            ms.status === "OPEN" &&
                            new Date(ms.dueDate) < new Date();
                          return (
                            <span
                              key={ms.id}
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                                ms.status === "COMPLETED"
                                  ? "bg-emerald-950/60 text-emerald-300 border-emerald-700/50"
                                  : overdue
                                    ? "bg-rose-950/60 text-rose-300 border-rose-700/60"
                                    : "bg-slate-800/60 text-slate-300 border-slate-700"
                              }`}
                              title={
                                overdue
                                  ? "Milestone date passed — linked WOs slipped"
                                  : ms.name
                              }
                            >
                              {ms.status === "COMPLETED" ? "✓ " : "○ "}
                              {ms.name} ·{" "}
                              {new Date(ms.dueDate).toLocaleDateString()}
                              {ms.status === "COMPLETED"
                                ? " done"
                                : overdue
                                  ? " OVERDUE"
                                  : ""}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Linked Work Orders Breakdown */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      Linked Work Orders & Multi-Op Routing
                    </h4>

                    {project.workOrders.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">
                        No work orders currently assigned to this project.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {project.workOrders.map((wo) => {
                          const steps = wo.product?.routingSteps || [];

                          return (
                            <div
                              key={wo.id}
                              className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-white font-mono">
                                    {wo.woNumber}
                                  </span>
                                  <span className="text-xs text-slate-400 font-medium">
                                    · {wo.product?.name || "Product"}
                                  </span>
                                  <span className="text-xs font-mono text-slate-400">
                                    (Qty: {wo.plannedQuantity})
                                  </span>
                                </div>

                                {steps.length > 0 && (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {steps.map((st) => (
                                      <span
                                        key={st.id || st.seq}
                                        className={`text-xs px-2 py-0.5 rounded-md font-mono border ${
                                          st.seq < wo.currentSeq ||
                                          wo.status === "COMPLETED"
                                            ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/60"
                                            : st.seq === wo.currentSeq &&
                                                wo.status === "IN_PROGRESS"
                                              ? "bg-cyan-950 text-cyan-200 border-cyan-500 font-bold ring-1 ring-cyan-500/50"
                                              : "bg-slate-900 text-slate-500 border-slate-800"
                                        }`}
                                      >
                                        Op {st.seq * 10} (
                                        {st.machine?.code || st.stationName})
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <span
                                className={`self-start sm:self-center px-2 py-0.5 text-xs font-bold rounded-lg border ${
                                  STATUS_COLORS[wo.status]?.bg || "bg-slate-800"
                                } ${STATUS_COLORS[wo.status]?.text || "text-slate-300"} ${
                                  STATUS_COLORS[wo.status]?.border ||
                                  "border-slate-700"
                                }`}
                              >
                                {wo.status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Critical Path Bottleneck Warnings */}
                  {project.bottlenecks && project.bottlenecks.length > 0 && (
                    <div className="space-y-2 bg-rose-950/30 border border-rose-800/40 rounded-2xl p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
                        Critical-Path Bottleneck Warnings (
                        {project.bottlenecks.length})
                      </h4>

                      <div className="space-y-2">
                        {project.bottlenecks.map((bn) => (
                          <div
                            key={bn.id}
                            className={`p-2.5 rounded-xl border text-xs font-semibold flex items-start gap-2 ${
                              SEVERITY_BADGES[bn.severity] ||
                              "bg-slate-800 text-white"
                            }`}
                          >
                            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold text-white">{bn.title}</p>
                              <p className="opacity-90 mt-0.5">{bn.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── PROJECT CREATION & BATCH ROUTING MODAL ── */}
        {showCreateModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
            style={{
              background: "rgba(0,0,0,0.85)",
              backdropFilter: "blur(6px)",
            }}
          >
            <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl p-6 sm:p-8 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-2xl font-black text-white">
                    Define Project Scope & Multi-Op Routing
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Group sub-component work orders and configure sequential
                    machine routing steps
                  </p>
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
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form Fields: Project Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. NextGen Turbine Housing Assembly"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lockheed Martin"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Target Completion Date *
                  </label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Project Status
                  </label>
                  <select
                    value={projectStatus}
                    onChange={(e) =>
                      setProjectStatus(e.target.value as Project["status"])
                    }
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="ON_HOLD">ON_HOLD</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Description / Scope
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Project specs, engineering tolerances, and client delivery milestones..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Sub-component Work Orders & Multi-Op Routing Configurator */}
              <div className="space-y-4 border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-blue-400" />
                      Sub-component Work Orders & Sequential Routing Steps
                    </h3>
                    <p className="text-xs text-slate-400">
                      Configure target machine, setup time (min), cycle time
                      (min), and operator instructions per operation step
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addSubComponent}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-300 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Work Order
                  </button>
                </div>

                <div className="space-y-6">
                  {subComponents.map((sc, scIdx) => (
                    <div
                      key={scIdx}
                      className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-4"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 mb-1">
                            WO Number
                          </label>
                          <input
                            type="text"
                            value={sc.woNumber}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSubComponents((prev) =>
                                prev.map((item, idx) =>
                                  idx === scIdx
                                    ? { ...item, woNumber: val }
                                    : item,
                                ),
                              );
                            }}
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-400 mb-1">
                            Target Product / Part
                          </label>
                          <select
                            value={sc.productId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSubComponents((prev) =>
                                prev.map((item, idx) =>
                                  idx === scIdx
                                    ? { ...item, productId: val }
                                    : item,
                                ),
                              );
                            }}
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-400 mb-1">
                            Batch Planned Quantity
                          </label>
                          <input
                            type="number"
                            value={sc.plannedQuantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              setSubComponents((prev) =>
                                prev.map((item, idx) =>
                                  idx === scIdx
                                    ? { ...item, plannedQuantity: val }
                                    : item,
                                ),
                              );
                            }}
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-mono"
                          />
                        </div>
                      </div>

                      {/* Routing Steps Configurator */}
                      <div className="space-y-3 pl-3 border-l-2 border-blue-600/40">
                        <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                          Sequential Machine Operations (Op 10, Op 20...)
                        </p>

                        {sc.routingSteps.map((step, stIdx) => (
                          <div
                            key={stIdx}
                            className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-3"
                          >
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400">
                                  Seq Code
                                </label>
                                <input
                                  type="text"
                                  value={step.operationCode}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSubComponents((prev) =>
                                      prev.map((item, idx) => {
                                        if (idx !== scIdx) return item;
                                        const newSteps = [...item.routingSteps];
                                        newSteps[stIdx].operationCode = val;
                                        return {
                                          ...item,
                                          routingSteps: newSteps,
                                        };
                                      }),
                                    );
                                  }}
                                  className="w-full bg-slate-950 border border-slate-700 text-cyan-300 rounded-lg px-2 py-1 text-xs font-mono font-bold"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-400">
                                  Assigned Machine
                                </label>
                                <select
                                  value={step.machineId}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const selM = machines.find(
                                      (m) => m.id === val,
                                    );
                                    setSubComponents((prev) =>
                                      prev.map((item, idx) => {
                                        if (idx !== scIdx) return item;
                                        const newSteps = [...item.routingSteps];
                                        newSteps[stIdx].machineId = val;
                                        if (selM?.stationName) {
                                          newSteps[stIdx].stationName =
                                            selM.stationName;
                                        }
                                        return {
                                          ...item,
                                          routingSteps: newSteps,
                                        };
                                      }),
                                    );
                                  }}
                                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs"
                                >
                                  <option value="">Select Machine</option>
                                  {machines.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.code} · {m.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-400">
                                  Setup Time (min)
                                </label>
                                <input
                                  type="number"
                                  value={step.setupTimeMin}
                                  onChange={(e) => {
                                    const val =
                                      parseInt(e.target.value, 10) || 0;
                                    setSubComponents((prev) =>
                                      prev.map((item, idx) => {
                                        if (idx !== scIdx) return item;
                                        const newSteps = [...item.routingSteps];
                                        newSteps[stIdx].setupTimeMin = val;
                                        return {
                                          ...item,
                                          routingSteps: newSteps,
                                        };
                                      }),
                                    );
                                  }}
                                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs font-mono"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-400">
                                  Target Cycle Time (min)
                                </label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={step.cycleTimeMin}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setSubComponents((prev) =>
                                      prev.map((item, idx) => {
                                        if (idx !== scIdx) return item;
                                        const newSteps = [...item.routingSteps];
                                        newSteps[stIdx].cycleTimeMin = val;
                                        return {
                                          ...item,
                                          routingSteps: newSteps,
                                        };
                                      }),
                                    );
                                  }}
                                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs font-mono"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 mb-0.5">
                                Machine Instructions for Operator
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Set spindle speed to 3200 RPM, check coolant flow..."
                                value={step.instructions}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSubComponents((prev) =>
                                    prev.map((item, idx) => {
                                      if (idx !== scIdx) return item;
                                      const newSteps = [...item.routingSteps];
                                      newSteps[stIdx].instructions = val;
                                      return {
                                        ...item,
                                        routingSteps: newSteps,
                                      };
                                    }),
                                  );
                                }}
                                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProject}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? "Saving Project..." : "Save Project & Routing"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
