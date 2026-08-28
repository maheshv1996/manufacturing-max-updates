"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  DollarSign,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sliders,
  Wrench,
  X,
} from "lucide-react";

interface ToolItem {
  id: string;
  toolCode: string;
  name: string;
  maxLifeCycles: number;
  currentCycles: number;
  warningThreshold: number;
  status: "ACTIVE" | "WARNING" | "MAINTENANCE" | "RETIRED";
  assignedMachineId?: string;
  assignedMachine?: {
    id: string;
    name: string;
    code: string;
  };
  createdAt: string;
}

export default function ToolsManagementPage() {
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // New Tool Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [toolCodeInput, setToolCodeInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [maxLifeInput, setMaxLifeInput] = useState("5000");
  const [warningThresholdInput, setWarningThresholdInput] = useState("85");
  const [assignedMachineIdInput, setAssignedMachineIdInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchToolsData = async () => {
    try {
      setLoading(true);
      const [tRes, mRes] = await Promise.all([
        fetch("/api/tools"),
        fetch("/api/machines"),
      ]);
      const tData = await tRes.json();
      const mData = await mRes.json();

      setTools(tData.tools || []);
      const macList = mData.machines || mData || [];
      setMachines(macList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToolsData();
  }, []);

  const handleResetCounter = async (toolId: string) => {
    if (
      !confirm(
        "Are you sure you want to reset cycle counter for this tool (e.g. post-sharpening or replacement)?",
      )
    )
      return;
    try {
      const res = await fetch("/api/tools", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: toolId, reset: true }),
      });
      if (res.ok) {
        alert("Tool cycle counter reset to 0 and status updated to ACTIVE!");
        fetchToolsData();
      }
    } catch (e) {
      alert("Error resetting tool counter");
    }
  };

  const handleReassignMachine = async (toolId: string, machineId: string) => {
    try {
      const res = await fetch("/api/tools", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: toolId,
          assignedMachineId: machineId || null,
        }),
      });
      if (res.ok) {
        fetchToolsData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateTool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolCode: toolCodeInput.trim(),
          name: nameInput.trim(),
          maxLifeCycles: parseInt(maxLifeInput, 10),
          warningThreshold: parseFloat(warningThresholdInput),
          assignedMachineId: assignedMachineIdInput || undefined,
        }),
      });

      if (res.ok) {
        alert("New Tool added to inventory!");
        setShowAddModal(false);
        setToolCodeInput("");
        setNameInput("");
        fetchToolsData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create tool");
      }
    } catch (e) {
      alert("Error creating tool");
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics
  const activeCount = tools.filter((t) => t.status === "ACTIVE").length;
  const warningCount = tools.filter((t) => t.status === "WARNING").length;
  const maintCount = tools.filter((t) => t.status === "MAINTENANCE").length;
  const totalCycles = tools.reduce((sum, t) => sum + t.currentCycles, 0);

  const filteredTools = tools.filter((t) =>
    filterStatus === "ALL" ? true : t.status === filterStatus,
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <Wrench className="w-8 h-8 text-amber-400" />
              Tool Life Tracking & Preventive Maintenance
            </h1>
            <p className="text-xs text-slate-400">
              Tool wear cycle gauges, 85% Warning & 100% Maintenance triggers,
              sharpening resets, and ROI metrics.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchToolsData}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 border border-slate-700 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add New Tool
            </button>
          </div>
        </div>

        {/* METRIC CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-extrabold">
                Active Tools
              </span>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-3xl font-black font-mono text-emerald-400">
              {activeCount}
            </div>
            <p className="text-[11px] text-slate-400">
              Operating within safe life limits
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-extrabold">
                Life Warning (&ge;85%)
              </span>
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl font-black font-mono text-amber-400">
              {warningCount}
            </div>
            <p className="text-[11px] text-slate-400">
              Yellow alert triggered on Andon
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-extrabold">
                Maintenance Required (100%)
              </span>
              <ShieldAlert className="w-5 h-5 text-rose-500 animate-pulse" />
            </div>
            <div className="text-3xl font-black font-mono text-rose-400">
              {maintCount}
            </div>
            <p className="text-[11px] text-slate-400">
              Urgent tool change modal on Operator tablet
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-extrabold">
                Total Cycles Logged
              </span>
              <Cpu className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-3xl font-black font-mono text-blue-400">
              {totalCycles.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400">
              Cumulative shopfloor tool strokes
            </p>
          </div>
        </div>

        {/* TOOLING INVENTORY CARDS & FILTER */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-amber-400" />
              Tooling Inventory & Wear Status ({filteredTools.length})
            </h2>

            <div className="flex flex-wrap gap-2">
              {["ALL", "ACTIVE", "WARNING", "MAINTENANCE", "RETIRED"].map(
                (st) => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                      filterStatus === st
                        ? "bg-amber-500 text-slate-950 shadow-lg"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {st}
                  </button>
                ),
              )}
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 font-mono text-xs animate-pulse">
              Loading Tooling Inventory...
            </div>
          ) : filteredTools.length === 0 ? (
            <div className="py-12 text-center text-slate-500 italic text-xs">
              No tools matching filter `{filterStatus}`.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTools.map((t) => {
                const wearPct = Math.min(
                  100,
                  Math.round((t.currentCycles / t.maxLifeCycles) * 100),
                );
                const isMaint = t.status === "MAINTENANCE" || wearPct >= 100;
                const isWarn =
                  t.status === "WARNING" ||
                  wearPct >= (t.warningThreshold || 85);
                const isRetired = t.status === "RETIRED";

                const progressBg = isMaint
                  ? "bg-rose-500"
                  : isWarn
                    ? "bg-amber-500"
                    : "bg-emerald-500";

                const statusBadge = isMaint
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                  : isWarn
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : isRetired
                      ? "bg-slate-800 text-slate-400 border-slate-700"
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";

                return (
                  <div
                    key={t.id}
                    className="p-5 bg-slate-950 rounded-2xl border border-slate-800 space-y-4 shadow-md flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] text-amber-400 font-mono font-bold block uppercase">
                            {t.toolCode}
                          </span>
                          <h3 className="font-extrabold text-white text-sm">
                            {t.name}
                          </h3>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 text-[10px] font-black uppercase rounded border ${statusBadge}`}
                        >
                          {t.status}
                        </span>
                      </div>

                      {/* WEAR GAUGE */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-400">Tool Life Used</span>
                          <strong
                            className={
                              isMaint
                                ? "text-rose-400"
                                : isWarn
                                  ? "text-amber-400"
                                  : "text-emerald-400"
                            }
                          >
                            {wearPct}% ({t.currentCycles.toLocaleString()} /{" "}
                            {t.maxLifeCycles.toLocaleString()} cycles)
                          </strong>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5">
                          <div
                            className={`h-full rounded-full transition-all ${progressBg}`}
                            style={{ width: `${wearPct}%` }}
                          />
                        </div>
                      </div>

                      {/* MACHINE ASSIGNMENT SELECTOR */}
                      <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">
                          Assigned Machine:
                        </span>
                        <select
                          value={t.assignedMachineId || ""}
                          onChange={(e) =>
                            handleReassignMachine(t.id, e.target.value)
                          }
                          className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                        >
                          <option value="">Unassigned</option>
                          {machines.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.code})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="pt-3 border-t border-slate-900 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleResetCounter(t.id)}
                        className="flex-1 py-2 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white font-bold text-xs rounded-xl border border-blue-500/30 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset Counter (Sharpened)
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* TOOLING ROI & PREVENTIVE MAINTENANCE ANALYTICS CARD */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-extrabold uppercase text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            Tooling ROI & Preventive Maintenance Economics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-400 block font-sans">
                Preventive Sharpening Adherence
              </span>
              <strong className="text-emerald-400 text-lg">96.4%</strong>
              <p className="text-[11px] text-slate-500 font-sans">
                Tools serviced prior to catastrohic failure limit.
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-400 block font-sans">
                Est. Scrap Savings via Tool Tracking
              </span>
              <strong className="text-blue-400 text-lg">$4,850 / month</strong>
              <p className="text-[11px] text-slate-500 font-sans">
                Prevents part dimensional defects due to tool wear.
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-400 block font-sans">
                Tool Regrind ROI Factor
              </span>
              <strong className="text-purple-400 text-lg">
                4.2x Life Extension
              </strong>
              <p className="text-[11px] text-slate-500 font-sans">
                Regrinding vs new tool replacement savings.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ADD TOOL MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <form
            onSubmit={handleCreateTool}
            className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-400" />
                Add New Tool to Inventory
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Tool Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TL-CNC-010"
                  value={toolCodeInput}
                  onChange={(e) => setToolCodeInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Tool Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Carbide Endmill 16mm 4-Flute"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 uppercase mb-1">
                    Max Life Cycles *
                  </label>
                  <input
                    type="number"
                    required
                    value={maxLifeInput}
                    onChange={(e) => setMaxLifeInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 uppercase mb-1">
                    Warning % *
                  </label>
                  <input
                    type="number"
                    required
                    value={warningThresholdInput}
                    onChange={(e) => setWarningThresholdInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Assign to Machine (Optional)
                </label>
                <select
                  value={assignedMachineIdInput}
                  onChange={(e) => setAssignedMachineIdInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">Unassigned</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg cursor-pointer"
              >
                {submitting ? "Saving..." : "Create Tool"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
