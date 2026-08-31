"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  Cpu,
  Zap,
  ShieldAlert,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface DigitalIO {
  tag: string;
  name: string;
  location: string;
  state: boolean;
  desc: string;
}

interface AnalogIO {
  tag: string;
  name: string;
  signal: string;
  value: number;
  unit: string;
  range: string;
}

interface LadderRung {
  rungNo: number;
  title: string;
  expression: string;
  state: "ENERGIZED" | "DE-ENERGIZED";
}

export default function CommissioningClient() {
  const [plcState, setPlcState] = useState("RUN_MODE");
  const [scanTime, setScanTime] = useState(1.2);
  const [digitalInputs, setDigitalInputs] = useState<DigitalIO[]>([]);
  const [digitalOutputs, setDigitalOutputs] = useState<DigitalIO[]>([]);
  const [analogInputs, setAnalogInputs] = useState<AnalogIO[]>([]);
  const [ladderRungs, setLadderRungs] = useState<LadderRung[]>([]);
  const [_loading, setLoading] = useState(true);
  const [togglingTag, setTogglingTag] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/digital-twin/commissioning");
      if (res.ok) {
        const data = await res.json();
        setPlcState(data.plcState || "RUN_MODE");
        setScanTime(data.scanCycleTimeMs || 1.2);
        setDigitalInputs(data.io?.digitalInputs || []);
        setDigitalOutputs(data.io?.digitalOutputs || []);
        setAnalogInputs(data.io?.analogInputs || []);
        setLadderRungs(data.ladderRungs || []);
      }
    } catch (err) {
      logClientError("Failed to load PLC commissioning data:", err, "CommissioningClient");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleInput = async (tag: string, currentState: boolean) => {
    setTogglingTag(tag);
    try {
      const res = await fetch("/api/digital-twin/commissioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag, state: !currentState }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      logClientError("Toggle error:", err, "CommissioningClient");
    } finally {
      setTogglingTag(null);
    }
  };

  const isAlarmState = digitalOutputs.find((o) => o.tag === "DO_05")?.state;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Virtual Commissioning & PLC Logic Simulator"
        description="Hardware-in-the-loop simulation: Digital Inputs (DI), Actuator Outputs (DO), Analog Transducers, and Live Ladder Rung evaluation."
      >
        <button
          onClick={fetchData}
          className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text-2 hover:text-text-1 cursor-pointer transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </PageHeader>

      {/* PLC Controller Status Bar */}
      <div className="bg-surface-1 border border-border rounded-3xl p-5 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-2xl">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs text-cyan-300">
                Siemens S7-1500 / Codesys V3 SoftPLC
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] font-mono">
                {plcState}
              </span>
            </div>
            <h2 className="text-base font-bold text-text-1 mt-0.5">
              Cell Automation Controller Core
            </h2>
            <div className="text-xs text-text-3 font-mono mt-0.5">
              Cycle Scan Time:{" "}
              <span className="text-emerald-400 font-bold">{scanTime} ms</span>{" "}
              · OPC-UA Node Bridge Active
            </div>
          </div>
        </div>

        {/* Safety Interlock Status */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span
            className={`px-3 py-1.5 rounded-xl font-bold border flex items-center gap-2 ${
              isAlarmState
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            {isAlarmState
              ? "SAFETY INTERLOCK TRIPPED"
              : "ALL SAFETY LOOPS HEALTHY"}
          </span>
        </div>
      </div>

      {/* 3-Column Split Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Digital Inputs DI (4 cols) */}
        <div className="lg:col-span-4 bg-surface-1 border border-border rounded-3xl p-5 shadow-sm space-y-4">
          <div className="border-b border-border pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-2 flex items-center gap-2">
              <ToggleLeft className="w-4 h-4 text-cyan-400" />
              Digital Inputs (Sensors & Switches)
            </h3>
            <p className="text-[11px] text-text-3 mt-0.5">
              Toggle switches to test PLC reaction.
            </p>
          </div>

          <div className="space-y-2.5">
            {digitalInputs.map((di) => (
              <div
                key={di.tag}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                  di.state
                    ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                    : "bg-surface-2 border-border text-text-3"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-cyan-300">
                      {di.tag}
                    </span>
                    <span className="font-bold text-xs text-text-1">
                      {di.name}
                    </span>
                  </div>
                  <div className="text-[10px] text-text-3 font-mono mt-0.5">
                    {di.location}
                  </div>
                </div>

                <button
                  onClick={() => handleToggleInput(di.tag, di.state)}
                  disabled={togglingTag === di.tag}
                  className={`px-3 py-1 rounded-xl text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                    di.state
                      ? "bg-emerald-500 text-white shadow-md"
                      : "bg-surface-3 text-text-3 hover:text-text-1"
                  }`}
                >
                  {di.state ? "ON (24V)" : "OFF (0V)"}
                </button>
              </div>
            ))}
          </div>

          {/* Analog Inputs Transducers */}
          <div className="pt-3 border-t border-border space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-3 block">
              Analog Transducers (AI)
            </span>
            {analogInputs.map((ai) => (
              <div
                key={ai.tag}
                className="p-2.5 rounded-xl bg-surface-2 border border-border/80 flex items-center justify-between text-xs font-mono"
              >
                <div>
                  <span className="font-bold text-text-1">{ai.name}</span>
                  <span className="text-[10px] text-text-3 block">
                    {ai.signal} · {ai.range}
                  </span>
                </div>
                <div className="text-right font-bold text-amber-400">
                  {ai.value} {ai.unit}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Middle Column: Live PLC Ladder Logic (4 cols) */}
        <div className="lg:col-span-4 bg-surface-1 border border-border rounded-3xl p-5 shadow-sm space-y-4">
          <div className="border-b border-border pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Live Virtual Ladder Rungs
            </h3>
            <p className="text-[11px] text-text-3 mt-0.5">
              IEC 61131-3 Boolean logic execution.
            </p>
          </div>

          <div className="space-y-4 font-mono text-xs">
            {ladderRungs.map((rung) => {
              const isEnergized = rung.state === "ENERGIZED";

              return (
                <div
                  key={rung.rungNo}
                  className={`p-4 rounded-2xl border transition-all space-y-2 ${
                    isEnergized
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
                      : "bg-surface-2 border-border text-text-3 opacity-75"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text-1">
                      Rung #{rung.rungNo}: {rung.title}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        isEnergized
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-surface-3 text-text-3"
                      }`}
                    >
                      {rung.state}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950 border border-border/60 text-xs text-cyan-300 overflow-x-auto">
                    {rung.expression}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Digital Outputs DO (4 cols) */}
        <div className="lg:col-span-4 bg-surface-1 border border-border rounded-3xl p-5 shadow-sm space-y-4">
          <div className="border-b border-border pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-2 flex items-center gap-2">
              <ToggleRight className="w-4 h-4 text-emerald-400" />
              Actuator Digital Outputs (DO)
            </h3>
            <p className="text-[11px] text-text-3 mt-0.5">
              Real-time actuator solenoid states.
            </p>
          </div>

          <div className="space-y-2.5">
            {digitalOutputs.map((doItem) => (
              <div
                key={doItem.tag}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                  doItem.state
                    ? doItem.tag.includes("Alarm")
                      ? "bg-rose-950/30 border-rose-500/40 text-rose-200"
                      : "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                    : "bg-surface-2 border-border text-text-3"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-emerald-400">
                      {doItem.tag}
                    </span>
                    <span className="font-bold text-xs text-text-1">
                      {doItem.name}
                    </span>
                  </div>
                  <div className="text-[10px] text-text-3 font-mono mt-0.5">
                    {doItem.location}
                  </div>
                </div>

                <span
                  className={`px-3 py-1 rounded-xl text-[11px] font-mono font-bold ${
                    doItem.state
                      ? doItem.tag.includes("Alarm")
                        ? "bg-rose-600 text-white animate-pulse"
                        : "bg-emerald-500 text-white"
                      : "bg-surface-3 text-text-3"
                  }`}
                >
                  {doItem.state ? "ENERGIZED" : "DE-ENERGIZED"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
