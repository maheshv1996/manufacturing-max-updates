"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Package,
  Barcode,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Volume2,
  VolumeX,
  Plus,
  Search,
  TrendingUp,
  Sparkles,
  Layers,
  ArrowRight,
  RefreshCw,
  Tag,
  X,
} from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface WorkOrder {
  id: string;
  woNumber: string;
  plannedQuantity: number;
  packedQuantity: number;
  eanCode?: string | null;
  status: string;
  customerName?: string | null;
  product: {
    id: string;
    name: string;
    sku: string;
  };
  project?: {
    id: string;
    name: string;
  } | null;
}

interface ScanLog {
  id: string;
  ean: string;
  result: string;
  quantity: number;
  timestamp: string;
  workOrder: {
    id: string;
    woNumber: string;
    plannedQuantity: number;
    packedQuantity: number;
    product: { name: string; sku: string };
  };
  operator?: {
    id: string;
    name: string;
    employeeNumber?: string | null;
  } | null;
  shift?: { id: string; name: string } | null;
}

interface Stats {
  totalPackedToday: number;
  shiftTarget: number;
  realizationPct: number;
  backlog: number;
}

export default function PackagingStation() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [recentScans, setRecentScans] = useState<ScanLog[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalPackedToday: 0,
    shiftTarget: 100,
    realizationPct: 0,
    backlog: 0,
  });
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [operators, setOperators] = useState<any[]>([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>("");
  const [selectedWoId, setSelectedWoId] = useState<string>("");
  const [barcodeInput, setBarcodeInput] = useState<string>("");
  const [_loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScanResult, setLastScanResult] = useState<{
    status: "success" | "error" | "overpack" | null;
    message: string;
    woNumber?: string;
  }>({ status: null, message: "" });
  const [showEanModal, setShowEanModal] = useState(false);
  const [editingEanWo, setEditingEanWo] = useState<WorkOrder | null>(null);
  const [newEanCode, setNewEanCode] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Web Audio Synth for crisp sound effects
  const playSound = useCallback(
    (type: "success" | "error" | "overpack") => {
      if (!soundEnabled || typeof window === "undefined") return;
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (
            window.AudioContext || (window as any).webkitAudioContext
          )();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") {
          ctx.resume();
        }
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === "success") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(880, now); // High pleasant A5
          osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12); // Ramp to E6
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
          osc.start(now);
          osc.stop(now + 0.18);
        } else if (type === "overpack") {
          osc.type = "triangle";
          osc.frequency.setValueAtTime(659, now);
          osc.frequency.setValueAtTime(880, now + 0.1);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
          osc.start(now);
          osc.stop(now + 0.25);
        } else {
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(220, now); // Low buzz
          osc.frequency.linearRampToValueAtTime(110, now + 0.2);
          gain.gain.setValueAtTime(0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
          osc.start(now);
          osc.stop(now + 0.25);
        }
      } catch (e) {
        console.warn("Web audio playback error", e);
      }
    },
    [soundEnabled],
  );

  const fetchData = async () => {
    try {
      const res = await fetch("/api/packaging/data");
      if (res.ok) {
        const data = await res.json();
        setWorkOrders(data.workOrders || []);
        setRecentScans(data.recentScans || []);
        setStats(
          data.stats || {
            totalPackedToday: 0,
            shiftTarget: 100,
            realizationPct: 0,
            backlog: 0,
          },
        );
        setCurrentShift(data.currentShift || null);
        setOperators(data.operators || []);
        if (!selectedWoId && data.workOrders?.length > 0) {
          setSelectedWoId(data.workOrders[0].id);
        }
      }
    } catch (err) {
      logClientError("Failed to fetch packaging data", err, "PackagingStation");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000); // Live sync every 4s
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showEanModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowEanModal(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showEanModal]);

  // Keep focus on barcode input for barcode reader gun
  useEffect(() => {
    const focusScanner = () => {
      if (
        inputRef.current &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "SELECT"
      ) {
        inputRef.current.focus();
      }
    };
    window.addEventListener("click", focusScanner);
    return () => window.removeEventListener("click", focusScanner);
  }, []);

  const handleScanSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const ean = barcodeInput.trim();
    if (!ean && !selectedWoId) return;

    setScanning(true);
    try {
      const res = await fetch("/api/packaging/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ean: ean || undefined,
          workOrderId: !ean && selectedWoId ? selectedWoId : undefined,
          operatorId: selectedOperatorId || undefined,
          shiftId: currentShift?.id || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const isOverpack = data.result === "OVERPACK";
        setLastScanResult({
          status: isOverpack ? "overpack" : "success",
          message: data.message || "Unit packed successfully",
          woNumber: data.workOrder?.woNumber,
        });
        playSound(isOverpack ? "overpack" : "success");
        setBarcodeInput("");
        // Select the scanned work order
        if (data.workOrder?.id) {
          setSelectedWoId(data.workOrder.id);
        }
        await fetchData();
      } else {
        setLastScanResult({
          status: "error",
          message: data.error || "Scan failed - invalid barcode",
        });
        playSound("error");
      }
    } catch (err) {
      setLastScanResult({
        status: "error",
        message: "Network error during scan",
      });
      playSound("error");
    } finally {
      setScanning(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleSaveEan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEanWo || !newEanCode) return;
    try {
      const res = await fetch("/api/packaging/eans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrderId: editingEanWo.id,
          eanCode: newEanCode.trim(),
        }),
      });
      if (res.ok) {
        setShowEanModal(false);
        setEditingEanWo(null);
        setNewEanCode("");
        await fetchData();
      }
    } catch (err) {
      logClientError("Failed to save EAN", err, "PackagingStation");
    }
  };

  const handleResetShift = async () => {
    if (
      !confirm(
        "Are you sure you want to log a shift reset for the packaging line?",
      )
    )
      return;
    try {
      const res = await fetch("/api/packaging/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatorId: selectedOperatorId || undefined,
          reason: "Manual shift changeover",
        }),
      });
      if (res.ok) {
        alert("Shift reset recorded.");
        await fetchData();
      }
    } catch (err) {
      logClientError("Shift reset error", err, "PackagingStation");
    }
  };

  const selectedWo =
    workOrders.find((w) => w.id === selectedWoId) || workOrders[0];
  const filteredWorkOrders = workOrders.filter(
    (w) =>
      w.woNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.eanCode &&
        w.eanCode.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <PageHeader
        title="Packaging Station"
        description="High-speed EAN/QR barcode scanning, real-time packing counters, and shift realization."
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2.5 rounded-xl border transition-colors ${
              soundEnabled
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-surface-2 border-border text-text-3"
            }`}
            title={soundEnabled ? "Audio chime ON" : "Audio chime OFF"}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleResetShift}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text-2 hover:text-text-1 text-xs font-semibold transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Shift
          </button>
        </div>
      </PageHeader>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-1 border border-border rounded-2xl p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-text-3">
              Packed Today
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-text-1 tracking-tight">
              {stats.totalPackedToday}
            </span>
            <span className="text-xs text-text-3 font-medium">units</span>
          </div>
          <div className="mt-2 text-xs text-blue-400 font-medium flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Live Shift Volume
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-text-3">
              Realization
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-400 tracking-tight">
              {stats.realizationPct}%
            </span>
            <span className="text-xs text-text-3 font-medium">of target</span>
          </div>
          {/* Mini progress bar */}
          <div className="w-full bg-surface-3 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, stats.realizationPct)}%` }}
            />
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-text-3">
              Shift Backlog
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-400 tracking-tight">
              {stats.backlog}
            </span>
            <span className="text-xs text-text-3 font-medium">units left</span>
          </div>
          <div className="mt-2 text-xs text-text-3">
            Remaining active orders
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-text-3">
              Current Shift
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-extrabold text-purple-300 truncate">
              {currentShift?.name || "Shift A"}
            </div>
            <div className="text-xs text-text-3 font-mono mt-0.5">
              {currentShift
                ? `${currentShift.startTime} - ${currentShift.endTime}`
                : "06:00 - 14:00"}
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Work Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column — Scanning Cockpit (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Gun Scanner Barcode Input Box */}
          <div className="bg-gradient-to-br from-surface-1 via-surface-1 to-blue-950/20 border-2 border-blue-500/30 rounded-3xl p-6 shadow-xl relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm font-bold text-blue-400 uppercase tracking-wider">
                <Barcode className="w-5 h-5 text-blue-400" />
                <span>Barcode Scanner Reader</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-300 font-mono">
                USB / Bluetooth / Manual
              </span>
            </div>

            <form onSubmit={handleScanSubmit} className="space-y-4">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scan EAN-13, SKU, or WO Number..."
                  autoFocus
                  className="w-full bg-surface-2 border-2 border-blue-500/50 rounded-2xl px-5 py-4 text-xl font-mono font-bold text-text-1 placeholder-text-3 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/20 transition-all"
                />
                <button
                  type="submit"
                  disabled={scanning || (!barcodeInput && !selectedWoId)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  {scanning ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Pack</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Operator Badge Selector */}
              <div className="flex items-center justify-between text-xs text-text-2 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-text-3 font-semibold uppercase">
                    Packer:
                  </span>
                  <select
                    value={selectedOperatorId}
                    onChange={(e) => setSelectedOperatorId(e.target.value)}
                    className="bg-surface-2 border border-border rounded-lg px-2.5 py-1 text-xs text-text-1 focus:outline-none focus:border-accent"
                  >
                    <option value="">Auto / Current Operator</option>
                    {operators.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.name} ({op.employeeNumber || "Emp"})
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-[11px] text-text-3">
                  Press Enter or Trigger Scanner Gun
                </span>
              </div>
            </form>

            {/* Scan Feedback Banner */}
            {lastScanResult.status && (
              <div
                className={`mt-4 p-4 rounded-2xl border flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 ${
                  lastScanResult.status === "success"
                    ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-200"
                    : lastScanResult.status === "overpack"
                      ? "bg-amber-950/80 border-amber-500/40 text-amber-200"
                      : "bg-rose-950/80 border-rose-500/40 text-rose-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  {lastScanResult.status === "success" ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-6 h-6 shrink-0 text-amber-400" />
                  )}
                  <div>
                    <div className="font-bold text-sm">
                      {lastScanResult.message}
                    </div>
                    {lastScanResult.woNumber && (
                      <div className="text-xs opacity-80 font-mono mt-0.5">
                        Work Order: #{lastScanResult.woNumber}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() =>
                    setLastScanResult({ status: null, message: "" })
                  }
                  className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Active / Selected Work Order Card */}
          {selectedWo && (
            <div className="bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-text-3 block">
                    Active Packing Job
                  </span>
                  <h3 className="text-2xl font-black text-text-1 mt-0.5 flex items-center gap-2">
                    <span>{selectedWo.woNumber}</span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        selectedWo.status === "IN_PROGRESS"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      }`}
                    >
                      {selectedWo.status}
                    </span>
                  </h3>
                  <p className="text-sm font-semibold text-text-2 mt-1">
                    {selectedWo.product.name} ({selectedWo.product.sku})
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-3xl font-black font-mono text-cyan-400">
                    {selectedWo.packedQuantity}
                    <span className="text-base text-text-3 font-normal">
                      {" "}
                      / {selectedWo.plannedQuantity}
                    </span>
                  </div>
                  <div className="text-xs text-text-3 font-semibold mt-0.5">
                    Units Packed
                  </div>
                </div>
              </div>

              {/* Realization Progress Bar */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-text-3">Progress</span>
                  <span className="text-cyan-400 font-mono">
                    {Math.round(
                      (selectedWo.packedQuantity /
                        (selectedWo.plannedQuantity || 1)) *
                        100,
                    )}
                    %
                  </span>
                </div>
                <div className="w-full bg-surface-3 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      selectedWo.packedQuantity >= selectedWo.plannedQuantity
                        ? "bg-emerald-500"
                        : "bg-cyan-500"
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (selectedWo.packedQuantity /
                            (selectedWo.plannedQuantity || 1)) *
                            100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Quick EAN Barcode Chip & Action */}
              <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-text-3" />
                  <span className="text-xs text-text-3">EAN Barcode:</span>
                  {selectedWo.eanCode ? (
                    <span className="px-2.5 py-1 rounded-lg bg-surface-3 border border-border font-mono text-xs text-emerald-400 font-bold">
                      {selectedWo.eanCode}
                    </span>
                  ) : (
                    <span className="text-xs text-amber-400 italic">
                      No EAN assigned
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setEditingEanWo(selectedWo);
                      setNewEanCode(selectedWo.eanCode || "");
                      setShowEanModal(true);
                    }}
                    className="text-xs text-accent hover:underline font-semibold ml-1 cursor-pointer"
                  >
                    {selectedWo.eanCode ? "Edit" : "+ Assign EAN"}
                  </button>
                </div>

                <button
                  onClick={() => handleScanSubmit()}
                  disabled={scanning}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-extrabold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  +1 Manual Pack
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column — Work Order Directory & Live Scan Stream (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Work Orders Selector Card */}
          <div className="bg-surface-1 border border-border rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-extrabold text-text-1 text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                Active Packing Work Orders ({workOrders.length})
              </h3>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search orders, SKU, EAN..."
                className="w-full bg-surface-2 border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-text-1 placeholder-text-3 focus:outline-none focus:border-accent"
              />
            </div>

            <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
              {filteredWorkOrders.length === 0 ? (
                <div className="text-center py-6 text-xs text-text-3">
                  No matching work orders found.
                </div>
              ) : (
                filteredWorkOrders.map((wo) => {
                  const isSelected = wo.id === selectedWoId;
                  const pct = Math.round(
                    (wo.packedQuantity / (wo.plannedQuantity || 1)) * 100,
                  );
                  return (
                    <button
                      key={wo.id}
                      onClick={() => setSelectedWoId(wo.id)}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-blue-600/10 border-blue-500/40 text-text-1 ring-1 ring-blue-500/30"
                          : "bg-surface-2 hover:bg-surface-3 border-border text-text-2 hover:text-text-1"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-xs truncate flex items-center gap-1.5">
                          <span className="font-mono">{wo.woNumber}</span>
                          {wo.eanCode && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-surface-3 text-emerald-400 rounded font-mono">
                              EAN
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-text-3 truncate mt-0.5">
                          {wo.product.name}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-mono font-bold">
                          {wo.packedQuantity}/{wo.plannedQuantity}
                        </div>
                        <div className="text-[10px] text-text-3 font-semibold">
                          {pct}%
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Live Scan Log Stream */}
          <div className="bg-surface-1 border border-border rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-extrabold text-text-1 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                Live Packaging Log
              </h3>
              <span className="text-[11px] text-text-3 font-mono">
                Today ({recentScans.length} scans)
              </span>
            </div>

            <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1 divide-y divide-border/40">
              {recentScans.length === 0 ? (
                <div className="text-center py-6 text-xs text-text-3">
                  No scans recorded today yet.
                </div>
              ) : (
                recentScans.slice(0, 15).map((scan) => (
                  <div
                    key={scan.id}
                    className="pt-2 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-text-1 flex items-center gap-1.5">
                        <span className="font-mono">
                          WO #{scan.workOrder?.woNumber}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            scan.result === "SUCCESS"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : scan.result === "OVERPACK"
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-rose-500/20 text-rose-400"
                          }`}
                        >
                          {scan.result}
                        </span>
                      </div>
                      <div className="text-[10px] text-text-3 mt-0.5">
                        EAN: <span className="font-mono">{scan.ean}</span> ·{" "}
                        {scan.operator?.name || "Station"}
                      </div>
                    </div>
                    <div className="text-right text-[10px] font-mono text-text-3">
                      {new Date(scan.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* EAN Code Assignment Modal */}
      {showEanModal && editingEanWo && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowEanModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ean-modal-title"
        >
          <div
            className="bg-surface-1 border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 id="ean-modal-title" className="font-extrabold text-text-1 text-base flex items-center gap-2">
                <Tag className="w-5 h-5 text-accent" />
                Assign EAN Barcode
              </h3>
              <button
                type="button"
                onClick={() => setShowEanModal(false)}
                className="p-1 rounded-lg hover:bg-surface-3 text-text-3 hover:text-text-1"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-sm space-y-1">
              <div className="font-bold text-text-1">
                {editingEanWo.woNumber}
              </div>
              <div className="text-xs text-text-3">
                {editingEanWo.product.name} ({editingEanWo.product.sku})
              </div>
            </div>

            <form onSubmit={handleSaveEan} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1.5">
                  EAN-13 / UPC / Custom Barcode
                </label>
                <input
                  type="text"
                  value={newEanCode}
                  onChange={(e) => setNewEanCode(e.target.value)}
                  placeholder="e.g. 5901234567890"
                  autoFocus
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 font-mono font-bold text-text-1 focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEanModal(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-2 font-semibold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newEanCode}
                  className="w-1/2 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-xs shadow-md transition-colors disabled:opacity-40"
                >
                  Save EAN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
