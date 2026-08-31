"use client";

import { useState } from "react";
import {
  Leaf,
  FileCheck,
  Calculator,
} from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";

export default function CarbonClient() {
  const [alloyType, setAlloyType] = useState("TITANIUM");
  const [rawWeightKg, setRawWeightKg] = useState(25);
  const [machiningKwh, setMachiningKwh] = useState(48);
  const [dieselLiters, setDieselLiters] = useState(4);

  // Computed live
  const alloyFactor = alloyType === "TITANIUM" ? 35.0 : alloyType === "ALUMINUM" ? 11.5 : 4.5;
  const scope1 = dieselLiters * 2.68;
  const scope2 = machiningKwh * 0.82;
  const scope3 = rawWeightKg * alloyFactor;
  const totalCo2e = scope1 + scope2 + scope3;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-green-950/30 to-teal-950/40 border border-emerald-500/20 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold border border-emerald-500/30">
              EU CBAM & ESG COMPLIANCE
            </span>
            <span className="text-xs text-white/50 font-mono">SCOPE 1 // SCOPE 2 // SCOPE 3 CO2e</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            EU CBAM & Embodied Carbon Footprint Calculator
          </h1>
          <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
            Measures specific greenhouse gas emissions per machined component to generate European Carbon Border Adjustment Mechanism (CBAM) green export certificates.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-black/40 border border-emerald-500/30 text-right font-mono">
          <div className="text-[10px] text-white/50 uppercase font-bold">Total Batch Carbon Footprint</div>
          <div className="text-2xl font-black text-emerald-400">
            {totalCo2e.toFixed(1)} <span className="text-sm">kg CO₂e</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Parameters */}
        <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-4">
          <h2 className="text-xs font-mono font-bold text-white uppercase border-b border-white/10 pb-3 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-emerald-400" />
            <span>Job Energy & Material Inputs</span>
          </h2>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-mono text-white/60 block mb-1">Raw Material Alloy Type</label>
              <select
                value={alloyType}
                onChange={(e) => setAlloyType(e.target.value)}
                className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
              >
                <option value="TITANIUM">Titanium Ti-6Al-4V (35.0 kg CO2e / kg)</option>
                <option value="ALUMINUM">Aerospace Aluminum 7075 (11.5 kg CO2e / kg)</option>
                <option value="STAINLESS">Stainless Steel 316L (4.5 kg CO2e / kg)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono text-white/60 block mb-1">Raw Billet Weight (kg)</label>
              <input
                type="number"
                value={rawWeightKg}
                onChange={(e) => setRawWeightKg(Number(e.target.value))}
                className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-white/60 block mb-1">Spindle Machining Electricity (kWh)</label>
              <input
                type="number"
                value={machiningKwh}
                onChange={(e) => setMachiningKwh(Number(e.target.value))}
                className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-white/60 block mb-1">Diesel Generator Fuel Allocated (Liters)</label>
              <input
                type="number"
                value={dieselLiters}
                onChange={(e) => setDieselLiters(Number(e.target.value))}
                className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
              />
            </div>
          </div>
        </div>

        {/* Scope 1, 2, 3 Breakdown */}
        <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-xs font-mono font-bold text-white uppercase border-b border-white/10 pb-3 flex items-center gap-2">
              <Leaf className="w-4 h-4 text-emerald-400" />
              <span>GHG Protocol Scope 1, 2, 3 Breakdown</span>
            </h2>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between">
                <div>
                  <div className="font-bold text-amber-300">Scope 1 (Direct Combustion)</div>
                  <div className="text-[10px] text-white/50">DG Diesel consumption @ 2.68 kg/L</div>
                </div>
                <div className="text-sm font-black text-white">{scope1.toFixed(1)} kg CO₂e</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between">
                <div>
                  <div className="font-bold text-cyan-300">Scope 2 (Purchased Electricity)</div>
                  <div className="text-[10px] text-white/50">Grid power @ 0.82 kg/kWh</div>
                </div>
                <div className="text-sm font-black text-white">{scope2.toFixed(1)} kg CO₂e</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between">
                <div>
                  <div className="font-bold text-purple-300">Scope 3 (Upstream Raw Metal)</div>
                  <div className="text-[10px] text-white/50">Billet smelting & extraction</div>
                </div>
                <div className="text-sm font-black text-white">{scope3.toFixed(1)} kg CO₂e</div>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              soundFx.playSuccess();
              toast.success("EU CBAM Green Export Certificate generated!");
            }}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2"
          >
            <FileCheck className="w-4 h-4" />
            <span>Generate Official EU CBAM Export Certificate</span>
          </button>
        </div>
      </div>
    </div>
  );
}
