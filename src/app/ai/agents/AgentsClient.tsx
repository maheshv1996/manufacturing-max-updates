"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Bot,
  Play,
  Wrench,
  Boxes,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Clock,
  Terminal,
  Layers,
  Sparkles,
  TrendingUp,
  DollarSign,
  HeartPulse,
  Users,
  Gauge,
  Truck,
  Filter,
} from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";
import { soundFx } from "@/lib/soundFx";
import { toast } from "@/lib/toastStore";

interface Agent {
  id: string;
  name: string;
  role: string;
  department?: string;
  description: string;
  status: string;
  avatarIcon: string;
  model: string;
  tools: string[];
  sampleMissions: string[];
}

interface Step {
  stepIndex: number;
  thought: string;
  tool: string;
  toolInput: Record<string, any>;
  observation: string;
  status: "success" | "warning" | "error";
  latencyMs: number;
}

interface MissionResult {
  missionId: string;
  agentId: string;
  agentName: string;
  goal: string;
  status: string;
  totalDurationMs: number;
  steps: Step[];
  finalOutcome: string;
  kpisAffected: { label: string; value: string; change: string }[];
}

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

export default function AgentsClient({
  initialAgents,
}: {
  initialAgents: Agent[];
}) {
  const [agents] = useState<Agent[]>(initialAgents);
  const [selectedAgent, setSelectedAgent] = useState<Agent>(initialAgents[0]);
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [customGoal, setCustomGoal] = useState<string>("");
  const [running, setRunning] = useState<boolean>(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);
  const [missionResult, setMissionResult] = useState<MissionResult | null>(
    null,
  );

  const handleLaunchMission = async (goalToRun?: string) => {
    const goal = goalToRun || customGoal || selectedAgent.sampleMissions[0];
    setRunning(true);
    setMissionResult(null);
    setActiveStepIndex(0);
    soundFx.playClick();
    toast.info(`Deploying ${selectedAgent.name}...`);

    try {
      const res = await fetch("/api/ai/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          goal,
        }),
      });

      const data = await res.json();
      if (data.status === "ok" && data.mission) {
        // Animate through steps sequentially
        const steps: Step[] = data.mission.steps;
        for (let i = 0; i < steps.length; i++) {
          setActiveStepIndex(i);
          soundFx.playClick();
          await new Promise((resolve) => setTimeout(resolve, 600));
        }

        setActiveStepIndex(steps.length);
        setMissionResult(data.mission);
        soundFx.playSuccess();
        toast.success(
          `Mission ${data.mission.missionId} Completed Autonomously!`,
        );
      } else {
        toast.error("Agent execution failed to respond.");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error executing agent mission.");
    } finally {
      setRunning(false);
    }
  };

  const SelectedIcon = ICON_MAP[selectedAgent.avatarIcon] || Bot;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <PageHeader
        title="Autonomous Industrial Multi-Agent Hub"
        description="Deploy goal-driven specialized AI agents with direct tool access across telemetry, ERP inventory, CMM quality, and power meters."
        icon={<Bot className="w-6 h-6" />}
        iconTone="cyan"
        badge={{ label: "Autonomous Swarm Active", tone: "cyan" }}
      />

      {/* Department Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <span className="text-xs text-text-3 font-mono font-bold flex items-center gap-1.5 mr-2">
          <Filter className="w-3.5 h-3.5" /> Filter:
        </span>
        {["ALL", "Production", "Quality", "Supply Chain", "Maintenance", "Engineering", "Finance", "Sales & Engineering", "EHS & Safety", "HR & People", "Metrology & Tooling", "EHS & Utilities"].map((dept) => {
          const isCurrent = selectedDept === dept;
          const count = dept === "ALL" ? agents.length : agents.filter(a => a.department === dept).length;
          if (dept !== "ALL" && count === 0) return null;
          return (
            <button
              key={dept}
              onClick={() => {
                setSelectedDept(dept);
                soundFx.playClick();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                isCurrent
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "bg-surface-2 text-text-3 hover:text-text-1 border border-border/60 hover:bg-surface-3"
              }`}
            >
              <span>{dept === "ALL" ? "All 12 Agents" : dept}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isCurrent ? "bg-cyan-500/30 text-cyan-200" : "bg-surface-3 text-text-3"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Agents Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {agents
          .filter(a => selectedDept === "ALL" || a.department === selectedDept)
          .map((agent) => {
          const Icon = ICON_MAP[agent.avatarIcon] || Bot;
          const isSelected = selectedAgent.id === agent.id;

          return (
            <motion.button
              key={agent.id}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setSelectedAgent(agent);
                setCustomGoal("");
                soundFx.playClick();
              }}
              className={`p-5 rounded-3xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? "bg-surface-2 border-cyan-500/60 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-500/30"
                  : "bg-surface-1 hover:bg-surface-2 border-border/80"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div
                    className={`p-2.5 rounded-2xl ${
                      isSelected
                        ? "bg-cyan-500/20 text-cyan-300"
                        : "bg-surface-3 text-text-3"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">
                    {agent.status}
                  </span>
                </div>

                <div>
                  <h3 className="font-extrabold text-sm text-text-1">
                    {agent.name}
                  </h3>
                  <p className="text-[11px] text-accent font-mono font-bold">
                    {agent.role}
                  </p>
                </div>

                <p className="text-xs text-text-3 line-clamp-2 leading-relaxed">
                  {agent.description}
                </p>
              </div>

              <div className="pt-4 mt-3 border-t border-border/60 flex items-center justify-between text-[10px] font-mono text-text-3">
                <span>{agent.tools.length} Tools</span>
                <span className="text-cyan-400 font-bold">
                  {isSelected ? "● Selected" : "Click to deploy"}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Main Agent Workspace: Mission Control & Step Execution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Mission Dispatch & Tool Capabilities (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Mission Dispatch Console */}
          <div className="p-6 rounded-3xl bg-surface-1 border border-border space-y-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-cyan-500/15 text-cyan-400">
                <SelectedIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-text-1">
                  {selectedAgent.name}
                </h3>
                <span className="text-[11px] text-text-3 font-mono">
                  Powered by {selectedAgent.model}
                </span>
              </div>
            </div>

            {/* Preconfigured sample missions */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-text-3">
                Pre-Engineered Factory Missions:
              </span>
              <div className="space-y-2">
                {selectedAgent.sampleMissions.map((sample, idx) => (
                  <button
                    key={idx}
                    disabled={running}
                    onClick={() => {
                      setCustomGoal(sample);
                      handleLaunchMission(sample);
                    }}
                    className="w-full text-left p-3 rounded-2xl bg-surface-2 hover:bg-surface-3 border border-border/70 text-xs text-text-2 hover:text-text-1 transition-all cursor-pointer group flex items-center justify-between disabled:opacity-50"
                  >
                    <span className="line-clamp-1">{sample}</span>
                    <Play className="w-3.5 h-3.5 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Mission Input */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-text-3">
                Or Define Custom Goal:
              </span>
              <textarea
                rows={3}
                disabled={running}
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
                placeholder="E.g. Run pre-emptive vibration sweep and restock critical tool inserts..."
                className="w-full p-3 rounded-2xl bg-surface-2 border border-border text-xs text-text-1 placeholder:text-text-3 focus:outline-none focus:border-cyan-500/50 resize-none font-mono"
              />

              <button
                disabled={running}
                onClick={() => handleLaunchMission()}
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-xs shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all cursor-pointer disabled:opacity-60"
              >
                {running ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Agent Reasoning & Calling Tools…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-cyan-200" />
                    <span>Execute Autonomous Mission</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Equipped Tools Registry */}
          <div className="p-6 rounded-3xl bg-surface-1 border border-border space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-text-1">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Equipped Function Calling Tools</span>
            </div>

            <div className="space-y-2">
              {selectedAgent.tools.map((tool, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-surface-2/60 border border-border/70 text-xs font-mono"
                >
                  <span className="text-cyan-300 font-bold">{tool}()</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    Enabled
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Real-Time Execution Trace Timeline (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 rounded-3xl bg-slate-950 border border-cyan-500/30 min-h-[560px] flex flex-col justify-between shadow-2xl">
            <div className="space-y-6">
              {/* Terminal Titlebar */}
              <div className="flex items-center justify-between pb-4 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                    Agentic Thought & Tool Execution Trace
                  </span>
                </div>
                {missionResult && (
                  <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/30">
                    Mission ID: {missionResult.missionId} (
                    {missionResult.totalDurationMs}ms)
                  </span>
                )}
              </div>

              {/* No active mission placeholder */}
              {!running && !missionResult && (
                <div className="py-24 text-center space-y-3">
                  <div className="w-14 h-14 rounded-3xl bg-surface-2 border border-border flex items-center justify-center mx-auto text-cyan-400">
                    <Bot className="w-7 h-7" />
                  </div>
                  <h4 className="font-extrabold text-sm text-white">
                    Agent Waiting for Mission Dispatch
                  </h4>
                  <p className="text-xs text-text-3 max-w-sm mx-auto leading-relaxed">
                    Select an autonomous agent from the top cards and launch a
                    mission to observe real-time multi-step tool calls and
                    industrial actions.
                  </p>
                </div>
              )}

              {/* Execution Steps Trace */}
              {(running || missionResult) && (
                <div className="space-y-4">
                  {(missionResult?.steps || [1, 2, 3, 4]).map(
                    (stepItem: any, idx: number) => {
                      const isVisible = activeStepIndex >= idx;
                      if (!isVisible && running) return null;

                      const isStepObject = typeof stepItem === "object";
                      const thought = isStepObject
                        ? stepItem.thought
                        : "Agent reasoning on sensory telemetry...";
                      const tool = isStepObject
                        ? stepItem.tool
                        : "executing_tool";
                      const observation = isStepObject
                        ? stepItem.observation
                        : "Waiting for tool output...";
                      const latency = isStepObject ? stepItem.latencyMs : 120;

                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                          className="p-4 rounded-2xl bg-surface-1/90 border border-border/80 space-y-2.5 font-mono text-xs shadow-md"
                        >
                          {/* Step Header */}
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-[10px]">
                                {idx + 1}
                              </span>
                              <span className="text-text-3 uppercase font-bold">
                                THOUGHT & PLAN
                              </span>
                            </div>
                            <span className="text-text-3 text-[10px] flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {latency}ms
                            </span>
                          </div>

                          {/* Thought content */}
                          <p className="text-text-2 text-xs italic leading-relaxed pl-7">
                            {thought}
                          </p>

                          {/* Tool Invocation Box */}
                          <div className="ml-7 p-3 rounded-xl bg-slate-900 border border-cyan-500/30 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-cyan-400 font-bold">
                                🛠️ Tool: {tool}()
                              </span>
                              <span className="text-emerald-400 text-[10px]">
                                OK
                              </span>
                            </div>
                            {isStepObject && stepItem.toolInput && (
                              <pre className="text-[10px] text-text-3 overflow-x-auto">
                                {JSON.stringify(stepItem.toolInput, null, 2)}
                              </pre>
                            )}
                            <div className="text-[11px] text-text-1 pt-1 border-t border-border/50">
                              <span className="text-text-3">Observation: </span>
                              {observation}
                            </div>
                          </div>
                        </motion.div>
                      );
                    },
                  )}
                </div>
              )}

              {/* Final Mission Outcome Banner */}
              {missionResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="p-5 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 space-y-4"
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-sm text-emerald-200">
                        Goal Accomplished Autonomously
                      </h4>
                      <p className="text-xs text-emerald-100/90 leading-relaxed font-sans">
                        {missionResult.finalOutcome}
                      </p>
                    </div>
                  </div>

                  {/* Impacted KPIs */}
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-emerald-500/30">
                    {missionResult.kpisAffected.map((kpi, kIdx) => (
                      <div key={kIdx} className="text-center font-mono">
                        <span className="text-[9px] uppercase text-emerald-300/70 block">
                          {kpi.label}
                        </span>
                        <span className="text-sm font-black text-white">
                          {kpi.value}
                        </span>
                        <span className="text-[10px] text-emerald-400 block font-bold">
                          {kpi.change}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-text-3">
              <span>Agentic Runtime: Active</span>
              <span>Industrial Tool Sandbox: Secured</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
