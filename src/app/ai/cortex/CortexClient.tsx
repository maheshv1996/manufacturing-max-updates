"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  Sparkles,
  Zap,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  TrendingUp,
  Cpu,
  Layers,
  ArrowRight,
  RefreshCw,
  Play,
  Volume2,
  VolumeX,
  Boxes,
  Wrench,
  ShieldCheck,
  DollarSign,
  HeartPulse,
  Users,
  Gauge,
  Terminal,
  Truck,
  AlertTriangle,
} from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";
import { soundFx } from "@/lib/soundFx";
import { toast } from "@/lib/toastStore";

const ICON_MAP: Record<string, any> = {
  Wrench,
  Boxes,
  ShieldCheck,
  Zap,
  Layers,
  TrendingUp,
  DollarSign,
  HeartPulse,
  Users,
  Gauge,
  Terminal,
  Truck,
};

interface Agent {
  id: string;
  name: string;
  role: string;
  department?: string;
  description: string;
  status: string;
  avatarIcon: string;
  model: string;
}

interface Conflict {
  id: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  departmentsInvolved: string[];
  description: string;
  options: {
    label: string;
    description: string;
    impactOee: string;
    impactCost: string;
    impactDelivery: string;
    agentRecommendation?: boolean;
    reasoning: string;
  }[];
}

interface CortexData {
  activeAgentsCount: number;
  systemHealth: string;
  neuralLoad: string;
  agents: Agent[];
  conflicts: Conflict[];
  onlineMachinesCount: number;
  totalMachinesCount: number;
  activeWorkOrdersCount: number;
  totalUsersCount: number;
}

