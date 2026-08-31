"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  Activity,
  RotateCcw,
  Gauge,
} from "lucide-react";
import { soundFx } from "@/lib/soundFx";

interface MachineStream {
  machineId: string;
  code: string;
  name: string;
  status: string;
  telemetry: {
    spindleRpm: number;
    vibrationRms: string;
    tempBearing: string;
    currentAmps: string;
    powerKw: string;
    coolantFlowLpm: string;
    sparkplugPayload: string;
    healthScore: number;
  };
}

export default function LiveCockpitClient() {
  const [streams, setStreams] = useState<MachineStream[]>([]);

  const fetchLiveFeeds = async () => {
    try {
      const res = await fetch("/api/iot/live-cockpit");
      const data = await res.json();
      if (data?.success) {
        setStreams(data.streams);
      }
    } catch (err) {
      logClientError(err, "LiveCockpitClient");
    }
  };

  useEffect(() => {
    fetchLiveFeeds();
    const interval = setInterval(fetchLiveFeeds, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-slate-950/40 border border-cyan-500/20 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold border border-cyan-500/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>LIVE ISA-95 UNS STREAMING</span>
            </span>
            <span className="text-xs text-white/50 font-mono">MQTT SPARKPLUG B // 3-SEC HEARTBEAT</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Shopfloor High-FPS Real-Time Telemetry Cockpit
          </h1>
          <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
            Live edge vibration waveforms ($X/Y/Z$ mm/s RMS), spindle high-speed tachometer feeds, active current draw, and bearing thermals.
          </p>
        </div>

        <button
          onClick={() => {
            fetchLiveFeeds();
            soundFx.playClick();
          }}
          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-mono font-bold border border-white/10 flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Force Refresh</span>
        </button>
      </div>

      {/* Grid of Machine Live Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {streams.map((m) => {
          const isRunning = m.status === "RUNNING" || m.telemetry.spindleRpm > 0;

          return (
            <div
              key={m.machineId}
              className="p-5 rounded-3xl bg-white/[0.02] border border-white/10 hover:border-cyan-400/40 transition-all space-y-4 relative overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-mono text-cyan-300 font-bold block">{m.code}</span>
                  <h3 className="font-black text-sm text-white">{m.name}</h3>
                </div>

                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black flex items-center gap-1 ${
                  isRunning
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-white/10 text-white/50"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`} />
                  <span>{isRunning ? "SPINDLE RUNNING" : "STANDBY / IDLE"}</span>
                </span>
              </div>

              {/* Spindle RPM & Vibration Gauge */}
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="p-3.5 rounded-2xl bg-black/50 border border-cyan-500/20 space-y-1">
                  <span className="text-[10px] text-cyan-300/70 font-bold uppercase flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-cyan-400" />
                    <span>Spindle RPM</span>
                  </span>
                  <div className="text-xl font-black text-white">{m.telemetry.spindleRpm.toLocaleString()}</div>
                  <div className="text-[9px] text-white/40">Max Rated: 15,000 RPM</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-black/50 border border-purple-500/20 space-y-1">
                  <span className="text-[10px] text-purple-300/70 font-bold uppercase flex items-center gap-1">
                    <Activity className="w-3 h-3 text-purple-400" />
                    <span>Vibration RMS</span>
                  </span>
                  <div className="text-xl font-black text-purple-300">{m.telemetry.vibrationRms} <span className="text-xs">mm/s</span></div>
                  <div className="text-[9px] text-emerald-400">ISO 10816: Zone A (Good)</div>
                </div>
              </div>

              {/* Thermal & Power Draw */}
              <div className="grid grid-cols-3 gap-2 font-mono text-[10px]">
                <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 text-center">
                  <div className="text-white/40">Bearing Temp</div>
                  <div className="text-xs font-bold text-amber-300 mt-0.5">{m.telemetry.tempBearing}°C</div>
                </div>
                <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 text-center">
                  <div className="text-white/40">Current Draw</div>
                  <div className="text-xs font-bold text-cyan-300 mt-0.5">{m.telemetry.currentAmps} A</div>
                </div>
                <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 text-center">
                  <div className="text-white/40">Coolant Flow</div>
                  <div className="text-xs font-bold text-blue-300 mt-0.5">{m.telemetry.coolantFlowLpm} L/m</div>
                </div>
              </div>

              {/* Topic UNS */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[9px] font-mono text-white/40">
                <span>MQTT UNS Topic:</span>
                <span className="text-cyan-300/80">{m.telemetry.sparkplugPayload}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
