"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import { Wrench, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface PredictiveItem {
  machineId: string;
  machineCode: string;
  machineName: string;
  lineName: string;
  healthIndexPct: number;
  rulOperatingHours: number;
  failureProbabilityPct: number;
  riskLevel: "HEALTHY" | "ELEVATED_WEAR" | "CRITICAL_INTERVENTION";
  primaryWearComponent: string;
  recommendedAction: string;
  forecastCurve: {
    day: string;
    projectedVibrationMmSec: number;
    projectedHealthPct: number;
  }[];
}

export default function PredictiveClient() {
  const [predictions, setPredictions] = useState<PredictiveItem[]>([]);
  const [stats, setStats] = useState({
    totalAnalyzed: 0,
    criticalMachines: 0,
    avgFleetHealthPct: 0,
    estimatedUnplannedDowntimeSavedHours: 0,
  });
  const [_loading, setLoading] = useState(true);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/maintenance/predictive");
      if (res.ok) {
        const data = await res.json();
        setPredictions(data.predictions || []);
        setStats(
          data.stats || {
            totalAnalyzed: 0,
            criticalMachines: 0,
            avgFleetHealthPct: 0,
            estimatedUnplannedDowntimeSavedHours: 0,
          },
        );
      }
    } catch (err) {
      logClientError("Failed to load predictive data:", err, "PredictiveClient");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleScheduleReplacement = async (item: PredictiveItem) => {
    setDispatchingId(item.machineId);
    setActionMessage(null);
    try {
      const res = await fetch("/api/maintenance/predictive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machineId: item.machineId,
          component: item.primaryWearComponent,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActionMessage(data.message || "Preemptive maintenance scheduled");
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err) {
      logClientError("Schedule error:", err, "PredictiveClient");
    } finally {
      setDispatchingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Predictive Maintenance & Spindle Remaining Useful Life (RUL)"
        description="Machine learning degradation forecasting: Weibull failure probability, ISO 10816 vibration trajectory, and preemptive bearing replacement."
      >
        <button
          onClick={fetchData}
          className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text-2 hover:text-text-1 cursor-pointer transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </PageHeader>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Fleet Health Index
          </span>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
            {stats.avgFleetHealthPct}%
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Composite spindle wear rating
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Critical Interventions
          </span>
          <div className="text-2xl font-black font-mono text-rose-400 mt-1 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <span>{stats.criticalMachines} Machines</span>
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Action required &lt; 72 hours
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Downtime Saved
          </span>
          <div className="text-2xl font-black font-mono text-cyan-400 mt-1">
            +{stats.estimatedUnplannedDowntimeSavedHours} hrs
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Preemptive vs breakdown cost
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Prediction Model
          </span>
          <div className="text-2xl font-black font-mono text-purple-400 mt-1">
            Weibull RUL
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            ISO 10816 Class II Standard
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Machine Predictive Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {predictions.map((p) => {
          const isCritical = p.riskLevel === "CRITICAL_INTERVENTION";
          const isElevated = p.riskLevel === "ELEVATED_WEAR";

          return (
            <div
              key={p.machineId}
              className={`bg-surface-1 border rounded-3xl p-6 shadow-sm space-y-4 transition-all ${
                isCritical
                  ? "border-rose-500/60 ring-2 ring-rose-500/20"
                  : isElevated
                    ? "border-amber-500/40"
                    : "border-border"
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-text-1">
                      {p.machineCode} — {p.machineName}
                    </h3>
                  </div>
                  <span className="text-[11px] text-text-3 font-mono">
                    {p.lineName}
                  </span>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono ${
                    isCritical
                      ? "bg-rose-500/20 text-rose-300 animate-pulse border border-rose-500/40"
                      : isElevated
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-emerald-500/20 text-emerald-300"
                  }`}
                >
                  {p.riskLevel.replace(/_/g, " ")}
                </span>
              </div>

              {/* RUL & Health Gauges Grid */}
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div className="p-3 rounded-2xl bg-surface-2 border border-border/80 text-center">
                  <span className="text-[10px] text-text-3 uppercase block">
                    Health Index
                  </span>
                  <span
                    className={`text-base font-black ${isCritical ? "text-rose-400" : "text-emerald-400"}`}
                  >
                    {p.healthIndexPct}%
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-surface-2 border border-border/80 text-center">
                  <span className="text-[10px] text-text-3 uppercase block">
                    RUL Remaining
                  </span>
                  <span
                    className={`text-base font-black ${isCritical ? "text-rose-400" : "text-cyan-400"}`}
                  >
                    {p.rulOperatingHours} hrs
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-surface-2 border border-border/80 text-center">
                  <span className="text-[10px] text-text-3 uppercase block">
                    Failure Prob
                  </span>
                  <span
                    className={`text-base font-black ${isCritical ? "text-rose-400" : "text-amber-400"}`}
                  >
                    {p.failureProbabilityPct}%
                  </span>
                </div>
              </div>

              {/* Wear Component & Recommendation */}
              <div className="p-3.5 rounded-2xl bg-surface-2/70 border border-border/80 space-y-1.5 text-xs">
                <div className="font-bold text-text-1">
                  Primary Degradation Focus:{" "}
                  <span className="text-accent">{p.primaryWearComponent}</span>
                </div>
                <p className="text-text-3 text-[11px]">{p.recommendedAction}</p>
              </div>

              {/* Forecast Degradation Sparkline */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-3 block">
                  14-Day Projected Degradation Trajectory (Vibration RMS):
                </span>
                <div className="flex items-end gap-1 h-12 bg-slate-950 p-2 rounded-xl border border-border/60">
                  {p.forecastCurve.map((fc, idx) => {
                    const barHeight = Math.min(
                      100,
                      (fc.projectedVibrationMmSec / 4.0) * 100,
                    );

                    return (
                      <div
                        key={idx}
                        className="flex-1 bg-surface-3 hover:bg-accent rounded-t transition-all relative group cursor-pointer"
                        style={{ height: `${barHeight}%` }}
                      >
                        <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-surface-1 border border-border p-1 rounded text-[9px] font-mono whitespace-nowrap z-20">
                          {fc.day}: {fc.projectedVibrationMmSec} mm/s
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 border-t border-border/40 flex justify-end">
                <button
                  onClick={() => handleScheduleReplacement(p)}
                  disabled={dispatchingId === p.machineId}
                  className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  {dispatchingId === p.machineId
                    ? "Scheduling..."
                    : "Schedule Preemptive Replacement"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
