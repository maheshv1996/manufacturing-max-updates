"use client";

import { useState, useEffect } from "react";
import {
  Droplets,
  Plus,
} from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";

interface CoolantSump {
  machineId: string;
  machineName: string;
  coolantBrand: string;
  tankCapacityLiters: number;
  brixReading: number;
  multiplier: number;
  actualConcentrationPercent: number;
  targetConcentrationMin: number;
  targetConcentrationMax: number;
  phValue: number;
  trampOilStatus: string;
  odorStatus: string;
  lastToppedUpDate: string;
  status: string;
}

export default function CoolantClient() {
  const [sumps, setSumps] = useState<CoolantSump[]>([]);

  // Form State
  const [machineId, setMachineId] = useState("CNC-01");
  const [brixReading, setBrixReading] = useState(8.0);
  const [phValue, setPhValue] = useState(9.0);
  const [trampOil, setTrampOil] = useState("LOW");

  useEffect(() => {
    fetch("/api/maintenance/coolant")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setSumps(data.sumps);
      })
      .catch(() => {});
  }, []);

  const handleLog = (e: React.FormEvent) => {
    e.preventDefault();
    const conc = Number(brixReading);
    const status = conc < 7.0 ? "LOW_CONCENTRATION_WARNING" : conc > 10.0 ? "HIGH_CONCENTRATION_WARNING" : "OPTIMAL";

    const updated = sumps.map((s) =>
      s.machineId === machineId
        ? {
            ...s,
            brixReading: conc,
            actualConcentrationPercent: conc,
            phValue: Number(phValue),
            trampOilStatus: trampOil,
            status,
            lastToppedUpDate: new Date().toISOString().split("T")[0],
          }
        : s,
    );

    setSumps(updated);
    soundFx.playSuccess();
    toast.success(`Logged coolant refractometer reading for ${machineId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-indigo-950/40 border border-cyan-500/20 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold border border-cyan-500/30">
              FLUID & SUMP HEALTH
            </span>
            <span className="text-xs text-white/50 font-mono">OPTICAL REFRACTOMETRY // pH MONITORING</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            CNC Coolant Refractometer & Sump Health Log
          </h1>
          <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
            Daily Brix % concentration, emulsion pH, and tramp-oil monitoring. Prevents workpiece rust, premature carbide tool wear, and operator skin dermatitis.
          </p>
        </div>
      </div>

      {/* Sumps Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sumps.map((sump) => {
          const isOptimal = sump.status === "OPTIMAL";
          const isLow = sump.status === "LOW_CONCENTRATION_WARNING";

          return (
            <div
              key={sump.machineId}
              className={`p-5 rounded-3xl border transition-all space-y-4 ${
                isOptimal
                  ? "bg-white/[0.02] border-white/10"
                  : isLow
                  ? "bg-amber-500/10 border-amber-500/40"
                  : "bg-red-500/10 border-red-500/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-black text-cyan-300">{sump.machineId}</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                    isOptimal
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : isLow
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-red-500/20 text-red-300 border-red-500/40"
                  }`}
                >
                  {sump.status.replace(/_/g, " ")}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-extrabold text-white">{sump.machineName}</h3>
                <p className="text-xs text-white/60 font-mono">{sump.coolantBrand}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-black/40 border border-white/10 font-mono text-xs">
                <div>
                  <span className="text-white/40 block text-[10px]">BRIX READING</span>
                  <span className="text-base font-black text-cyan-300">{sump.brixReading}%</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px]">EMULSION pH</span>
                  <span className="text-base font-black text-purple-300">{sump.phValue}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px]">TRAMP OIL</span>
                  <span className="font-bold text-white">{sump.trampOilStatus}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px]">TANK CAPACITY</span>
                  <span className="font-bold text-white">{sump.tankCapacityLiters} L</span>
                </div>
              </div>

              <div className="text-[10px] font-mono text-white/50 text-right">
                Last checked: {sump.lastToppedUpDate}
              </div>
            </div>
          );
        })}
      </div>

      {/* Form to Log Daily Reading */}
      <form onSubmit={handleLog} className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <Plus className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-mono font-bold text-white uppercase">Log Daily Machine Refractometer Reading</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] font-mono text-white/60 block mb-1">Select Machine</label>
            <select
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
            >
              <option value="CNC-01">CNC-01 (Hermle C42 5-Axis)</option>
              <option value="CNC-02">CNC-02 (Mazak Integrex)</option>
              <option value="CNC-03">CNC-03 (DMG Mori NLX Lathe)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono text-white/60 block mb-1">Optical Brix Reading (%)</label>
            <input
              type="number"
              step="0.1"
              value={brixReading}
              onChange={(e) => setBrixReading(Number(e.target.value))}
              className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono text-white/60 block mb-1">Emulsion pH (Target 8.8 - 9.4)</label>
            <input
              type="number"
              step="0.1"
              value={phValue}
              onChange={(e) => setPhValue(Number(e.target.value))}
              className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono text-white/60 block mb-1">Tramp Oil Status</label>
            <select
              value={trampOil}
              onChange={(e) => setTrampOil(e.target.value)}
              className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
            >
              <option value="LOW">LOW (Clean surface)</option>
              <option value="MODERATE">MODERATE (Skimmer needed)</option>
              <option value="HEAVY">HEAVY (Immediate purge)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-xs shadow-lg shadow-cyan-500/20 cursor-pointer flex items-center gap-2"
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>Save Sump Reading</span>
          </button>
        </div>
      </form>
    </div>
  );
}
