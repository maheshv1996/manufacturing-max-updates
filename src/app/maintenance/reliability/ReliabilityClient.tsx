"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import { Wrench, CheckCircle2, Plus, Calendar, X } from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface MachineMetric {
  id: string;
  code: string;
  name: string;
  lineName: string;
  status: string;
  currentState: string;
  iotEnabled: boolean;
  totalBreakdowns: number;
  totalDowntimeMinutes: number;
  mtbfHours: number;
  mttrMinutes: number;
  availabilityPct: number;
  healthScore: number;
  openJobsCount: number;
  pmRulesCount: number;
}

interface MaintenanceJob {
  id: string;
  machineId: string;
  machine: {
    id: string;
    code: string;
    name: string;
  };
  requestedByName: string;
  type: string;
  priority: string;
  description: string;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  openedAt: string;
  closedAt?: string | null;
  closedBy?: string | null;
  rootCause?: string | null;
  countermeasure?: string | null;
}

interface PMRuleItem {
  id: string;
  title: string;
  intervalDays?: number | null;
  intervalRunHours?: number | null;
  lastDoneAt?: string | null;
  machine: {
    id: string;
    code: string;
    name: string;
  };
}

export default function ReliabilityClient() {
  const [machines, setMachines] = useState<MachineMetric[]>([]);
  const [jobs, setJobs] = useState<MaintenanceJob[]>([]);
  const [pmRules, setPmRules] = useState<PMRuleItem[]>([]);
  const [summary, setSummary] = useState({
    avgMtbfHours: 0,
    avgMttrMinutes: 0,
    plantAvailabilityPct: 0,
    activeBreakdownJobs: 0,
    totalMachines: 0,
  });
  const [_loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"MATRIX" | "KANBAN" | "PM">(
    "MATRIX",
  );

  // Modal states
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<MaintenanceJob | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formMachineId, setFormMachineId] = useState("");
  const [formType, setFormType] = useState("BREAKDOWN");
  const [formPriority, setFormPriority] = useState("HIGH");
  const [formDesc, setFormDesc] = useState("");
  const [formOperator, setFormOperator] = useState("");

  // Close Job Form
  const [closeRootCause, setCloseRootCause] = useState("");
  const [closeCountermeasure, setCloseCountermeasure] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/maintenance/reliability");
      if (res.ok) {
        const data = await res.json();
        setMachines(data.machines || []);
        setJobs(data.maintenanceJobs || []);
        setPmRules(data.pmRules || []);
        setSummary(
          data.summary || {
            avgMtbfHours: 0,
            avgMttrMinutes: 0,
            plantAvailabilityPct: 0,
            activeBreakdownJobs: 0,
            totalMachines: 0,
          },
        );
      }
    } catch (err) {
      logClientError("Failed to load reliability data:", err, "ReliabilityClient");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showLogModal) setShowLogModal(false);
        if (selectedJob) setSelectedJob(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showLogModal, selectedJob]);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMachineId || !formDesc) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/maintenance/reliability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machineId: formMachineId,
          type: formType,
          priority: formPriority,
          description: formDesc,
          requestedByName: formOperator || "Floor Technician",
        }),
      });

      if (res.ok) {
        setShowLogModal(false);
        setFormMachineId("");
        setFormDesc("");
        setFormOperator("");
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to log maintenance request");
      }
    } catch (err) {
      logClientError("Create job error", err, "ReliabilityClient");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateJobStatus = async (jobId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/maintenance/reliability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          status: newStatus,
          rootCause: closeRootCause || undefined,
          countermeasure: closeCountermeasure || undefined,
        }),
      });
      if (res.ok) {
        setSelectedJob(null);
        setCloseRootCause("");
        setCloseCountermeasure("");
        await fetchData();
      }
    } catch (err) {
      logClientError("Update job error", err, "ReliabilityClient");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Total Productive Maintenance (TPM & Reliability)"
        description="Equipment reliability analytics, MTBF/MTTR tracking, autonomous PM schedules, and maintenance dispatch."
      >
        <button
          onClick={() => setShowLogModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Log Maintenance Request
        </button>
      </PageHeader>

      {/* TPM Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Factory MTBF
          </span>
          <div className="text-2xl font-black font-mono text-cyan-400 mt-1">
            {summary.avgMtbfHours} hrs
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Mean Time Between Failures
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Factory MTTR
          </span>
          <div className="text-2xl font-black font-mono text-amber-400 mt-1">
            {summary.avgMttrMinutes} mins
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Mean Time To Repair
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Plant Availability
          </span>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
            {summary.plantAvailabilityPct}%
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Equipment uptime ratio
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Active Breakdowns
          </span>
          <div className="text-2xl font-black font-mono text-rose-400 mt-1">
            {summary.activeBreakdownJobs} Jobs
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Open repairs on shop floor
          </div>
        </div>
      </div>

      {/* Main Content Tabs */}
      <div className="bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 bg-surface-2 p-1 rounded-xl border border-border w-fit">
          <button
            onClick={() => setActiveTab("MATRIX")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "MATRIX"
                ? "bg-accent text-white shadow-sm"
                : "text-text-3 hover:text-text-1"
            }`}
          >
            Machine Reliability Matrix ({machines.length})
          </button>
          <button
            onClick={() => setActiveTab("KANBAN")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "KANBAN"
                ? "bg-accent text-white shadow-sm"
                : "text-text-3 hover:text-text-1"
            }`}
          >
            Maintenance Kanban ({jobs.length})
          </button>
          <button
            onClick={() => setActiveTab("PM")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "PM"
                ? "bg-accent text-white shadow-sm"
                : "text-text-3 hover:text-text-1"
            }`}
          >
            PM Schedules ({pmRules.length})
          </button>
        </div>

        {/* Tab 1: Reliability Matrix */}
        {activeTab === "MATRIX" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-text-3 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3">Machine Code / Name</th>
                  <th className="py-3">Line</th>
                  <th className="py-3 text-center">Status</th>
                  <th className="py-3 text-right">MTBF</th>
                  <th className="py-3 text-right">MTTR</th>
                  <th className="py-3 text-right">Availability</th>
                  <th className="py-3 text-right">Health Score</th>
                  <th className="py-3 text-center">Active Jobs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {machines.map((m) => {
                  const isHealthy = m.healthScore >= 80;
                  const isWarn = m.healthScore >= 60 && !isHealthy;

                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-surface-2/40 transition-colors"
                    >
                      <td className="py-3">
                        <div className="font-extrabold text-text-1">
                          {m.code}
                        </div>
                        <div className="text-[11px] text-text-3 font-sans mt-0.5">
                          {m.name}
                        </div>
                      </td>

                      <td className="py-3 font-sans text-text-3">
                        {m.lineName}
                      </td>

                      <td className="py-3 text-center font-sans">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            m.status === "RUNNING"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : m.status === "DOWN"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>

                      <td className="py-3 text-right font-bold text-cyan-400">
                        {m.mtbfHours} hrs
                      </td>

                      <td className="py-3 text-right font-bold text-amber-400">
                        {m.mttrMinutes} min
                      </td>

                      <td className="py-3 text-right font-bold text-text-1">
                        {m.availabilityPct}%
                      </td>

                      <td className="py-3 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md font-bold text-[11px] ${
                            isHealthy
                              ? "bg-emerald-500/20 text-emerald-300"
                              : isWarn
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-rose-500/20 text-rose-300"
                          }`}
                        >
                          {m.healthScore}/100
                        </span>
                      </td>

                      <td className="py-3 text-center font-sans">
                        {m.openJobsCount > 0 ? (
                          <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded font-bold text-[10px]">
                            {m.openJobsCount} Open
                          </span>
                        ) : (
                          <span className="text-text-3 font-mono">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Maintenance Kanban */}
        {activeTab === "KANBAN" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["OPEN", "IN_PROGRESS", "CLOSED"] as const).map((colStatus) => {
              const colJobs = jobs.filter((j) => {
                if (colStatus === "OPEN") return j.status === "OPEN";
                if (colStatus === "IN_PROGRESS")
                  return (j.status as any) === "IN_PROGRESS";
                return j.status === "CLOSED";
              });

              return (
                <div
                  key={colStatus}
                  className="bg-surface-2/40 border border-border rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-text-2">
                      {colStatus.replace(/_/g, " ")} ({colJobs.length})
                    </h4>
                  </div>

                  <div className="space-y-2.5">
                    {colJobs.length === 0 ? (
                      <div className="text-center py-8 text-xs text-text-3 italic">
                        No jobs in this stage.
                      </div>
                    ) : (
                      colJobs.map((job) => (
                        <div
                          key={job.id}
                          className="bg-surface-1 border border-border rounded-xl p-3.5 shadow-sm space-y-2 hover:border-accent/40 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs text-text-1">
                              {job.machine.code}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                job.priority === "HIGH" ||
                                job.priority === "CRITICAL"
                                  ? "bg-rose-500/20 text-rose-300"
                                  : "bg-blue-500/20 text-blue-300"
                              }`}
                            >
                              {job.type} · {job.priority}
                            </span>
                          </div>

                          <p className="text-xs text-text-2">
                            {job.description}
                          </p>
                          <div className="text-[10px] text-text-3 font-mono">
                            By: {job.requestedByName} ·{" "}
                            {new Date(job.openedAt).toLocaleDateString()}
                          </div>

                          {/* Kanban Actions */}
                          <div className="pt-2 border-t border-border/40 flex justify-end gap-2">
                            {job.status === "OPEN" && (
                              <button
                                onClick={() =>
                                  handleUpdateJobStatus(job.id, "IN_PROGRESS")
                                }
                                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-white rounded text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                Start Work
                              </button>
                            )}
                            {job.status !== "CLOSED" && (
                              <button
                                onClick={() => setSelectedJob(job)}
                                className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white rounded text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                Close & Signoff
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 3: PM Schedules */}
        {activeTab === "PM" && (
          <div className="space-y-3">
            {pmRules.length === 0 ? (
              <div className="text-center py-12 text-xs text-text-3">
                No PM rules defined.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pmRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-4 rounded-2xl bg-surface-2 border border-border flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-text-1 flex items-center gap-2">
                          <span>{rule.title}</span>
                          <span className="font-mono text-[10px] text-text-3">
                            ({rule.machine.code})
                          </span>
                        </div>
                        <div className="text-[11px] text-text-3 mt-0.5">
                          Interval:{" "}
                          <span className="font-mono font-semibold text-text-2">
                            {rule.intervalDays
                              ? `${rule.intervalDays} days`
                              : `${rule.intervalRunHours} run hours`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-300 text-[10px] font-bold rounded-lg font-mono">
                      {rule.lastDoneAt
                        ? `Last: ${new Date(rule.lastDoneAt).toLocaleDateString()}`
                        : "Due for 1st Run"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Log Request Modal */}
      {showLogModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowLogModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="log-maintenance-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-1 border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 id="log-maintenance-title" className="font-extrabold text-text-1 text-base flex items-center gap-2">
                <Wrench className="w-5 h-5 text-accent" />
                Log Maintenance Request
              </h3>
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="p-1 rounded-lg hover:bg-surface-3 text-text-3 hover:text-text-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
                  Machine / Workstation
                </label>
                <select
                  value={formMachineId}
                  onChange={(e) => setFormMachineId(e.target.value)}
                  required
                  className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-xs text-text-1 font-semibold focus:outline-none focus:border-accent"
                >
                  <option value="">-- Choose Machine --</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} — {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
                    Job Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-xs text-text-1 font-semibold focus:outline-none focus:border-accent"
                  >
                    <option value="BREAKDOWN">Unplanned Breakdown</option>
                    <option value="PREVENTIVE">Preventive Maintenance</option>
                    <option value="CALIBRATION">Calibration Check</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
                    Priority
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-xs text-text-1 font-semibold focus:outline-none focus:border-accent"
                  >
                    <option value="HIGH">High (Line Stoppage)</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
                  Issue Description / Symptoms
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  required
                  placeholder="e.g. Spindle bearing vibration high during rough milling, coolant pump pressure drop"
                  rows={3}
                  className="w-full bg-surface-2 border border-border rounded-xl p-3 text-xs text-text-1 focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
                  Logged By (Operator / Technician)
                </label>
                <input
                  type="text"
                  value={formOperator}
                  onChange={(e) => setFormOperator(e.target.value)}
                  placeholder="e.g. Rahul Verma"
                  className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2 text-xs text-text-1 focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-2 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-1/2 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-xs shadow-md transition-colors"
                >
                  {submitting ? "Logging..." : "Dispatch Job"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Job RCA Modal */}
      {selectedJob && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedJob(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rca-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-1 border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 id="rca-modal-title" className="font-extrabold text-text-1 text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Close Job & Record Root Cause (RCA)
              </h3>
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="p-1 rounded-lg hover:bg-surface-3 text-text-3 hover:text-text-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-text-3">
              Machine:{" "}
              <span className="font-bold text-text-1">
                {selectedJob.machine.code}
              </span>{" "}
              · {selectedJob.description}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
                  Root Cause
                </label>
                <input
                  type="text"
                  value={closeRootCause}
                  onChange={(e) => setCloseRootCause(e.target.value)}
                  placeholder="e.g. Clogged coolant filter mesh"
                  className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2 text-xs text-text-1 focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
                  Corrective Action / Countermeasure
                </label>
                <input
                  type="text"
                  value={closeCountermeasure}
                  onChange={(e) => setCloseCountermeasure(e.target.value)}
                  placeholder="e.g. Filter replaced, cleaned housing, verified flow 45L/min"
                  className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2 text-xs text-text-1 focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="w-1/2 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-2 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleUpdateJobStatus(selectedJob.id, "CLOSED")}
                className="w-1/2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors"
              >
                Sign Off & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
