"use client";

import { useState, useEffect } from "react";
import { Boxes, Cpu, Radio, RefreshCw, RotateCw } from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface CellTwinData {
  cellId: string;
  cellName: string;
  machine: {
    id: string;
    code: string;
    name: string;
    status: string;
    lineName: string;
  };
  workOrder: {
    woNumber: string;
    productName: string;
    sku: string;
    plannedQty: number;
    goodQty: number;
    cycleTimeSec: number;
  };
  telemetry: {
    spindleRpm: number;
    spindleLoadPct: number;
    feedRateMmMin: number;
    vibrationMmSec: number;
    coolantPressureBar: number;
    spindleTempC: number;
  };
  components: {
    id: string;
    name: string;
    state: string;
    pos: number[];
  }[];
}

export default function CellTwinClient() {
  const [machines, setMachines] = useState<any[]>([]);
  const [selectedMachine, setSelectedMachine] = useState("CNC-01");
  const [cellData, setCellData] = useState<CellTwinData | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [_loading, setLoading] = useState(true);
  const [cameraView, setCameraView] = useState<"ISO" | "FRONT" | "TOP">("ISO");
  const [activeComponent, setActiveComponent] = useState<string | null>(
    "comp-spindle",
  );

  const fetchData = async (machineCode?: string) => {
    try {
      const target = machineCode || selectedMachine;
      const res = await fetch(
        `/api/digital-twin/cell?machine=${encodeURIComponent(target)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setMachines(data.machines || []);
        setCellData(data.cellData || null);
      }
    } catch (err) {
      console.error("Failed to load digital twin cell data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedMachine);
  }, [selectedMachine]);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      fetchData(selectedMachine);
    }, 2000);
    return () => clearInterval(interval);
  }, [isLive, selectedMachine]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="3D Digital Twin & Workcell Visualizer"
        description="Physics-based industrial cell simulation: Spindle dynamics, 6-axis robot handling, infeed conveyors, and real-time sensor telemetry HUD."
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
            {isLive ? "Twin Live Sync (2s)" : "Paused"}
          </button>
          <button
            onClick={() => fetchData(selectedMachine)}
            className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text-2 hover:text-text-1 cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </PageHeader>

      {/* Machine Selector Bar */}
      <div className="flex items-center justify-between gap-4 bg-surface-1 border border-border p-2 rounded-2xl overflow-x-auto">
        <div className="flex items-center gap-2">
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

        {/* Camera View Switcher */}
        <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl border border-border shrink-0">
          <button
            onClick={() => setCameraView("ISO")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              cameraView === "ISO"
                ? "bg-accent text-white"
                : "text-text-3 hover:text-text-1"
            }`}
          >
            Isometric 3D
          </button>
          <button
            onClick={() => setCameraView("FRONT")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              cameraView === "FRONT"
                ? "bg-accent text-white"
                : "text-text-3 hover:text-text-1"
            }`}
          >
            Front HUD
          </button>
          <button
            onClick={() => setCameraView("TOP")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              cameraView === "TOP"
                ? "bg-accent text-white"
                : "text-text-3 hover:text-text-1"
            }`}
          >
            2D Top Layout
          </button>
        </div>
      </div>

      {cellData && (
        <div className="space-y-6">
          {/* Main 3D Digital Twin Visual Stage */}
          <div className="relative w-full h-[460px] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-border rounded-3xl p-6 overflow-hidden select-none shadow-2xl">
            {/* 3D Grid Stage Ground Floor */}
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)",
                backgroundSize: "40px 40px",
                transform:
                  cameraView === "ISO"
                    ? "perspective(600px) rotateX(60deg) scale(1.4)"
                    : "none",
                transformOrigin: "center 75%",
              }}
            />

            {/* Live HUD Floating Overlays */}
            <div className="absolute top-6 left-6 z-20 space-y-2">
              <div className="bg-surface-1/90 backdrop-blur-md border border-border/80 rounded-2xl p-4 shadow-xl space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="font-bold text-xs text-text-1 font-mono">
                    {cellData.cellId}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                    {cellData.machine.status}
                  </span>
                </div>
                <h3 className="font-extrabold text-sm text-text-1">
                  {cellData.cellName}
                </h3>
                <div className="text-[11px] text-text-3 font-mono">
                  WO:{" "}
                  <span className="text-cyan-300 font-bold">
                    #{cellData.workOrder.woNumber}
                  </span>{" "}
                  ({cellData.workOrder.productName})
                </div>
              </div>
            </div>

            {/* Right Telemetry HUD Overlay */}
            <div className="absolute top-6 right-6 z-20 grid grid-cols-2 gap-2 max-w-xs">
              <div className="bg-surface-1/90 backdrop-blur-md border border-border/80 rounded-xl p-3 text-right">
                <span className="text-[10px] uppercase text-text-3 font-bold block">
                  Spindle Speed
                </span>
                <span className="text-base font-black font-mono text-cyan-400">
                  {cellData.telemetry.spindleRpm}
                </span>
                <span className="text-[10px] text-text-3 ml-1 font-mono">
                  RPM
                </span>
              </div>
              <div className="bg-surface-1/90 backdrop-blur-md border border-border/80 rounded-xl p-3 text-right">
                <span className="text-[10px] uppercase text-text-3 font-bold block">
                  Vibration RMS
                </span>
                <span className="text-base font-black font-mono text-amber-400">
                  {cellData.telemetry.vibrationMmSec}
                </span>
                <span className="text-[10px] text-text-3 ml-1 font-mono">
                  mm/s
                </span>
              </div>
              <div className="bg-surface-1/90 backdrop-blur-md border border-border/80 rounded-xl p-3 text-right">
                <span className="text-[10px] uppercase text-text-3 font-bold block">
                  Coolant Bar
                </span>
                <span className="text-base font-black font-mono text-blue-400">
                  {cellData.telemetry.coolantPressureBar}
                </span>
                <span className="text-[10px] text-text-3 ml-1 font-mono">
                  Bar
                </span>
              </div>
              <div className="bg-surface-1/90 backdrop-blur-md border border-border/80 rounded-xl p-3 text-right">
                <span className="text-[10px] uppercase text-text-3 font-bold block">
                  Bearing Temp
                </span>
                <span className="text-base font-black font-mono text-rose-400">
                  {cellData.telemetry.spindleTempC}
                </span>
                <span className="text-[10px] text-text-3 ml-1 font-mono">
                  °C
                </span>
              </div>
            </div>

            {/* Interactive 3D Workcell Entities */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
              <div className="relative w-[500px] h-[300px] flex items-center justify-center">
                {/* 1. CNC Machine Center Body */}
                <div
                  onClick={() => setActiveComponent("comp-spindle")}
                  className={`absolute w-56 h-56 rounded-3xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center shadow-2xl ${
                    activeComponent === "comp-spindle"
                      ? "bg-slate-900/90 border-cyan-400 ring-4 ring-cyan-500/20"
                      : "bg-slate-900/80 border-slate-700 hover:border-slate-500"
                  }`}
                  style={{
                    transform:
                      cameraView === "ISO" ? "translate(-60px, -20px)" : "none",
                  }}
                >
                  <div className="relative p-4 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-2">
                    <RotateCw
                      className={`w-8 h-8 ${cellData.machine.status === "RUNNING" ? "animate-spin" : ""}`}
                    />
                  </div>
                  <span className="text-xs font-black font-mono text-text-1">
                    BT-40 SPINDLE HEAD
                  </span>
                  <span className="text-[10px] text-cyan-300 font-mono font-bold mt-0.5">
                    {cellData.telemetry.spindleRpm} RPM ·{" "}
                    {cellData.telemetry.spindleLoadPct}% Load
                  </span>
                </div>

                {/* 2. Handling Robot Arm */}
                <div
                  onClick={() => setActiveComponent("comp-robot")}
                  className={`absolute w-36 h-44 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center shadow-xl ${
                    activeComponent === "comp-robot"
                      ? "bg-amber-950/40 border-amber-400 ring-4 ring-amber-500/20"
                      : "bg-slate-900/70 border-slate-700 hover:border-slate-500"
                  }`}
                  style={{
                    transform:
                      cameraView === "ISO"
                        ? "translate(130px, 30px)"
                        : "translate(140px, 0px)",
                  }}
                >
                  <Cpu className="w-6 h-6 text-amber-400 mb-1" />
                  <span className="text-[10px] font-black font-mono text-text-1 text-center">
                    FANUC ROBOT
                  </span>
                  <span className="text-[9px] text-amber-300 font-mono mt-0.5">
                    STANDBY
                  </span>
                </div>

                {/* 3. Infeed Conveyor */}
                <div
                  onClick={() => setActiveComponent("comp-infeed")}
                  className={`absolute w-44 h-16 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md ${
                    activeComponent === "comp-infeed"
                      ? "bg-blue-950/40 border-blue-400 ring-4 ring-blue-500/20"
                      : "bg-slate-900/70 border-slate-700 hover:border-slate-500"
                  }`}
                  style={{
                    transform:
                      cameraView === "ISO"
                        ? "translate(180px, -80px)"
                        : "translate(180px, -90px)",
                  }}
                >
                  <Boxes className="w-4 h-4 text-blue-400" />
                  <span className="text-[10px] font-bold font-mono text-text-1">
                    RAW INFEED CONVEYOR
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Progress Bar HUD */}
            <div className="absolute bottom-6 left-6 right-6 z-20 bg-surface-1/90 backdrop-blur-md border border-border/80 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div>
                  <span className="text-[10px] uppercase text-text-3 font-bold block">
                    Part Cycle Progress
                  </span>
                  <span className="text-xs font-bold text-text-1 font-mono">
                    {cellData.workOrder.goodQty} /{" "}
                    {cellData.workOrder.plannedQty} pcs (
                    {Math.round(
                      (cellData.workOrder.goodQty /
                        cellData.workOrder.plannedQty) *
                        100,
                    )}
                    %)
                  </span>
                </div>
                <div className="flex-1 bg-surface-3 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-accent h-full rounded-full transition-all"
                    style={{
                      width: `${(cellData.workOrder.goodQty / cellData.workOrder.plannedQty) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="font-mono text-xs text-text-3 shrink-0">
                Cycle Time:{" "}
                <span className="text-text-1 font-bold">
                  {cellData.workOrder.cycleTimeSec}s
                </span>
              </div>
            </div>
          </div>

          {/* Workcell Physical Components Table */}
          <div className="bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-3 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-accent" />
              Workcell Physical & Virtual Sub-Systems
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border text-text-3 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3">Component / Mechanism</th>
                    <th className="py-3">Sub-System Type</th>
                    <th className="py-3 text-center">Status</th>
                    <th className="py-3 text-right">
                      3D Coordinates (X, Y, Z)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {cellData.components.map((comp) => (
                    <tr
                      key={comp.id}
                      onClick={() => setActiveComponent(comp.id)}
                      className={`hover:bg-surface-2/40 transition-colors cursor-pointer ${
                        activeComponent === comp.id
                          ? "bg-surface-2/60 text-accent font-bold"
                          : ""
                      }`}
                    >
                      <td className="py-3 font-sans font-bold text-text-1">
                        {comp.name}
                      </td>
                      <td className="py-3 text-text-3 font-sans">
                        {comp.id.includes("spindle")
                          ? "CNC Spindle Drive"
                          : comp.id.includes("robot")
                            ? "6-Axis Handling Articulated"
                            : "Material Transfer"}
                      </td>
                      <td className="py-3 text-center font-sans">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                          {comp.state}
                        </span>
                      </td>
                      <td className="py-3 text-right text-text-2">
                        [{comp.pos.join(", ")}]
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
