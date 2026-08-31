"use client";

import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import { Plus, Play, Pause, AlertOctagon, Maximize, Cpu } from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface KioskState {
  stationId: string;
  operatorName: string;
  machineCode: string;
  activeWoNumber: string;
  productName: string;
  sku: string;
  plannedQty: number;
  goodPieces: number;
  scrapPieces: number;
  cycleTimeSec: number;
  state: string;
  lastClockTime: string;
}

export default function KioskClient() {
  const [kiosk, setKiosk] = useState<KioskState | null>(null);
  const [_loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);
  const [feedbackEffect, setFeedbackEffect] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/ops/kiosk");
      if (res.ok) {
        const data = await res.json();
        setKiosk(data.kiosk || null);
      }
    } catch (err) {
      logClientError("Failed to load kiosk data:", err, "KioskClient");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAction = async (action: string, countDelta = 1) => {
    setClocking(true);
    setFeedbackEffect(action);
    setTimeout(() => setFeedbackEffect(null), 800);
    try {
      const res = await fetch("/api/ops/kiosk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, countDelta }),
      });
      if (res.ok) {
        const data = await res.json();
        setKiosk(data.kiosk);
      }
    } catch (err) {
      logClientError("Action error:", err, "KioskClient");
    } finally {
      setClocking(false);
    }
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => logClientError(err, "KioskClient"));
    } else {
      document.exitFullscreen().catch((err) => logClientError(err, "KioskClient"));
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 select-none">
      <PageHeader
        title="Shopfloor Tablet Kiosk Mode (Industrial Touch UI)"
        description="Rugged touch terminal optimized for glove-operated tablets: 1-touch piece clocking, scrap logging, and Andon emergency calls."
      >
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullScreen}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-xs font-bold text-text-1 cursor-pointer transition-all"
          >
            <Maximize className="w-4 h-4 text-cyan-400" />
            Full Screen
          </button>
        </div>
      </PageHeader>

      {kiosk && (
        <div className="space-y-6">
          {/* Workstation Header Bar */}
          <div className="bg-slate-950 border-2 border-border/80 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-2xl">
                <Cpu className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-cyan-300">
                    {kiosk.stationId}
                  </span>
                  <span
                    className={`px-3 py-0.5 rounded-full text-xs font-bold font-mono ${
                      kiosk.state === "RUNNING"
                        ? "bg-emerald-500/20 text-emerald-300 animate-pulse"
                        : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {kiosk.state}
                  </span>
                </div>
                <h2 className="text-lg font-black text-white mt-0.5">
                  {kiosk.productName}
                </h2>
                <div className="text-xs text-text-3 font-mono">
                  WO:{" "}
                  <span className="text-text-1 font-bold">
                    #{kiosk.activeWoNumber}
                  </span>{" "}
                  · Operator:{" "}
                  <span className="text-cyan-300 font-bold">
                    {kiosk.operatorName}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-right font-mono">
              <div>
                <span className="text-[10px] text-text-3 uppercase block">
                  Target Batch
                </span>
                <span className="text-xl font-black text-white">
                  {kiosk.plannedQty} pcs
                </span>
              </div>
              <div className="w-px h-10 bg-border/60" />
              <div>
                <span className="text-[10px] text-text-3 uppercase block">
                  Cycle Time
                </span>
                <span className="text-xl font-black text-cyan-400">
                  {kiosk.cycleTimeSec}s
                </span>
              </div>
            </div>
          </div>

          {/* Giant Counters Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Good Pieces Display */}
            <div className="bg-emerald-950/20 border-2 border-emerald-500/40 rounded-3xl p-8 shadow-xl text-center space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-400 font-mono">
                GOOD MANUFACTURED PIECES
              </span>
              <div className="text-7xl font-black font-mono text-emerald-300 tracking-tight">
                {kiosk.goodPieces}
              </div>
              <div className="text-xs text-emerald-400 font-mono">
                Completion:{" "}
                {Math.round((kiosk.goodPieces / kiosk.plannedQty) * 100)}% of
                target
              </div>
            </div>

            {/* Scrap Pieces Display */}
            <div className="bg-rose-950/20 border-2 border-rose-500/40 rounded-3xl p-8 shadow-xl text-center space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-rose-400 font-mono">
                DEFECT / SCRAP PIECES
              </span>
              <div className="text-7xl font-black font-mono text-rose-300 tracking-tight">
                {kiosk.scrapPieces}
              </div>
              <div className="text-xs text-rose-400 font-mono">
                Scrap Rate:{" "}
                {(
                  (kiosk.scrapPieces /
                    (kiosk.goodPieces + kiosk.scrapPieces || 1)) *
                  100
                ).toFixed(1)}
                %
              </div>
            </div>
          </div>

          {/* Giant Touch Buttons Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 1. +1 Good Piece */}
            <button
              onClick={() => handleAction("ADD_GOOD", 1)}
              disabled={clocking}
              className={`min-h-[110px] rounded-3xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-lg shadow-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all border-2 border-emerald-400 ${
                feedbackEffect === "ADD_GOOD"
                  ? "ring-8 ring-emerald-400/50 scale-105"
                  : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <Plus className="w-7 h-7" />
                <span>+1 GOOD PIECE</span>
              </div>
              <span className="text-xs font-mono font-normal opacity-90">
                Touch to clock completed part
              </span>
            </button>

            {/* 2. +1 Scrap Piece */}
            <button
              onClick={() => handleAction("ADD_SCRAP", 1)}
              disabled={clocking}
              className={`min-h-[110px] rounded-3xl bg-rose-700 hover:bg-rose-600 active:scale-95 text-white font-black text-lg shadow-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all border-2 border-rose-400 ${
                feedbackEffect === "ADD_SCRAP"
                  ? "ring-8 ring-rose-400/50 scale-105"
                  : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-7 h-7" />
                <span>+1 DEFECT / SCRAP</span>
              </div>
              <span className="text-xs font-mono font-normal opacity-90">
                Touch to log non-conformance
              </span>
            </button>

            {/* 3. Pause / Resume */}
            <button
              onClick={() => handleAction("TOGGLE_STATE")}
              disabled={clocking}
              className="min-h-[110px] rounded-3xl bg-surface-2 hover:bg-surface-3 active:scale-95 text-white font-black text-lg shadow-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all border-2 border-border"
            >
              <div className="flex items-center gap-2">
                {kiosk.state === "RUNNING" ? (
                  <Pause className="w-7 h-7 text-amber-400" />
                ) : (
                  <Play className="w-7 h-7 text-emerald-400" />
                )}
                <span>
                  {kiosk.state === "RUNNING" ? "PAUSE JOB" : "RESUME JOB"}
                </span>
              </div>
              <span className="text-xs font-mono font-normal text-text-3">
                Shift or tool change hold
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