export default function CortexClient({ initialData }: { initialData: CortexData }) {
  const [data] = useState<CortexData>(initialData);
  const [selectedConflict, setSelectedConflict] = useState<Conflict>(initialData.conflicts[0]);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number>(0);
  const [resolving, setResolving] = useState<boolean>(false);
  const [resolutionResult, setResolutionResult] = useState<any | null>(null);

  // Simulation Sliders State
  const [addMachines, setAddMachines] = useState<number>(1);
  const [addShifts, setAddShifts] = useState<number>(1);
  const [rawMaterialPriceHike, setRawMaterialPriceHike] = useState<number>(5);
  const [nightTariffShiftHours, setNightTariffShiftHours] = useState<number>(4);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);

  // Audio Voice State
  const [speaking, setSpeaking] = useState<boolean>(false);

  const handleResolveConflict = async () => {
    setResolving(true);
    soundFx.playClick();
    toast.info("Master Brain dispatching cross-agent commands...");

    try {
      const res = await fetch("/api/ai/cortex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve_conflict",
          payload: {
            conflictId: selectedConflict.id,
            optionIndex: selectedOptionIdx,
          },
        }),
      });
      const json = await res.json();
      if (json.status === "ok") {
        setResolutionResult(json.resolution);
        toast.success("Conflict autonomously resolved!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to execute resolution.");
    } finally {
      setResolving(false);
    }
  };

  const handleRunSimulation = async () => {
    setSimulating(true);
    soundFx.playClick();

    try {
      const res = await fetch("/api/ai/cortex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "simulate_what_if",
          payload: {
            addMachines,
            addShifts,
            rawMaterialPriceHikePct: rawMaterialPriceHike,
            nightTariffShiftHours,
          },
        }),
      });
      const json = await res.json();
      if (json.status === "ok") {
        setSimulationResult(json.simulation);
        toast.success("Simulation model converged!");
      }
    } catch (err: any) {
      toast.error(err.message || "Simulation failed.");
    } finally {
      setSimulating(false);
    }
  };

  const toggleSpeech = () => {
    if ("speechSynthesis" in window) {
      if (speaking) {
        window.speechSynthesis.cancel();
        setSpeaking(false);
      } else {
        const text = `Master Brain Executive Briefing. System status is optimal across all 12 autonomous agent nodes. 87.4 percent plant OEE active. High priority conflict: ${selectedConflict.title}. Recommended action: ${selectedConflict.options[0].label}.`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.pitch = 0.95;
        utterance.onend = () => setSpeaking(false);
        window.speechSynthesis.speak(utterance);
        setSpeaking(true);
      }
    } else {
      toast.info("Web Speech Synthesis not supported in this environment.");
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      <PageHeader
        title="Master Brain AI Cortex"
        description="Autonomous factory orchestration layer: cross-department conflict resolution, multi-agent swarm synchronization, and predictive 'What-If' simulation."
        icon={<Brain className="w-7 h-7" />}
        iconTone="indigo"
        badge={{ label: "Factory COO / Orchestrator Online", tone: "indigo" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSpeech}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              speaking
                ? "bg-indigo-500 text-white border-indigo-400 animate-pulse shadow-lg shadow-indigo-500/30"
                : "bg-surface-2 text-text-2 hover:text-text-1 border-border/80 hover:bg-surface-3"
            }`}
          >
            {speaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span>{speaking ? "Stop Audio" : "Voice Executive Briefing"}</span>
          </button>
        </div>
      </PageHeader>

      {/* Top Telemetry Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-1 p-5 rounded-3xl border border-border/80 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/15 text-indigo-400 rounded-2xl">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] text-text-3 font-mono font-bold uppercase tracking-wider">Active Swarm</div>
            <div className="text-xl font-black text-text-1">{data.activeAgentsCount} Agents Online</div>
          </div>
        </div>

        <div className="bg-surface-1 p-5 rounded-3xl border border-border/80 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/15 text-emerald-400 rounded-2xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] text-text-3 font-mono font-bold uppercase tracking-wider">Factory OEE</div>
            <div className="text-xl font-black text-emerald-400">87.4% (Optimal)</div>
          </div>
        </div>

        <div className="bg-surface-1 p-5 rounded-3xl border border-border/80 flex items-center gap-4">
          <div className="p-3 bg-cyan-500/15 text-cyan-400 rounded-2xl">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] text-text-3 font-mono font-bold uppercase tracking-wider">Active Machines</div>
            <div className="text-xl font-black text-text-1">{data.onlineMachinesCount} / {data.totalMachinesCount} Running</div>
          </div>
        </div>

        <div className="bg-surface-1 p-5 rounded-3xl border border-border/80 flex items-center gap-4">
          <div className="p-3 bg-amber-500/15 text-amber-400 rounded-2xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] text-text-3 font-mono font-bold uppercase tracking-wider">Cross-Dept Conflicts</div>
            <div className="text-xl font-black text-amber-400">{data.conflicts.length} Pending</div>
          </div>
        </div>
      </div>

      {/* SECTION 1: Cross-Department Conflict Resolution Console */}
      <div className="bg-surface-1 rounded-3xl border border-border/80 p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/15 text-amber-400 rounded-2xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-text-1">Cross-Department Conflict Resolution Console</h2>
              <p className="text-xs text-text-3">The Master Brain resolves operational gridlocks between Sales, Production, Supply Chain, and Maintenance.</p>
            </div>
          </div>
          <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
            Autonomous Mediation
          </span>
        </div>

        {/* Conflict Selector Pills */}
        <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
          {data.conflicts.map((conflict) => (
            <button
              key={conflict.id}
              onClick={() => {
                setSelectedConflict(conflict);
                setSelectedOptionIdx(0);
                setResolutionResult(null);
                soundFx.playClick();
              }}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all text-left border shrink-0 ${
                selectedConflict.id === conflict.id
                  ? "bg-amber-500/20 text-amber-200 border-amber-500/40 shadow-sm"
                  : "bg-surface-2 text-text-3 hover:text-text-1 border-border/60 hover:bg-surface-3"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="truncate max-w-[280px]">{conflict.title}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Selected Conflict Card & Option Matrix */}
        <div className="bg-surface-2 rounded-2xl p-5 border border-border/80 space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-accent">
              <span>Departments Involved:</span>
              <span className="text-text-2 font-bold">{selectedConflict.departmentsInvolved.join(" · ")}</span>
            </div>
            <p className="text-sm text-text-2 leading-relaxed">{selectedConflict.description}</p>
          </div>

          {/* Decision Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            {selectedConflict.options.map((opt, idx) => {
              const isSelected = selectedOptionIdx === idx;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedOptionIdx(idx)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "bg-surface-3 border-indigo-500/70 ring-1 ring-indigo-500/30 shadow-lg shadow-indigo-500/10"
                      : "bg-surface-1 hover:bg-surface-3 border-border/60"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-text-1">{opt.label}</span>
                      {opt.agentRecommendation && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                          AI Choice
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-3 leading-relaxed">{opt.description}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/60 space-y-1 text-[11px] font-mono">
                    <div className="flex justify-between text-text-3">
                      <span>OEE Impact:</span>
                      <span className="font-bold text-emerald-400">{opt.impactOee}</span>
                    </div>
                    <div className="flex justify-between text-text-3">
                      <span>Cost Delta:</span>
                      <span className="font-bold text-amber-300">{opt.impactCost}</span>
                    </div>
                    <div className="flex justify-between text-text-3">
                      <span>Delivery:</span>
                      <span className="font-bold text-cyan-300 truncate max-w-[120px]">{opt.impactDelivery}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-text-3">
              Selected Decision: <strong className="text-text-1">{selectedConflict.options[selectedOptionIdx]?.label}</strong>
            </span>
            <button
              onClick={handleResolveConflict}
              disabled={resolving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {resolving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>Execute Master Brain Dispatch</span>
            </button>
          </div>

          {/* Resolution Outcome Box */}
          {resolutionResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-200 space-y-3"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Autonomous Resolution Executed Successfully</span>
              </div>
              <p className="text-xs leading-relaxed text-emerald-100">{resolutionResult.outcome}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-emerald-500/20 text-[11px] font-mono">
                {resolutionResult.telemetryDispatches.map((td: any, i: number) => (
                  <div key={i} className="p-2 bg-emerald-900/20 rounded-xl border border-emerald-500/20">
                    <div className="font-bold text-emerald-300">{td.agent}:</div>
                    <div className="text-emerald-100/80 text-[10px]">{td.action}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* SECTION 2: 6-Month "What-If" Factory Simulator */}
      <div className="bg-surface-1 rounded-3xl border border-border/80 p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/15 text-cyan-400 rounded-2xl">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-text-1">Interactive "What-If" Factory Simulator</h2>
              <p className="text-xs text-text-3">Simulate adding CNC machining cells, extra shifts, or shifting peak power tariffs to model your next 6 months of profit.</p>
            </div>
          </div>
          <button
            onClick={handleRunSimulation}
            disabled={simulating}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer transition-all"
          >
            {simulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>Run Simulation</span>
          </button>
        </div>

        {/* Simulation Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2 bg-surface-2 p-4 rounded-2xl border border-border/60">
            <div className="flex justify-between text-xs font-bold text-text-2">
              <span>Add CNC Machines:</span>
              <span className="font-mono text-cyan-400">+{addMachines} Machines</span>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              step="1"
              value={addMachines}
              onChange={(e) => setAddMachines(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <p className="text-[10px] text-text-3">Each 5-axis cell adds ~18% factory throughput.</p>
          </div>

          <div className="space-y-2 bg-surface-2 p-4 rounded-2xl border border-border/60">
            <div className="flex justify-between text-xs font-bold text-text-2">
              <span>Add Production Shifts:</span>
              <span className="font-mono text-indigo-400">+{addShifts} Shift(s)</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="1"
              value={addShifts}
              onChange={(e) => setAddShifts(Number(e.target.value))}
              className="w-full accent-indigo-400 cursor-pointer"
            />
            <p className="text-[10px] text-text-3">Activates overnight Shift 3 dark operations.</p>
          </div>

          <div className="space-y-2 bg-surface-2 p-4 rounded-2xl border border-border/60">
            <div className="flex justify-between text-xs font-bold text-text-2">
              <span>Titanium / Alloy Price:</span>
              <span className="font-mono text-amber-400">+{rawMaterialPriceHike}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="25"
              step="5"
              value={rawMaterialPriceHike}
              onChange={(e) => setRawMaterialPriceHike(Number(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer"
            />
            <p className="text-[10px] text-text-3">Simulates raw alloy inflation / LME spike.</p>
          </div>

          <div className="space-y-2 bg-surface-2 p-4 rounded-2xl border border-border/60">
            <div className="flex justify-between text-xs font-bold text-text-2">
              <span>Night Tariff Shift:</span>
              <span className="font-mono text-emerald-400">{nightTariffShiftHours} Hours/Day</span>
            </div>
            <input
              type="range"
              min="0"
              max="8"
              step="1"
              value={nightTariffShiftHours}
              onChange={(e) => setNightTariffShiftHours(Number(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer"
            />
            <p className="text-[10px] text-text-3">Shifts heavy roughing cuts to off-peak tariff.</p>
          </div>
        </div>

        {/* Forecast Output Cards */}
        {simulationResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 rounded-2xl bg-surface-2 border border-cyan-500/30 space-y-4"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-surface-3 rounded-xl border border-border/60">
                <div className="text-[10px] text-text-3 font-mono">Simulated Revenue</div>
                <div className="text-lg font-black text-cyan-300">
                  ${simulationResult.forecast.monthlyRevenue.toLocaleString()} / mo
                </div>
              </div>

              <div className="p-3 bg-surface-3 rounded-xl border border-border/60">
                <div className="text-[10px] text-text-3 font-mono">Net Monthly Profit</div>
                <div className="text-lg font-black text-emerald-400">
                  ${simulationResult.forecast.monthlyProfit.toLocaleString()} / mo
                </div>
              </div>

              <div className="p-3 bg-surface-3 rounded-xl border border-border/60">
                <div className="text-[10px] text-text-3 font-mono">Profit Lift (Delta)</div>
                <div className="text-lg font-black text-indigo-300">
                  +${simulationResult.forecast.profitDelta.toLocaleString()} / mo
                </div>
              </div>

              <div className="p-3 bg-surface-3 rounded-xl border border-border/60">
                <div className="text-[10px] text-text-3 font-mono">Projected OEE</div>
                <div className="text-lg font-black text-accent">
                  {simulationResult.forecast.projectedOee}
                </div>
              </div>
            </div>

            {/* Strategic Insights */}
            <div className="space-y-1.5 pt-2 border-t border-border/60">
              <span className="text-xs font-bold text-text-2">Master Brain Strategic Insights:</span>
              {simulationResult.strategicInsights.map((insight: string, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs text-text-3">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>{insight}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* SECTION 3: Multi-Agent Neural Swarm Grid (12 Agents) */}
      <div className="bg-surface-1 rounded-3xl border border-border/80 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/15 text-indigo-400 rounded-2xl">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-text-1">Active Multi-Agent Neural Swarm</h2>
              <p className="text-xs text-text-3">Real-time status of all 12 specialized domain agents synchronized with the Master Brain.</p>
            </div>
          </div>
          <a
            href="/ai/agents"
            className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
          >
            <span>Open Agent Dispatcher</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {data.agents.map((agent) => {
            const Icon = ICON_MAP[agent.avatarIcon] || Cpu;
            return (
              <div
                key={agent.id}
                className="p-4 rounded-2xl bg-surface-2 border border-border/60 hover:border-indigo-500/40 transition-all flex items-start gap-3"
              >
                <div className="p-2.5 bg-surface-3 rounded-xl text-indigo-300 shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-xs text-text-1 truncate">{agent.name}</h3>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <p className="text-[10px] text-accent font-mono truncate">{agent.role}</p>
                  <p className="text-[10px] text-text-3 font-mono">{agent.model.split(" ")[0]} Active</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
