"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Activity,
  Shield,
  Loader2,
  X,
  Calendar,
  User,
  Cpu,
  AlertCircle,
} from "lucide-react";
import SourceRecordEditModal from "@/app/components/modals/SourceRecordEditModal";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Machine {
  id: string;
  name: string;
  code: string;
}

interface MaintenanceJob {
  id: string;
  machine: Machine;
  requestedByName: string;
  type: "BREAKDOWN" | "PM";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  openedAt: string;
  closedAt?: string;
  closedBy?: string;
  rootCause?: string;
  countermeasure?: string;
  partsUsed?: string;
  costRupees?: number;
  laborHours?: number;
}

interface PMRule {
  id: string;
  machine: Machine;
  title: string;
  intervalDays?: number;
  intervalRunHours?: number;
  lastDoneAt?: string;
  nextDue?: string;
  isOverdue: boolean;
  daysDiff?: number;
}

interface MaintenanceTool {
  id: string;
  code: string;
  name?: string;
  machine?: Machine;
  kind: "DIE" | "MOULD" | "FIXTURE" | "BLADE";
  ratedLifeUnits: number;
  usedUnits: number;
  lifePct: number;
  toolStatus: "OK" | "WARN" | "REPLACE";
  lastChangedAt: string;
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ageLabel(dt: string) {
  const ms = Date.now() - new Date(dt).getTime();
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ago`;
  return `${h}h ago`;
}

const PRIORITY_STYLE: Record<string, string> = {
  LOW: "bg-slate-800/60 text-slate-300",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 text-amber-300",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 text-orange-300",
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900/40 text-red-300",
};

const TYPE_STYLE: Record<string, string> = {
  BREAKDOWN: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 text-rose-300",
  PM: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 text-blue-300",
};

const KIND_STYLE: Record<string, string> = {
  DIE: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 text-purple-300",
  MOULD: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 text-indigo-300",
  FIXTURE: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 text-cyan-300",
  BLADE: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 text-orange-300",
};

function ToolStatusChip({ status }: { status: "OK" | "WARN" | "REPLACE" }) {
  if (status === "REPLACE")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/40 text-red-300">
        <AlertTriangle className="w-3 h-3" /> REPLACE
      </span>
    );
  if (status === "WARN")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 text-amber-300">
        <AlertCircle className="w-3 h-3" /> WARN
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 text-emerald-300">
      <CheckCircle2 className="w-3 h-3" /> OK
    </span>
  );
}

function LifeBar({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 100);
  const color =
    clamped >= 100
      ? "bg-red-500"
      : clamped >= 90
        ? "bg-amber-500"
        : clamped >= 70
          ? "bg-yellow-400"
          : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-slate-700/40 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-xs font-mono text-slate-400 w-10 text-right">
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

// â”€â”€â”€ Close Job Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CloseJobModal({
  job,
  onClose,
  onConfirm,
}: {
  job: MaintenanceJob;
  onClose: () => void;
  onConfirm: (data: {
    rootCause: string;
    countermeasure: string;
    partsUsed: string;
    costRupees: string;
    laborHours: string;
  }) => Promise<void>;
}) {
  const [rootCause, setRootCause] = useState("");
  const [countermeasure, setCountermeasure] = useState("");
  const [partsUsed, setPartsUsed] = useState("");
  const [costRupees, setCostRupees] = useState("");
  const [laborHours, setLaborHours] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    await onConfirm({
      rootCause,
      countermeasure,
      partsUsed,
      costRupees,
      laborHours,
    });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-800/60 rounded-2xl shadow-2xl border border-slate-600 w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-slate-600">
          <div>
            <h2 className="font-bold text-white text-lg">Close Job</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {job.machine.name} â€” {job.description.slice(0, 60)}â€¦
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800/90 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">
              Root Cause {job.type === "BREAKDOWN" ? "(mandatory if >1h)" : ""}
            </label>
            <textarea
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              rows={3}
              placeholder="Describe the root cause of the issue…"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-500 bg-slate-800/60 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">
              Countermeasure / Preventive Action{" "}
              {job.type === "BREAKDOWN" ? "(mandatory if >1h)" : ""}
            </label>
            <textarea
              value={countermeasure}
              onChange={(e) => setCountermeasure(e.target.value)}
              rows={2}
              placeholder="What will prevent recurrence — e.g. add to PM schedule, replace part, operator training…"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-500 bg-slate-800/60 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">
              Parts Used
            </label>
            <input
              type="text"
              value={partsUsed}
              onChange={(e) => setPartsUsed(e.target.value)}
              placeholder="e.g. Bearing 6205-2RS x2, V-belt A45 x1"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-500 bg-slate-800/60 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">
                Cost (â‚¹)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={costRupees}
                onChange={(e) => setCostRupees(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-500 bg-slate-800/60 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">
                Labor Hours
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={laborHours}
                onChange={(e) => setLaborHours(e.target.value)}
                placeholder="0.0"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-500 bg-slate-800/60 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-slate-600">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-500 text-sm font-semibold text-slate-300 hover:bg-slate-800/90 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              loading ||
              (job.type === "BREAKDOWN" &&
                (!rootCause.trim() || !countermeasure.trim()))
            }
            className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Close Job
          </button>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Add PM Rule Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AddPMRuleModal({
  machines,
  onClose,
  onAdd,
}: {
  machines: Machine[];
  onClose: () => void;
  onAdd: (data: any) => Promise<void>;
}) {
  const [machineId, setMachineId] = useState(machines[0]?.id || "");
  const [title, setTitle] = useState("");
  const [intervalDays, setIntervalDays] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!machineId || !title.trim()) return;
    setLoading(true);
    await onAdd({ machineId, title, intervalDays });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-800/60 rounded-2xl shadow-2xl border border-slate-600 w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-600">
          <h2 className="font-bold text-white">Add PM Rule</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800/90 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">
              Machine
            </label>
            <select
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-500 bg-slate-800/60 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} â€” {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">
              Rule Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Monthly lubrication check"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-500 bg-slate-800/60 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">
              Interval (Days)
            </label>
            <input
              type="number"
              min="1"
              value={intervalDays}
              onChange={(e) => setIntervalDays(e.target.value)}
              placeholder="e.g. 30"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-500 bg-slate-800/60 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-slate-600">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-500 text-sm font-semibold text-slate-300 hover:bg-slate-800/90 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !title.trim()}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Add Rule
          </button>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Add Tool Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AddToolModal({
  machines,
  onClose,
  onAdd,
}: {
  machines: Machine[];
  onClose: () => void;
  onAdd: (data: any) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [machineId, setMachineId] = useState("");
  const [kind, setKind] = useState<"DIE" | "MOULD" | "FIXTURE" | "BLADE">(
    "DIE",
  );
  const [ratedLifeUnits, setRatedLifeUnits] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!code.trim() || !ratedLifeUnits) return;
    setLoading(true);
    await onAdd({
      code,
      name,
      machineId: machineId || null,
      kind,
      ratedLifeUnits,
    });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-800/60 rounded-2xl shadow-2xl border border-slate-600 w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-600">
          <h2 className="font-bold text-white">Add Maintenance Tool</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800/90 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">
                Code *
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="T-DIE-003"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-500 bg-slate-800/60 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">
                Kind *
              </label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-500 bg-slate-800/60 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {["DIE", "MOULD", "FIXTURE", "BLADE"].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional description"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-500 bg-slate-800/60 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">
                Machine
              </label>
              <select
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-500 bg-slate-800/60 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">â€” Unassigned â€”</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">
                Rated Life (units) *
              </label>
              <input
                type="number"
                min="1"
                value={ratedLifeUnits}
                onChange={(e) => setRatedLifeUnits(e.target.value)}
                placeholder="50000"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-500 bg-slate-800/60 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-slate-600">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-500 text-sm font-semibold text-slate-300 hover:bg-slate-800/90 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !code.trim() || !ratedLifeUnits}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Add Tool
          </button>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function MaintenanceClient({
  role,
}: {
  role: string;
  userName: string;
}) {
  const isElevated = true; // fixed user role logic below

  const [tab, setTab] = useState<"OPEN" | "IN_PROGRESS" | "CLOSED">("OPEN");
  const [jobs, setJobs] = useState<MaintenanceJob[]>([]);
  const [pmRules, setPmRules] = useState<PMRule[]>([]);
  const [tools, setTools] = useState<MaintenanceTool[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);

  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingPM, setLoadingPM] = useState(true);
  const [loadingTools, setLoadingTools] = useState(true);

  const [closeTarget, setCloseTarget] = useState<MaintenanceJob | null>(null);
  const [showAddPM, setShowAddPM] = useState(false);
  const [showAddTool, setShowAddTool] = useState(false);
  const [resetConfirm, setResetConfirm] = useState<MaintenanceTool | null>(
    null,
  );

  const [toast, setToast] = useState<{
    msg: string;
    type: "ok" | "err";
  } | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // â”€â”€ Fetch helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fetchJobs = useCallback(async () => {
    setLoadingJobs(true);
    const r = await fetch("/api/maintenance/jobs");
    const d = await r.json();
    setJobs(d.jobs || []);
    setLoadingJobs(false);
  }, []);

  const fetchPM = useCallback(async () => {
    setLoadingPM(true);
    const r = await fetch("/api/maintenance/pm");
    const d = await r.json();
    setPmRules(d.rules || []);
    setLoadingPM(false);
  }, []);

  const fetchTools = useCallback(async () => {
    setLoadingTools(true);
    const r = await fetch("/api/maintenance/tools");
    const d = await r.json();
    setTools(d.tools || []);
    setLoadingTools(false);
  }, []);

  const fetchMachines = useCallback(async () => {
    const r = await fetch("/api/machines");
    const d = await r.json();
    setMachines(
      (d.machines || d || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        code: m.code,
      })),
    );
  }, []);

  useEffect(() => {
    fetchJobs();
    fetchPM();
    fetchTools();
    fetchMachines();
  }, [fetchJobs, fetchPM, fetchTools, fetchMachines]);

  // â”€â”€ Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleStartJob = async (job: MaintenanceJob) => {
    const r = await fetch(`/api/maintenance/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "START" }),
    });
    if (r.ok) {
      showToast("Job started â€” moved to In Progress");
      fetchJobs();
    } else {
      const d = await r.json();
      showToast(d.error || "Failed to start job", "err");
    }
  };

  const handleCloseJob = async (data: {
    rootCause: string;
    partsUsed: string;
    costRupees: string;
    laborHours: string;
  }) => {
    if (!closeTarget) return;
    const r = await fetch(`/api/maintenance/jobs/${closeTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "CLOSE", ...data }),
    });
    if (r.ok) {
      setCloseTarget(null);
      showToast("Job closed successfully");
      fetchJobs();
    } else {
      const d = await r.json();
      showToast(d.error || "Failed to close job", "err");
    }
  };

  const handleMarkPMDone = async (ruleId: string) => {
    const r = await fetch(`/api/maintenance/pm/${ruleId}/done`, {
      method: "POST",
    });
    if (r.ok) {
      showToast("PM marked done â€” timer reset");
      fetchPM();
    } else {
      showToast("Failed to mark PM done", "err");
    }
  };

  const handleAddPMRule = async (data: any) => {
    const r = await fetch("/api/maintenance/pm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (r.ok) {
      setShowAddPM(false);
      showToast("PM rule added");
      fetchPM();
    } else {
      showToast("Failed to add PM rule", "err");
    }
  };

  const handleAddTool = async (data: any) => {
    const r = await fetch("/api/maintenance/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (r.ok) {
      setShowAddTool(false);
      showToast("Tool added");
      fetchTools();
    } else {
      const d = await r.json();
      showToast(d.error || "Failed to add tool", "err");
    }
  };

  const handleResetTool = async (tool: MaintenanceTool) => {
    const r = await fetch(`/api/maintenance/tools/${tool.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "RESET" }),
    });
    if (r.ok) {
      setResetConfirm(null);
      showToast(`Counter reset for ${tool.code}`);
      fetchTools();
    } else {
      showToast("Failed to reset tool counter", "err");
    }
  };

  // â”€â”€ Filtered jobs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const filteredJobs = jobs.filter((j) => j.status === tab);
  const openCount = jobs.filter((j) => j.status === "OPEN").length;
  const inProgCount = jobs.filter((j) => j.status === "IN_PROGRESS").length;
  const closedCount = jobs.filter((j) => j.status === "CLOSED").length;
  const overdueCount = pmRules.filter((r) => r.isOverdue).length;
  const replaceCount = tools.filter((t) => t.toolStatus === "REPLACE").length;

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-700 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-500 text-white rounded-xl shadow-md shadow-orange-500/20">
              <Wrench className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Maintenance
              </h1>
              <p className="text-sm text-slate-400 font-medium">
                Job cards Â· Preventive maintenance Â· Tool life tracking
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Summary chips */}
            {overdueCount > 0 && (
              <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 text-amber-300 border border-amber-200 dark:border-amber-800">
                âš  {overdueCount} PM overdue
              </span>
            )}
            {replaceCount > 0 && (
              <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/40 text-red-300 border border-red-200 dark:border-red-800">
                ðŸ”´ {replaceCount} tool REPLACE
              </span>
            )}
            <button
              onClick={() => {
                fetchJobs();
                fetchPM();
                fetchTools();
              }}
              className="p-2 rounded-xl border border-slate-500 hover:bg-slate-800/90 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </header>

        {/* â”€â”€ JOBS BOARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-500" />
              Maintenance Jobs
            </h2>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-slate-800/60 rounded-xl p-1 w-fit mb-6 border border-slate-700">
            {(["OPEN", "IN_PROGRESS", "CLOSED"] as const).map((t) => {
              const count =
                t === "OPEN"
                  ? openCount
                  : t === "IN_PROGRESS"
                    ? inProgCount
                    : closedCount;
              const active = tab === t;
              const label =
                t === "IN_PROGRESS"
                  ? "In Progress"
                  : t.charAt(0) + t.slice(1).toLowerCase();
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
                    active
                      ? "bg-slate-800/60 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-700 hover:text-slate-200"
                  }`}
                >
                  {label}
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${
                      active
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 text-orange-300"
                        : "bg-slate-200 text-slate-500 bg-slate-700/40 text-slate-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {loadingJobs ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-16 bg-slate-800/60 border border-slate-700 rounded-2xl">
              <Wrench className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">
                No {tab.replace("_", " ").toLowerCase()} jobs
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-slate-800/60 rounded-2xl border border-slate-700 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${TYPE_STYLE[job.type]}`}
                      >
                        {job.type}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${PRIORITY_STYLE[job.priority]}`}
                      >
                        {job.priority}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {ageLabel(job.openedAt)}
                    </span>
                  </div>

                  {/* Machine */}
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-sm font-semibold text-slate-300">
                      {job.machine.name}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {job.machine.code}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">
                    {job.description}
                  </p>

                  {/* Requester */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <User className="w-3.5 h-3.5" />
                    {job.requestedByName}
                  </div>

                  {/* Closed details */}
                  {job.status === "CLOSED" && (
                    <div className="border-t border-slate-700 pt-3 space-y-1.5 text-xs text-slate-400">
                      {job.rootCause && (
                        <p>
                          <span className="font-semibold text-slate-300">
                            Root cause:
                          </span>{" "}
                          {job.rootCause}
                        </p>
                      )}
                      {job.countermeasure && (
                        <p>
                          <span className="font-semibold text-slate-300">
                            Countermeasure:
                          </span>{" "}
                          {job.countermeasure}
                        </p>
                      )}
                      {job.partsUsed && (
                        <p>
                          <span className="font-semibold text-slate-300">
                            Parts:
                          </span>{" "}
                          {job.partsUsed}
                        </p>
                      )}
                      <div className="flex gap-4">
                        {job.costRupees != null && (
                          <span>
                            â‚¹{job.costRupees.toLocaleString("en-IN")}
                          </span>
                        )}
                        {job.laborHours != null && (
                          <span>{job.laborHours}h labor</span>
                        )}
                        {job.closedBy && <span>by {job.closedBy}</span>}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {isElevated && (
                    <div className="flex gap-2 mt-auto pt-1">
                      {job.status === "OPEN" && (
                        <button
                          onClick={() => handleStartJob(job)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
                        >
                          <Play className="w-3.5 h-3.5" /> Start
                        </button>
                      )}
                      {job.status === "IN_PROGRESS" && (
                        <button
                          onClick={() => setCloseTarget(job)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Close Job
                        </button>
                      )}
                      <SourceRecordEditModal
                        entityType="MaintenanceJob"
                        entityId={job.id}
                        title="Maintenance Job Card"
                        fields={[
                          {
                            key: "priority",
                            label: "Priority",
                            type: "select",
                            options: [
                              { label: "Low", value: "LOW" },
                              { label: "Medium", value: "MEDIUM" },
                              { label: "High", value: "HIGH" },
                              { label: "Critical", value: "CRITICAL" },
                            ],
                          },
                          {
                            key: "type",
                            label: "Type",
                            type: "select",
                            options: [
                              { label: "Breakdown", value: "BREAKDOWN" },
                              { label: "PM", value: "PM" },
                            ],
                          },
                          {
                            key: "status",
                            label: "Status",
                            type: "select",
                            options: [
                              { label: "Open", value: "OPEN" },
                              { label: "In Progress", value: "IN_PROGRESS" },
                              { label: "Closed", value: "CLOSED" },
                            ],
                          },
                          {
                            key: "rootCause",
                            label: "Root Cause",
                            type: "text",
                          },
                          {
                            key: "countermeasure",
                            label: "Countermeasure",
                            type: "text",
                          },
                          {
                            key: "partsUsed",
                            label: "Parts Used",
                            type: "text",
                          },
                          {
                            key: "costRupees",
                            label: "Cost (â‚¹)",
                            type: "number",
                          },
                          {
                            key: "laborHours",
                            label: "Labor Hours",
                            type: "number",
                          },
                        ]}
                        initialValues={{
                          priority: job.priority,
                          type: job.type,
                          status: job.status,
                          rootCause: job.rootCause,
                          partsUsed: job.partsUsed,
                          costRupees: job.costRupees,
                          laborHours: job.laborHours,
                        }}
                        userRole={role}
                        onSaved={fetchJobs}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* â”€â”€ PM RULES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              Preventive Maintenance Rules
            </h2>
            {isElevated && (
              <button
                onClick={() => setShowAddPM(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Rule
              </button>
            )}
          </div>

          {loadingPM ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : pmRules.length === 0 ? (
            <div className="text-center py-12 bg-slate-800/60 border border-slate-700 rounded-2xl">
              <Shield className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No PM rules configured</p>
            </div>
          ) : (
            <div className="bg-slate-800/60 rounded-2xl border border-slate-700 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/60">
                    <th className="text-left px-5 py-3.5 font-semibold text-slate-400 text-xs uppercase tracking-wider">
                      Machine
                    </th>
                    <th className="text-left px-5 py-3.5 font-semibold text-slate-400 text-xs uppercase tracking-wider">
                      Rule
                    </th>
                    <th className="text-left px-5 py-3.5 font-semibold text-slate-400 text-xs uppercase tracking-wider">
                      Interval
                    </th>
                    <th className="text-left px-5 py-3.5 font-semibold text-slate-400 text-xs uppercase tracking-wider">
                      Last Done
                    </th>
                    <th className="text-left px-5 py-3.5 font-semibold text-slate-400 text-xs uppercase tracking-wider">
                      Next Due
                    </th>
                    {isElevated && <th className="px-5 py-3.5" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 divide-slate-800">
                  {pmRules.map((rule) => (
                    <tr
                      key={rule.id}
                      className={`hover:bg-slate-800/90/40 transition-colors ${rule.isOverdue ? "bg-red-50/50 dark:bg-red-950/20" : ""}`}
                    >
                      <td className="px-5 py-4">
                        <span className="font-semibold text-slate-300">
                          {rule.machine.code}
                        </span>
                        <span className="text-slate-500 ml-1.5 text-xs hidden sm:inline">
                          {rule.machine.name}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-300 font-medium">
                        {rule.title}
                      </td>
                      <td className="px-5 py-4 text-slate-400">
                        {rule.intervalDays
                          ? `${rule.intervalDays}d`
                          : rule.intervalRunHours
                            ? `${rule.intervalRunHours}h run`
                            : "â€”"}
                      </td>
                      <td className="px-5 py-4 text-slate-400">
                        {rule.lastDoneAt ? (
                          new Date(rule.lastDoneAt).toLocaleDateString("en-IN")
                        ) : (
                          <span className="text-amber-500 font-semibold">
                            Never
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {rule.isOverdue ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/40 text-red-300">
                            <AlertTriangle className="w-3 h-3" />
                            OVERDUE{" "}
                            {rule.daysDiff != null
                              ? `(${Math.abs(rule.daysDiff)}d)`
                              : ""}
                          </span>
                        ) : rule.nextDue ? (
                          <span className="text-emerald-400 font-medium">
                            {new Date(rule.nextDue).toLocaleDateString("en-IN")}
                            {rule.daysDiff != null && (
                              <span className="text-slate-400 ml-1 text-xs">
                                ({rule.daysDiff}d)
                              </span>
                            )}
                          </span>
                        ) : (
                          "â€”"
                        )}
                      </td>
                      {isElevated && (
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleMarkPMDone(rule.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Mark Done
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* â”€â”€ TOOLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Wrench className="w-5 h-5 text-purple-500" />
              Tool Life Monitor
            </h2>
            {isElevated && (
              <button
                onClick={() => setShowAddTool(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Tool
              </button>
            )}
          </div>

          {loadingTools ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            </div>
          ) : tools.length === 0 ? (
            <div className="text-center py-12 bg-slate-800/60 border border-slate-700 rounded-2xl">
              <Wrench className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No tools configured</p>
            </div>
          ) : (
            <div className="bg-slate-800/60 rounded-2xl border border-slate-700 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/60">
                    <th className="text-left px-5 py-3.5 font-semibold text-slate-400 text-xs uppercase tracking-wider">
                      Code
                    </th>
                    <th className="text-left px-5 py-3.5 font-semibold text-slate-400 text-xs uppercase tracking-wider">
                      Kind
                    </th>
                    <th className="text-left px-5 py-3.5 font-semibold text-slate-400 text-xs uppercase tracking-wider">
                      Machine
                    </th>
                    <th className="text-left px-5 py-3.5 font-semibold text-slate-400 text-xs uppercase tracking-wider">
                      Life Used
                    </th>
                    <th className="text-left px-5 py-3.5 font-semibold text-slate-400 text-xs uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-5 py-3.5 font-semibold text-slate-400 text-xs uppercase tracking-wider">
                      Last Reset
                    </th>
                    {isElevated && <th className="px-5 py-3.5" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 divide-slate-800">
                  {tools.map((tool) => (
                    <tr
                      key={tool.id}
                      className={`hover:bg-slate-800/90/40 transition-colors ${tool.toolStatus === "REPLACE" ? "bg-red-50/50 dark:bg-red-950/20" : tool.toolStatus === "WARN" ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}`}
                    >
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-200 font-mono text-xs">
                          {tool.code}
                        </div>
                        {tool.name && (
                          <div className="text-slate-400 text-xs mt-0.5">
                            {tool.name}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${KIND_STYLE[tool.kind]}`}
                        >
                          {tool.kind}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-400">
                        {tool.machine ? (
                          <>
                            <span className="font-mono text-xs">
                              {tool.machine.code}
                            </span>
                            <span className="ml-1.5 text-xs hidden sm:inline text-slate-400">
                              {tool.machine.name}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400">â€”</span>
                        )}
                      </td>
                      <td className="px-5 py-4 min-w-[160px]">
                        <LifeBar pct={tool.lifePct} />
                        <div className="text-xs text-slate-500 mt-0.5">
                          {tool.usedUnits.toLocaleString()} /{" "}
                          {tool.ratedLifeUnits.toLocaleString()} units
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <ToolStatusChip status={tool.toolStatus} />
                      </td>
                      <td className="px-5 py-4 text-slate-400 text-xs">
                        {new Date(tool.lastChangedAt).toLocaleDateString(
                          "en-IN",
                        )}
                      </td>
                      {isElevated && (
                        <td className="px-5 py-4 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={() => setResetConfirm(tool)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-500 hover:bg-slate-800/90 text-slate-300 text-xs font-semibold transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Reset
                          </button>
                          <SourceRecordEditModal
                            entityType="Tool"
                            entityId={tool.id}
                            title="Tool Counter & Rated Life"
                            fields={[
                              {
                                key: "usedUnits",
                                label: "Used Units (Counter)",
                                type: "number",
                              },
                              {
                                key: "ratedLifeUnits",
                                label: "Rated Life Units",
                                type: "number",
                              },
                            ]}
                            initialValues={{
                              usedUnits: tool.usedUnits,
                              ratedLifeUnits: tool.ratedLifeUnits,
                            }}
                            userRole={role}
                            onSaved={fetchTools}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* â”€â”€ MODALS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {closeTarget && (
        <CloseJobModal
          job={closeTarget}
          onClose={() => setCloseTarget(null)}
          onConfirm={handleCloseJob}
        />
      )}

      {showAddPM && (
        <AddPMRuleModal
          machines={machines}
          onClose={() => setShowAddPM(false)}
          onAdd={handleAddPMRule}
        />
      )}

      {showAddTool && (
        <AddToolModal
          machines={machines}
          onClose={() => setShowAddTool(false)}
          onAdd={handleAddTool}
        />
      )}

      {/* Reset confirmation */}
      {resetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800/60 rounded-2xl shadow-2xl border border-slate-600 w-full max-w-sm p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 dark:bg-amber-900/40 rounded-xl">
                <RotateCcw className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">Reset Tool Counter</h3>
                <p className="text-sm text-slate-400">{resetConfirm.code}</p>
              </div>
            </div>
            <p className="text-sm text-slate-400">
              This will reset <strong>{resetConfirm.code}</strong> used units to
              0 and set lastChangedAt to today. Confirm tool has been physically
              replaced.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setResetConfirm(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-500 text-sm font-semibold text-slate-300 hover:bg-slate-800/90 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResetTool(resetConfirm)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <RotateCcw className="w-4 h-4" /> Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-white text-sm font-semibold transition-all ${
            toast.type === "ok" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.type === "ok" ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
