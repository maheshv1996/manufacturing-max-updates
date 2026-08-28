"use client";

import { useState, useEffect } from "react";
import {
  Workflow,
  CheckCircle2,
  Zap,
  Radio,
  Sliders,
  Volume2,
  Wrench,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface FlowNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  color: string;
  status: string;
}

interface FlowWire {
  from: string;
  to: string;
}

interface AutomationFlow {
  id: string;
  name: string;
  description: string;
  status: string;
  lastTriggered: string;
  nodes: FlowNode[];
  wires: FlowWire[];
}

export default function FlowsClient() {
  const [flows, setFlows] = useState<AutomationFlow[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string>("");
  const [stats, setStats] = useState({
    totalFlows: 0,
    activeEngines: 0,
    messagesProcessed24h: 0,
    actionsExecuted24h: 0,
  });
  const [_loading, setLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployMessage, setDeployMessage] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/automation/flows");
      if (res.ok) {
        const data = await res.json();
        setFlows(data.flows || []);
        setStats(
          data.stats || {
            totalFlows: 0,
            activeEngines: 0,
            messagesProcessed24h: 0,
            actionsExecuted24h: 0,
          },
        );
        if (!selectedFlowId && data.flows?.length > 0) {
          setSelectedFlowId(data.flows[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch flows", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const activeFlow = flows.find((f) => f.id === selectedFlowId) || flows[0];

  const handleDeploy = async () => {
    setDeploying(true);
    setDeployMessage(null);
    try {
      const res = await fetch("/api/automation/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DEPLOY", flowId: selectedFlowId }),
      });
      if (res.ok) {
        const data = await res.json();
        setDeployMessage(data.message || "Flow deployed successfully");
        setTimeout(() => setDeployMessage(null), 3000);
      }
    } catch (err) {
      console.error("Deploy error", err);
    } finally {
      setDeploying(false);
    }
  };

  const handleTestTrigger = async (value: number) => {
    setIsSimulating(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/automation/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flowId: selectedFlowId,
          testPayload: { value, timestamp: new Date().toISOString() },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTestResult(data);
      }
    } catch (err) {
      console.error("Test error", err);
    } finally {
      setTimeout(() => setIsSimulating(false), 2000);
    }
  };

  const getNodeIcon = (type: string) => {
    if (type.startsWith("INPUT"))
      return <Radio className="w-4 h-4 text-cyan-400" />;
    if (type.startsWith("FILTER"))
      return <Sliders className="w-4 h-4 text-amber-400" />;
    if (type.includes("CHIME"))
      return <Volume2 className="w-4 h-4 text-purple-400" />;
    if (type.includes("MAINTENANCE"))
      return <Wrench className="w-4 h-4 text-rose-400" />;
    if (type.includes("QUALITY"))
      return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
    return <Zap className="w-4 h-4 text-accent" />;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Visual Flow Automation Studio (Node-RED Engine)"
        description="Wire together IIoT triggers, threshold conditions, and native MES actions: Maintenance dispatch, Quality NCRs, and Audio chimes."
      >
        <div className="flex items-center gap-3">
          <button
            onClick={handleDeploy}
            disabled={deploying}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5" />
            {deploying ? "Deploying..." : "Deploy Active Flows"}
          </button>
        </div>
      </PageHeader>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Active Flow Engines
          </span>
          <div className="text-2xl font-black font-mono text-cyan-400 mt-1">
            {stats.activeEngines} Running
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Edge Node-RED Daemon
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Messages Processed
          </span>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
            {stats.messagesProcessed24h.toLocaleString()}
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Last 24 hours ingress
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Automated Actions
          </span>
          <div className="text-2xl font-black font-mono text-amber-400 mt-1">
            {stats.actionsExecuted24h} Dispatched
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Maintenance & QC triggers
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Engine Latency
          </span>
          <div className="text-2xl font-black font-mono text-text-1 mt-1">
            4.8 ms
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Edge rule execution time
          </div>
        </div>
      </div>

      {deployMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{deployMessage}</span>
        </div>
      )}

      {/* Main Flow Studio */}
      <div className="bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-6">
        {/* Flow Selector Bar & Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            {flows.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFlowId(f.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  selectedFlowId === f.id
                    ? "bg-accent text-white shadow-sm"
                    : "bg-surface-2 text-text-3 hover:text-text-1"
                }`}
              >
                <Workflow className="w-3.5 h-3.5" />
                <span>{f.name}</span>
              </button>
            ))}
          </div>

          {/* Test Trigger Buttons */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-text-3">
              Simulate Ingress:
            </span>
            <button
              onClick={() => handleTestTrigger(35.0)}
              className="px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border text-[11px] font-bold text-text-2 cursor-pointer transition-colors"
            >
              Normal (35.0)
            </button>
            <button
              onClick={() => handleTestTrigger(56.5)}
              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500 border border-rose-500/30 text-[11px] font-bold text-rose-300 hover:text-white cursor-pointer transition-colors"
            >
              Exceed Limit (56.5)
            </button>
          </div>
        </div>

        {/* Visual Node Canvas */}
        {activeFlow && (
          <div className="space-y-4">
            <div className="text-xs text-text-3">
              <span className="font-bold text-text-1">{activeFlow.name}</span>:{" "}
              {activeFlow.description}
            </div>

            {/* Interactive Visual Graph Canvas */}
            <div className="relative w-full h-[320px] bg-slate-950 border border-border/80 rounded-3xl p-6 overflow-hidden select-none">
              {/* Grid Background */}
              <div
                className="absolute inset-0 opacity-15"
                style={{
                  backgroundImage:
                    "radial-gradient(#94a3b8 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              />

              {/* Connecting SVG Wires */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {activeFlow.wires.map((wire, idx) => {
                  const fromNode = activeFlow.nodes.find(
                    (n) => n.id === wire.from,
                  );
                  const toNode = activeFlow.nodes.find((n) => n.id === wire.to);
                  if (!fromNode || !toNode) return null;

                  const startX = fromNode.x + 220;
                  const startY = fromNode.y + 24;
                  const endX = toNode.x;
                  const endY = toNode.y + 24;
                  const controlX1 = startX + (endX - startX) / 2;
                  const controlY1 = startY;
                  const controlX2 = startX + (endX - startX) / 2;
                  const controlY2 = endY;

                  const d = `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`;

                  return (
                    <path
                      key={idx}
                      d={d}
                      fill="none"
                      stroke={isSimulating ? "#22d3ee" : "#475569"}
                      strokeWidth={isSimulating ? "3" : "2"}
                      strokeDasharray={isSimulating ? "6 6" : "none"}
                      className={isSimulating ? "animate-pulse" : ""}
                    />
                  );
                })}
              </svg>

              {/* Render Nodes */}
              {activeFlow.nodes.map((node) => (
                <div
                  key={node.id}
                  style={{ left: `${node.x}px`, top: `${node.y}px` }}
                  className="absolute w-[220px] bg-surface-1 border border-border/90 rounded-2xl p-3 shadow-xl space-y-1.5 transition-all hover:border-accent z-10"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getNodeIcon(node.type)}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-text-3 font-mono">
                        {node.type.replace(/_/g, " ")}
                      </span>
                    </div>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        node.status === "CONNECTED" || node.status === "ARMED"
                          ? "bg-emerald-400"
                          : "bg-amber-400"
                      }`}
                    />
                  </div>

                  <div className="font-bold text-xs text-text-1 truncate">
                    {node.label}
                  </div>

                  <div className="flex items-center justify-between text-[9px] font-mono text-text-3 pt-1 border-t border-border/40">
                    <span>ID: {node.id}</span>
                    <span className="text-emerald-400 font-semibold">
                      {node.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Test Results Output Banner */}
            {testResult && (
              <div
                className={`p-4 rounded-2xl border text-xs space-y-1 ${
                  testResult.result === "ACTION_TRIGGERED"
                    ? "bg-rose-950/30 border-rose-500/40 text-rose-200"
                    : "bg-surface-2 border-border text-text-2"
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-2 font-mono">
                    <Terminal className="w-4 h-4 text-accent" />
                    Flow Simulation Result: {testResult.result}
                  </span>
                  <span className="font-mono text-[10px] opacity-75">
                    Latency: {testResult.latencyMs} ms
                  </span>
                </div>

                {testResult.executedActions?.length > 0 && (
                  <div className="pt-1 text-[11px] font-mono text-emerald-300">
                    Dispatched Actions: {testResult.executedActions.join(", ")}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
