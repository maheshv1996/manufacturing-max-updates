"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  AlertTriangle,
  X,
  Save,
  Loader2,
  Gauge,
  Layers,
  Plus,
  Search,
} from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RoutingStep {
  id: string;
  seq: number;
  stationName: string;
  setupTimeMin: number;
  cycleTimeMin: number;
  instructions?: string;
  machineId?: string;
  machine?: { id: string; code: string; name: string };
  operation?: { id: string; code: string; name: string };
}

interface Product {
  id: string;
  name: string;
  sku: string;
  routingSteps?: RoutingStep[];
}

interface Project {
  id: string;
  name: string;
  code: string;
  clientName: string;
  status: string;
}

interface ProductionLog {
  machineId: string;
}

interface WorkOrder {
  id: string;
  woNumber: string;
  plannedStartDate: string;
  plannedEndDate: string;
  plannedQuantity: number;
  packedQuantity?: number;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";
  currentSeq: number;
  priority?: number;
  product: Product;
  project?: Project | null;
  customerName?: string | null;
  promisedDispatchDate?: string | null;
  productionLogs: ProductionLog[];
}

interface Machine {
  id: string;
  name: string;
  code: string;
  stationName?: string;
  line?: { plant?: { name: string } };
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

type HorizonView = "HOURLY" | "WEEKLY" | "MONTHLY";

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-blue-900/80 border-blue-500 text-blue-100",
  IN_PROGRESS: "bg-emerald-900/80 border-emerald-500 text-emerald-100",
  COMPLETED: "bg-slate-800/90 border-slate-600 text-slate-300",
  ON_HOLD: "bg-amber-900/80 border-amber-500 text-amber-100",
};

const STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getPrimaryMachineId(wo: WorkOrder): string | null {
  const currentStep = wo.product?.routingSteps?.find(
    (s) => s.seq === wo.currentSeq,
  );
  if (currentStep?.machineId) return currentStep.machineId;
  return wo.productionLogs?.[0]?.machineId ?? null;
}

// ─── Edit Modal ──────────────────────────────────────────────────────────────

interface EditModalProps {
  wo: WorkOrder;
  machines: Machine[];
  onClose: () => void;
  onSave: () => void;
}

