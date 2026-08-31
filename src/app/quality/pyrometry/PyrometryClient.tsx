"use client";

import { useState, useEffect } from "react";

interface FurnaceSurvey {
  id: string;
  name: string;
  classType: string;
  classDesc: string;
  tempRange: string;
  lastTusDate: string;
  nextTusDueDate: string;
  satFrequency: string;
  lastSatDeltaDegC: number;
  maxAllowedDeltaDegC: number;
  thermocoupleCalibrationCert: string;
  status: string;
}

export default function PyrometryClient() {
  const [furnaces, setFurnaces] = useState<FurnaceSurvey[]>([]);

  useEffect(() => {
    fetch("/api/quality/pyrometry")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setFurnaces(data.furnaces);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-orange-950/40 via-red-950/30 to-amber-950/40 border border-orange-500/20 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-xs font-mono font-bold border border-orange-500/30">
              AEROSPACE PYROMETRY (AMS 2750G)
            </span>
            <span className="text-xs text-white/50 font-mono">TUS // SAT // THERMOCOUPLE CALIBRATION</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Aerospace Furnace Pyrometry & Thermal Uniformity (TUS)
          </h1>
          <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
            Tracks Temperature Uniformity Surveys (TUS), System Accuracy Tests (SAT), and thermocouple calibration intervals for in-house Nadcap-compliant heat treatment furnaces.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {furnaces.map((furn) => (
          <div key={furn.id} className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-black text-orange-400">{furn.id}</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                {furn.status}
              </span>
            </div>

            <div>
              <h3 className="text-base font-extrabold text-white">{furn.name}</h3>
              <p className="text-xs text-orange-300 font-mono mt-0.5">{furn.classDesc}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 p-4 rounded-2xl bg-black/40 border border-white/10 font-mono text-xs">
              <div>
                <span className="text-white/40 block text-[10px]">OPERATING RANGE</span>
                <span className="font-bold text-white">{furn.tempRange}</span>
              </div>
              <div>
                <span className="text-white/40 block text-[10px]">LAST SAT DELTA</span>
                <span className="font-bold text-emerald-400">± {furn.lastSatDeltaDegC}°C</span>
              </div>
              <div>
                <span className="text-white/40 block text-[10px]">LAST TUS SURVEY</span>
                <span className="font-bold text-white">{furn.lastTusDate}</span>
              </div>
              <div>
                <span className="text-white/40 block text-[10px]">NEXT TUS DUE</span>
                <span className="font-bold text-amber-300">{furn.nextTusDueDate}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-white/50 pt-2 border-t border-white/10">
              <span>Cert: {furn.thermocoupleCalibrationCert}</span>
              <span className="text-cyan-300">SAT: {furn.satFrequency}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
