"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  Activity,
  Radio,
  RefreshCw,
  AlertTriangle,
  Zap,
  Gauge,
  Thermometer,
  Waves,
  Cpu,
} from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface TelemetryPoint {
  time: string;
  spindleRpm: number;
  spindleLoadPct: number;
  vibrationMmSec: number;
  bearingTempC: number;
  coolantPressureBar: number;
  powerKw: number;
}

interface Anomaly {
  type: string;
  severity: "WARNING" | "CRITICAL";
  message: string;
  timestamp: string;
}

export default function TelemetryClient() {
  const [machines, setMachines] = useState<any[]>([]);
  const [selectedMachine, setSelectedMachine] = useState("CNC-01");
  const [timeSeries, setTimeSeries] = useState<TelemetryPoint[]>([]);
  const [latest, setLatest] = useState<TelemetryPoint | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [_loading, setLoading] = useState(true);

  const fetchData = async (machineCode?: string) => {
    try {
      const target = machineCode || selectedMachine;
      const res = await fetch(
        `/api/iot/telemetry?machine=${encodeURIComponent(target)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setMachines(data.machines || []);
        setTimeSeries(data.timeSeries || []);
        setLatest(data.latest || null);
        setAnomalies(data.anomalies || []);
      }
    } catch (err) {
      logClientError("Failed to load telemetry:", err, "TelemetryClient");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedMachine);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMachine]);

  // Live polling every 1.5s
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      fetchData(selectedMachine);
    }, 1500);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, selectedMachine]);

  // Simple SVG polyline sparkline generator
  const renderSparkline = (
    dataKey: keyof TelemetryPoint,
    minVal: number,
    maxVal: number,
    color: string,
  ) => {
    if (timeSeries.length < 2) return null;
    const width = 300;
    const height = 70;
    const padding = 5;

    const points = timeSeries
      .map((pt, idx) => {
        const x = (idx / (timeSeries.length - 1)) * width;
        const val = Number(pt[dataKey]) || 0;
        const normalized = Math.max(
          0,
          Math.min(1, (val - minVal) / (maxVal - minVal || 1)),
        );
        const y = height - padding - normalized * (height - 2 * padding);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    return (
      <svg
        className="w-full h-16 overflow-visible"
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          points={points}
        />
      </svg>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Real-Time CNC & Sensor Telemetry Historian"
        description="High-frequency edge waveform streams: Spindle Speed, Spindle Load %, Vibration RMS, Bearing Temp, and Coolant Pressure."
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLive(!isLive)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              isLive
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-surface-2 text-text-3 border-border"
            }`}
          >
            <Radio
              className={`w-3.5 h-3.5 ${isLive ? "animate-pulse text-emerald-400" : ""}`}
            />
            {isLive ? "Live Stream (1.5s)" : "Paused"}
          </button>
          <button
            onClick={() => fetchData(selectedMachine)}
            className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text-2 hover:text-text-1 cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </PageHeader>

      {/* Machine Selector Pills */}
      <div className="flex items-center gap-2 bg-surface-1 border border-border p-2 rounded-2xl overflow-x-auto">
        {machines.map((m) => (
          <button
            key={m.code}
            onClick={() => setSelectedMachine(m.code)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedMachine === m.code
                ? "bg-accent text-white shadow-md"
                : "text-text-3 hover:text-text-1 hover:bg-surface-2"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>{m.code}</span>
            <span
              className={`w-2 h-2 rounded-full ${
                m.status === "RUNNING" ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
          </button>
        ))}
      </div>

      {/* Anomaly Alert Banner */}
      {anomalies.length > 0 && (
        <div className="bg-rose-950/30 border border-rose-500/40 rounded-3xl p-4 space-y-2">
          {anomalies.map((anom, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2.5 text-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-bold">{anom.message}</span>
              </div>
              <span className="font-mono text-[10px] text-rose-400">
                {anom.timestamp}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 6 Sensor Waveform Cards Grid */}
      {latest && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1: Spindle Speed */}
          <div className="bg-surface-1 border border-border rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Gauge className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-text-1">
                    Spindle Speed
                  </h4>
                  <span className="text-[10px] text-text-3 font-mono">
                    Max: 15,000 RPM
                  </span>
                </div>
              </div>
              <div className="text-right font-mono">
                <span className="text-xl font-black text-cyan-400">
                  {latest.spindleRpm}
                </span>
                <span className="text-xs text-text-3 ml-1">RPM</span>
              </div>
            </div>
            {renderSparkline("spindleRpm", 0, 15000, "#22d3ee")}
          </div>

          {/* Card 2: Motor Load % */}
          <div className="bg-surface-1 border border-border rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-text-1">
                    Motor Load %
                  </h4>
                  <span className="text-[10px] text-text-3 font-mono">
                    Safe: &lt; 85%
                  </span>
                </div>
              </div>
              <div className="text-right font-mono">
                <span className="text-xl font-black text-purple-400">
                  {latest.spindleLoadPct}
                </span>
                <span className="text-xs text-text-3 ml-1">%</span>
              </div>
            </div>
            {renderSparkline("spindleLoadPct", 0, 100, "#c084fc")}
          </div>

          {/* Card 3: Spindle Vibration */}
          <div className="bg-surface-1 border border-border rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Waves className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-text-1">
                    Vibration Velocity
                  </h4>
                  <span className="text-[10px] text-text-3 font-mono">
                    ISO 10816 Limit: 1.8
                  </span>
                </div>
              </div>
              <div className="text-right font-mono">
                <span className="text-xl font-black text-amber-400">
                  {latest.vibrationMmSec}
                </span>
                <span className="text-xs text-text-3 ml-1">mm/s</span>
              </div>
            </div>
            {renderSparkline("vibrationMmSec", 0, 3.0, "#fbbf24")}
          </div>

          {/* Card 4: Bearing Temp */}
          <div className="bg-surface-1 border border-border rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <Thermometer className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-text-1">
                    Bearing Temperature
                  </h4>
                  <span className="text-[10px] text-text-3 font-mono">
                    Limit: 55 °C
                  </span>
                </div>
              </div>
              <div className="text-right font-mono">
                <span className="text-xl font-black text-rose-400">
                  {latest.bearingTempC}
                </span>
                <span className="text-xs text-text-3 ml-1">°C</span>
              </div>
            </div>
            {renderSparkline("bearingTempC", 20, 60, "#fb7185")}
          </div>

          {/* Card 5: Coolant Pressure */}
          <div className="bg-surface-1 border border-border rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Gauge className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-text-1">
                    Coolant Pressure
                  </h4>
                  <span className="text-[10px] text-text-3 font-mono">
                    Thru-Spindle High Pressure
                  </span>
                </div>
              </div>
              <div className="text-right font-mono">
                <span className="text-xl font-black text-blue-400">
                  {latest.coolantPressureBar}
                </span>
                <span className="text-xs text-text-3 ml-1">Bar</span>
              </div>
            </div>
            {renderSparkline("coolantPressureBar", 0, 40, "#60a5fa")}
          </div>

          {/* Card 6: Active Power */}
          <div className="bg-surface-1 border border-border rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-text-1">
                    Active Power
                  </h4>
                  <span className="text-[10px] text-text-3 font-mono">
                    Spindle + Servos Total
                  </span>
                </div>
              </div>
              <div className="text-right font-mono">
                <span className="text-xl font-black text-emerald-400">
                  {latest.powerKw}
                </span>
                <span className="text-xs text-text-3 ml-1">kW</span>
              </div>
            </div>
            {renderSparkline("powerKw", 0, 30, "#34d399")}
          </div>
        </div>
      )}
    </div>
  );
}