function EditModal({ wo, machines, onClose, onSave }: EditModalProps) {
  const [machineId, setMachineId] = useState(getPrimaryMachineId(wo) || "");
  const [startDate, setStartDate] = useState(wo.plannedStartDate.slice(0, 10));
  const [endDate, setEndDate] = useState(wo.plannedEndDate.slice(0, 10));
  const [status, setStatus] = useState<WorkOrder["status"]>(wo.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleSave = async () => {
    setError(null);
    if (new Date(endDate) <= new Date(startDate)) {
      setError("End date must be after start date.");
      return;
    }
    try {
      setSaving(true);
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrderId: wo.id,
          machineId: machineId || null,
          plannedStartDate: startDate,
          plannedEndDate: endDate,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      onSave();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-modal-title"
    >
      <div
        className="bg-surface-1 border border-border rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 id="schedule-modal-title" className="text-xl font-bold text-text-1 flex items-center gap-2">
              <span>Schedule Work Order</span>
              <span className="text-accent font-mono">{wo.woNumber}</span>
            </h2>
            {wo.customerName && (
              <p className="text-xs text-blue-400 font-medium mt-0.5">
                Customer: {wo.customerName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-surface-3 text-text-3 hover:text-text-1 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-text-3 text-sm">
          Part:{" "}
          <span className="text-text-1 font-semibold">{wo.product.name}</span> (
          {wo.product.sku}) · Qty:{" "}
          <span className="font-mono text-cyan-400 font-bold">
            {wo.plannedQuantity}
          </span>
        </p>

        {error && (
          <div className="p-3 bg-rose-950/70 border border-rose-700 text-rose-300 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
              Assigned Machine / Workstation
            </label>
            <select
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              className="w-full bg-surface-2 border border-border text-text-1 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent"
            >
              <option value="">-- Unassigned (Backlog) --</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} - {m.name}{" "}
                  {m.stationName ? `(${m.stationName})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
                Planned Start
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-surface-2 border border-border text-text-1 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
                Planned End
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-surface-2 border border-border text-text-1 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as WorkOrder["status"])}
              className="w-full bg-surface-2 border border-border text-text-1 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent"
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-text-2 hover:bg-surface-3 text-sm font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Saving..." : "Save Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Gantt Board Component ──────────────────────────────────────────────

export default function ScheduleBoardClient() {
  const [horizon, setHorizon] = useState<HorizonView>("WEEKLY");
  const [showBacklog, setShowBacklog] = useState(true);
  const [windowStart, setWindowStart] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [machines, setMachines] = useState<Machine[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [machineLoads, setMachineLoads] = useState<
    Record<string, MachineLoadSummary>
  >({});
  const [_loading, setLoading] = useState(true);
  const [editingWO, setEditingWO] = useState<WorkOrder | null>(null);
  const [backlogSearch, setBacklogSearch] = useState("");

  const days = horizon === "HOURLY" ? 1 : horizon === "WEEKLY" ? 7 : 30;
  const dayHeaders = Array.from({ length: days }, (_, i) =>
    addDays(windowStart, i),
  );
  const hourlySlots = Array.from({ length: 24 }, (_, i) => i); // 0..23 hours for HOURLY

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/schedule?days=${days}&start=${windowStart.toISOString()}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setMachines(data.machines || []);
      setWorkOrders(data.workOrders || []);
      setMachineLoads(data.machineLoads || {});
    } finally {
      setLoading(false);
    }
  }, [days, windowStart]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const goToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setWindowStart(d);
  };
  const goPrev = () => setWindowStart((d) => addDays(d, -days));
  const goNext = () => setWindowStart((d) => addDays(d, days));

  const windowEnd = addDays(windowStart, days);

  // Filter WOs visible in window for a machine
  const getWOsForMachine = (machineId: string) =>
    workOrders.filter((wo) => {
      const primary = getPrimaryMachineId(wo);
      if (primary !== machineId) return false;
      const s = new Date(wo.plannedStartDate);
      const e = new Date(wo.plannedEndDate);
      return s < windowEnd && e > windowStart;
    });

  // Backlog / Unscheduled WOs
  const backlogWOs = useMemo(() => {
    return workOrders.filter((wo) => {
      const isUnscheduled = !getPrimaryMachineId(wo) || wo.status === "PLANNED";
      if (!isUnscheduled) return false;
      if (!backlogSearch) return true;
      const q = backlogSearch.toLowerCase();
      return (
        wo.woNumber.toLowerCase().includes(q) ||
        wo.product.name.toLowerCase().includes(q) ||
        wo.product.sku.toLowerCase().includes(q) ||
        (wo.customerName && wo.customerName.toLowerCase().includes(q))
      );
    });
  }, [workOrders, backlogSearch]);

  // Calculate block position
  const getBlockStyle = (wo: WorkOrder) => {
    const woStart = new Date(wo.plannedStartDate);
    const woEnd = new Date(wo.plannedEndDate);

    if (horizon === "HOURLY") {
      // Hour based mapping (0 to 24)
      const startH = woStart.getHours() + woStart.getMinutes() / 60;
      const endH =
        woEnd.getDate() > woStart.getDate()
          ? 24
          : woEnd.getHours() + woEnd.getMinutes() / 60;
      const spanH = Math.max(1.5, endH - startH);
      return {
        left: `${(startH / 24) * 100}%`,
        width: `${Math.min(100 - (startH / 24) * 100, (spanH / 24) * 100)}%`,
      };
    }

    const clampedStart = woStart < windowStart ? windowStart : woStart;
    const clampedEnd = woEnd > windowEnd ? windowEnd : woEnd;

    const daysDiff = (d: Date) =>
      (d.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24);

    const startCol = Math.max(0, daysDiff(clampedStart));
    const span = Math.min(days - startCol, daysDiff(clampedEnd) - startCol);

    return {
      left: `${(startCol / days) * 100}%`,
      width: `${Math.max(3, (span / days) * 100)}%`,
    };
  };

  const todayStr = isoDate(new Date());
  const overloadedStations = Object.values(machineLoads).filter(
    (ml) => ml.isOverloaded,
  );

  return (
    <div className="space-y-6 max-w-full pb-12">
      {/* ── Page Header ── */}
      <PageHeader
        title="Production Planner & Gantt Schedule"
        description="Multi-horizon scheduling, machine capacity loads, backlog dispatching, and overdue alerts."
      >
        <div className="flex items-center gap-3 flex-wrap">
          {/* Horizon Switcher */}
          <div className="flex items-center bg-surface-2 p-1 rounded-xl border border-border">
            {(["HOURLY", "WEEKLY", "MONTHLY"] as HorizonView[]).map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  horizon === h
                    ? "bg-accent text-white shadow-sm"
                    : "text-text-3 hover:text-text-1 hover:bg-surface-3"
                }`}
              >
                {h === "HOURLY"
                  ? "24h Shift Gantt"
                  : h === "WEEKLY"
                    ? "Weekly (7D)"
                    : "Monthly (30D)"}
              </button>
            ))}
          </div>

          {/* Backlog Toggle */}
          <button
            onClick={() => setShowBacklog(!showBacklog)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
              showBacklog
                ? "bg-blue-600/20 border-blue-500/40 text-blue-300"
                : "bg-surface-2 border-border text-text-2 hover:text-text-1"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Backlog Drawer ({backlogWOs.length})
          </button>

          {/* Date Nav */}
          <div className="flex items-center gap-1 bg-surface-2 rounded-xl border border-border p-1">
            <button
              onClick={goPrev}
              className="p-1.5 rounded-lg hover:bg-surface-3 text-text-3 hover:text-text-1 cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToday}
              className="px-3 py-1 rounded-lg text-xs font-bold text-text-1 hover:bg-surface-3 cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-accent" />
              Today
            </button>
            <button
              onClick={goNext}
              className="p-1.5 rounded-lg hover:bg-surface-3 text-text-3 hover:text-text-1 cursor-pointer transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </PageHeader>

      {/* ── Capacity & Overload Summary ── */}
      <div className="bg-surface-1 border border-border rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-3 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-cyan-400" />
            Machine Capacity & Station Load Hours
          </h2>
          {overloadedStations.length > 0 && (
            <span className="px-3 py-1 bg-rose-950/80 border border-rose-700 text-rose-300 text-xs font-bold rounded-full flex items-center gap-1.5 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              {overloadedStations.length} Station(s) Over Capacity (&gt;8.0 hrs)
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {machines.slice(0, 12).map((m) => {
            const load = machineLoads[m.id] || {
              totalLoadHours: 0,
              totalSetupHours: 0,
              totalRunHours: 0,
              utilizationPct: 0,
              isOverloaded: false,
              activeOpCount: 0,
            };
            const isOver = load.totalLoadHours > 8.0;
            const isWarn = load.totalLoadHours >= 6.4 && !isOver;

            return (
              <div
                key={m.id}
                className={`p-3 rounded-2xl border transition-all ${
                  isOver
                    ? "bg-rose-950/30 border-rose-700/80 text-rose-200"
                    : isWarn
                      ? "bg-amber-950/30 border-amber-700/80 text-amber-200"
                      : "bg-surface-2 border-border text-text-2"
                }`}
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="font-extrabold text-xs text-text-1">
                    {m.code}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                      isOver
                        ? "bg-rose-900 text-rose-200"
                        : isWarn
                          ? "bg-amber-900 text-amber-200"
                          : "bg-surface-3 text-text-3"
                    }`}
                  >
                    {load.utilizationPct}%
                  </span>
                </div>
                <div className="text-[11px] text-text-3 truncate mt-0.5">
                  {m.name}
                </div>
                <div className="mt-1.5 text-xs font-mono font-bold text-text-1">
                  {load.totalLoadHours.toFixed(1)}h{" "}
                  <span className="text-[10px] text-text-3 font-normal">
                    ({load.activeOpCount} ops)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main Gantt + Backlog Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Backlog Drawer on Left (Optional 3.5 cols) */}
        {showBacklog && (
          <div className="lg:col-span-4 bg-surface-1 border border-border rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-extrabold text-text-1 text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                Unscheduled Backlog ({backlogWOs.length})
              </h3>
              <span className="text-[10px] bg-blue-500/20 text-blue-400 font-bold px-2 py-0.5 rounded-full">
                Drag or Click
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
              <input
                type="text"
                value={backlogSearch}
                onChange={(e) => setBacklogSearch(e.target.value)}
                placeholder="Search backlog..."
                className="w-full bg-surface-2 border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-text-1 placeholder-text-3 focus:outline-none focus:border-accent"
              />
            </div>

            <div className="max-h-[500px] overflow-y-auto space-y-2.5 pr-1">
              {backlogWOs.length === 0 ? (
                <div className="text-center py-8 text-xs text-text-3">
                  No unscheduled backlog orders.
                </div>
              ) : (
                backlogWOs.map((wo) => {
                  const isOverdue =
                    wo.promisedDispatchDate &&
                    new Date(wo.promisedDispatchDate) < new Date();
                  return (
                    <div
                      key={wo.id}
                      className="p-3.5 rounded-2xl bg-surface-2 hover:bg-surface-3 border border-border transition-all space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-xs text-text-1 font-mono flex items-center gap-1.5">
                            <span>#{wo.woNumber}</span>
                            {isOverdue && (
                              <span className="text-[9px] px-1.5 py-0.2 bg-rose-500/20 text-rose-300 font-bold rounded">
                                Overdue
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-semibold text-text-2 mt-0.5">
                            {wo.product.name}
                          </div>
                          <div className="text-[10px] text-text-3 font-mono">
                            SKU: {wo.product.sku}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-cyan-400">
                            {wo.plannedQuantity} pcs
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border/40">
                        <span className="text-[10px] text-text-3 truncate max-w-[120px]">
                          {wo.customerName || "Stock Order"}
                        </span>
                        <button
                          onClick={() => setEditingWO(wo)}
                          className="px-2.5 py-1 bg-accent/20 hover:bg-accent text-accent hover:text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Schedule
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Gantt Timeline Board (8 or 12 cols) */}
        <div
          className={`${showBacklog ? "lg:col-span-8" : "lg:col-span-12"} bg-surface-1 border border-border rounded-3xl p-5 shadow-sm space-y-4 overflow-x-auto`}
        >
          {/* Timeline Grid Header */}
          <div className="min-w-[700px]">
            {/* Header Row with Days/Hours */}
            <div className="flex border-b border-border pb-3">
              <div className="w-44 shrink-0 text-xs font-bold uppercase tracking-wider text-text-3 pl-2">
                Workstation / Machine
              </div>
              <div
                className="flex-1 grid"
                style={{
                  gridTemplateColumns: `repeat(${horizon === "HOURLY" ? 24 : days}, minmax(0, 1fr))`,
                }}
              >
                {horizon === "HOURLY"
                  ? hourlySlots.map((h) => (
                      <div
                        key={h}
                        className="text-center text-[10px] font-mono font-bold text-text-3 border-l border-border/40"
                      >
                        {String(h).padStart(2, "0")}:00
                      </div>
                    ))
                  : dayHeaders.map((d, idx) => {
                      const isToday = isoDate(d) === todayStr;
                      return (
                        <div
                          key={idx}
                          className={`text-center py-1 text-xs border-l border-border/40 ${
                            isToday
                              ? "bg-accent/10 text-accent font-bold rounded-lg"
                              : "text-text-3 font-semibold"
                          }`}
                        >
                          <div>
                            {d.toLocaleDateString(undefined, {
                              weekday: "short",
                            })}
                          </div>
                          <div className="text-[11px] font-mono">
                            {d.getDate()}
                          </div>
                        </div>
                      );
                    })}
              </div>
            </div>

            {/* Machine Lanes */}
            <div className="divide-y divide-border/40 mt-2">
              {machines.map((m) => {
                const machineWOs = getWOsForMachine(m.id);
                return (
                  <div
                    key={m.id}
                    className="flex items-stretch py-3 hover:bg-surface-2/40 transition-colors group"
                  >
                    {/* Machine Label Column */}
                    <div className="w-44 shrink-0 pr-4 flex flex-col justify-center">
                      <div className="font-extrabold text-xs text-text-1 font-mono flex items-center gap-1.5">
                        <span>{m.code}</span>
                      </div>
                      <div className="text-[11px] text-text-3 truncate mt-0.5">
                        {m.name}
                      </div>
                    </div>

                    {/* Timeline Canvas */}
                    <div className="flex-1 relative min-h-[52px] bg-surface-2/20 rounded-xl border border-border/30 overflow-hidden">
                      {/* Zebra Shift Stripes for Hourly View */}
                      {horizon === "HOURLY" && (
                        <div className="absolute inset-0 grid grid-cols-24 pointer-events-none">
                          {hourlySlots.map((h) => (
                            <div
                              key={h}
                              className={`border-r border-border/20 ${
                                h >= 6 && h < 14
                                  ? "bg-blue-500/[0.02]"
                                  : h >= 14 && h < 22
                                    ? "bg-purple-500/[0.02]"
                                    : "bg-slate-500/[0.04]"
                              }`}
                            />
                          ))}
                        </div>
                      )}

                      {/* Work Order Blocks */}
                      {machineWOs.map((wo) => {
                        const style = getBlockStyle(wo);
                        const isOverdue =
                          wo.promisedDispatchDate &&
                          new Date(wo.promisedDispatchDate) < new Date() &&
                          wo.status !== "COMPLETED";

                        return (
                          <div
                            key={wo.id}
                            onClick={() => setEditingWO(wo)}
                            style={{
                              left: style.left,
                              width: style.width,
                            }}
                            className={`absolute top-1.5 bottom-1.5 rounded-xl p-2 border cursor-pointer transition-all shadow-md hover:scale-[1.02] hover:z-20 flex flex-col justify-between ${
                              STATUS_COLORS[wo.status] || STATUS_COLORS.PLANNED
                            } ${isOverdue ? "ring-2 ring-rose-500 animate-pulse" : ""}`}
                            title={`WO #${wo.woNumber} · ${wo.product.name} (${wo.plannedQuantity} pcs)`}
                          >
                            <div className="flex items-center justify-between text-[11px] font-bold truncate">
                              <span className="font-mono">#{wo.woNumber}</span>
                              <span className="text-[10px] opacity-80">
                                {wo.plannedQuantity}x
                              </span>
                            </div>
                            <div className="text-[10px] truncate opacity-90 font-medium">
                              {wo.product.name}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingWO && (
        <EditModal
          wo={editingWO}
          machines={machines}
          onClose={() => setEditingWO(null)}
          onSave={fetchData}
        />
      )}
    </div>
  );
}
