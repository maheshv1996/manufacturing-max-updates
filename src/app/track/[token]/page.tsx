"use client";

import { useEffect, useState, use } from "react";
import {
  Package,
  Mail,
  Truck,
  Layers,
  ArrowRight,
  Loader2,
  ShieldCheck,
  AlertCircle,
  Factory,
  Sparkles,
} from "lucide-react";

interface RoutingStep {
  id: string;
  seq: number;
  stationName: string;
  operationName: string;
  operationCode: string;
}

interface MovementLog {
  fromStation: string;
  toStation: string;
  quantity: number;
  timestamp: string;
}

interface TrackingData {
  woNumber: string;
  customerName: string;
  promisedDispatchDate: string;
  plannedQuantity: number;
  totalGoodQuantity: number;
  completionPercentage: number;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";
  currentSeq: number;
  product: {
    name: string;
    sku: string;
    description?: string | null;
  };
  routingSteps: RoutingStep[];
  recentMovements: MovementLog[];
}

export default function PublicOrderTrackerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrackingData() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/track/${token}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to load tracking data");
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid tracking link");
      } finally {
        setLoading(false);
      }
    }
    if (token) {
      fetchTrackingData();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto" />
          <p className="text-slate-400 text-sm font-medium">
            Fetching real-time order status...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-400 rounded-2xl w-fit mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">
            Tracking Link Not Found
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            {error ||
              "We could not find an active work order matching this tracking token."}
          </p>
          <a
            href="mailto:support@manufacturingmax.com"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors"
          >
            <Mail className="w-4 h-4" /> Contact Customer Support
          </a>
        </div>
      </div>
    );
  }

  const dispatchDate = new Date(data.promisedDispatchDate);
  const isCompleted = data.status === "COMPLETED";
  const isOnHold = data.status === "ON_HOLD";
  const steps = data.routingSteps || [];

  // Pizza tracker steps: product routing steps + final Dispatch step
  const allSteps = [
    ...steps,
    {
      id: "dispatch",
      seq: steps.length + 1,
      stationName: "Shipping Dock",
      operationName: "Final Order Dispatch",
      operationCode: "DISPATCH",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 md:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* ── FACTORY BRANDING HEADER ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600/20 border border-blue-500/40 rounded-2xl text-blue-400">
              <Factory className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  Manufacturing MAX
                </span>
                <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-700/60 text-emerald-300 text-[10px] font-mono font-bold rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Live Customer Portal
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">
                Real-Time Order Tracker
              </h1>
            </div>
          </div>

          <a
            href={`mailto:admin@manufacturingmax.com?subject=Inquiry regarding Order ${data.woNumber}`}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 transition-all hover:scale-105 shrink-0"
          >
            <Mail className="w-4 h-4 text-blue-400" />
            Contact Factory Operations
          </a>
        </div>

        {/* ── CLIENT & ORDER BANNER ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 bg-cyan-950 border border-cyan-700/60 text-cyan-300 text-xs font-mono font-bold rounded-xl">
                  🏢 Order For: {data.customerName}
                </span>
                <span className="px-3 py-1 bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs font-bold rounded-xl">
                  #{data.woNumber}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white pt-1">
                {data.product.name}
              </h2>
              {data.product.sku && (
                <p className="text-xs text-slate-400 font-mono">
                  Part SKU: {data.product.sku}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`px-4 py-2 rounded-2xl text-xs font-extrabold border ${
                  isCompleted
                    ? "bg-emerald-950 border-emerald-700 text-emerald-300"
                    : isOnHold
                      ? "bg-amber-950 border-amber-700 text-amber-300"
                      : "bg-blue-950 border-blue-700 text-blue-300"
                }`}
              >
                {isCompleted
                  ? "✓ ORDER COMPLETED"
                  : isOnHold
                    ? "⚠️ QUALITY HOLD"
                    : "▶ IN PRODUCTION"}
              </div>
            </div>
          </div>

          {/* ── VISUAL TRACKER ("THE PIZZA TRACKER") ── */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Live Manufacturing Stages
              </span>
              <span className="text-cyan-300 font-mono">
                {isCompleted
                  ? "Stage: Ready for Dispatch"
                  : `Current Stage: Step ${data.currentSeq} of ${steps.length}`}
              </span>
            </div>

            {/* Stepper Grid */}
            <div className="relative py-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {allSteps.map((step, idx) => {
                  const isDispatchStep = step.operationCode === "DISPATCH";
                  const stepFinished =
                    isCompleted ||
                    (!isDispatchStep && step.seq < data.currentSeq);
                  const isCurrent =
                    !isCompleted &&
                    ((!isDispatchStep && step.seq === data.currentSeq) ||
                      (isDispatchStep && data.currentSeq > steps.length));
                  const isUpcoming = !stepFinished && !isCurrent;

                  return (
                    <div
                      key={step.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                        stepFinished
                          ? "bg-emerald-950/40 border-emerald-700/80 text-emerald-200"
                          : isCurrent
                            ? "bg-cyan-950/80 border-cyan-400 text-white shadow-xl shadow-cyan-500/20 ring-2 ring-cyan-400 animate-pulse"
                            : "bg-slate-950/60 border-slate-800 text-slate-500"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
                          {isDispatchStep ? "FINAL" : `OP ${step.seq * 10}`}
                        </span>
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            stepFinished
                              ? "bg-emerald-600 text-white"
                              : isCurrent
                                ? "bg-cyan-400 text-slate-950 font-black"
                                : "bg-slate-800 text-slate-500"
                          }`}
                        >
                          {stepFinished ? "✓" : isCurrent ? "▶" : idx + 1}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-white truncate">
                          {step.operationName}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          📍 {step.stationName}
                        </p>
                      </div>

                      <div className="text-[10px] font-mono pt-1">
                        {stepFinished && (
                          <span className="text-emerald-400">Completed</span>
                        )}
                        {isCurrent && (
                          <span className="text-cyan-300 font-bold">
                            Active Machine
                          </span>
                        )}
                        {isUpcoming && <span>Upcoming</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── STATUS & DISPATCH CARDS GRID ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Expected Dispatch */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-400" />
                Promised Dispatch Date
              </span>
              <p className="text-2xl font-black text-white pt-1">
                {dispatchDate.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between text-xs text-slate-400">
              <span>Fulfillment Status:</span>
              <span className="font-bold text-emerald-400 font-mono">
                {isCompleted ? "Ready for Shipping" : "On Track for Delivery"}
              </span>
            </div>
          </div>

          {/* Card 2: Production Quantity Progress */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-400" />
                  Estimated Order Completion
                </span>
                <span className="text-xl font-black text-cyan-300 font-mono">
                  {data.completionPercentage}%
                </span>
              </div>

              <div className="w-full bg-slate-950 h-3.5 rounded-full overflow-hidden p-0.5 border border-slate-800 mt-2">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all duration-700 shadow-sm shadow-blue-500/50"
                  style={{ width: `${data.completionPercentage}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 font-mono pt-1">
              <span>
                Units Produced: {data.totalGoodQuantity.toLocaleString()}
              </span>
              <span>
                Total Planned: {data.plannedQuantity.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* ── RECENT TRANSIT MILESTONES ── */}
        {data.recentMovements && data.recentMovements.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              Verified Shopfloor Movements
            </h3>

            <div className="space-y-2">
              {data.recentMovements.slice(0, 4).map((log, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-slate-400">{log.fromStation}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-white font-bold">
                      {log.toStation}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-slate-400">
                    <span className="text-cyan-300 font-bold">
                      {log.quantity} pcs
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="text-center text-xs text-slate-500 pt-4">
          Manufacturing MAX Enterprise MES · Real-time status update
          automatically synchronized with factory floor.
        </div>
      </div>
    </div>
  );
}
