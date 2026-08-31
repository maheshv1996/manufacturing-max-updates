"use client";

import { useState, useEffect } from "react";

interface PowderBatch {
  id: string;
  alloy: string;
  manufacturer: string;
  particleSizeDistribution: string;
  virginWeightKg: number;
  currentWeightKg: number;
  sievePassCount: number;
  maxAllowedReuses: number;
  virginBlendRatioPercent: number;
  chamberOxygenPpmLastRun: number;
  status: string;
}

export default function PowderLogClient() {
  const [batches, setBatches] = useState<PowderBatch[]>([]);

  useEffect(() => {
    fetch("/api/rnd/powder-log")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setBatches(data.powderBatches);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-950/40 via-pink-950/30 to-indigo-950/40 border border-purple-500/20 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-mono font-bold border border-purple-500/30">
              ADDITIVE MANUFACTURING (DMLS / SLM)
            </span>
            <span className="text-xs text-white/50 font-mono">3D METAL POWDER RECYCLING // PSD TRACKING</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            3D Metal Printing Powder Lifecycle & Sieve Log
          </h1>
          <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
            Tracks virgin vs sieved powder reuse counts, sieve mesh pass history, virgin blend ratios, and build chamber inert gas oxygen ($O_2$) ppm levels.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {batches.map((batch) => {
          const isWarning = batch.status === "RECYCLE_LIMIT_WARNING";

          return (
            <div
              key={batch.id}
              className={`p-6 rounded-3xl border transition-all space-y-4 ${
                isWarning ? "bg-amber-500/10 border-amber-500/40" : "bg-white/[0.02] border-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-black text-purple-300">{batch.id}</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                    isWarning
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  }`}
                >
                  {batch.status.replace(/_/g, " ")}
                </span>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-white">{batch.alloy}</h3>
                <p className="text-xs text-white/60 font-mono">{batch.manufacturer} • {batch.particleSizeDistribution}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 p-4 rounded-2xl bg-black/40 border border-white/10 font-mono text-xs">
                <div>
                  <span className="text-white/40 block text-[10px]">CURRENT STOCK</span>
                  <span className="text-sm font-black text-emerald-400">{batch.currentWeightKg} kg</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px]">SIEVE REUSE PASS</span>
                  <span className="text-sm font-black text-purple-300">
                    Cycle {batch.sievePassCount} of {batch.maxAllowedReuses}
                  </span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px]">CHAMBER O₂ PPM</span>
                  <span className="font-bold text-cyan-300">{batch.chamberOxygenPpmLastRun} ppm (Safe &lt;50)</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px]">VIRGIN TOP-UP RATIO</span>
                  <span className="font-bold text-white">{batch.virginBlendRatioPercent}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
