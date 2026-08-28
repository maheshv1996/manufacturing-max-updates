"use client";

import { useState, useEffect } from "react";
import {
  Server,
  Cpu,
  Radio,
  Send,
  Terminal,
  RefreshCw,
  Layers,
  CheckCircle2,
  HardDrive,
} from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface GatewayDiagnostics {
  gatewayId: string;
  containerVersion: string;
  streamingEngine: string;
  localBroker: string;
  mqttBrokerPort: number;
  opcBridgeUrl: string;
  status: string;
  uptimeSeconds: number;
  cpuUsagePct: number;
  memoryUsageMb: number;
  ingressMsgPerSec: number;
  egressKbPerSec: number;
  activeClientConnections: number;
  recentPackets: {
    topic: string;
    bytes: number;
    latencyMs: number;
    status: string;
    time: string;
  }[];
}

export default function GatewayClient() {
  const [gateway, setGateway] = useState<GatewayDiagnostics | null>(null);
  const [_machines, setMachines] = useState<any[]>([]);
  const [_loading, setLoading] = useState(true);
  const [testTopic, setTestTopic] = useState("Apex/Plant-1/CNC-01/vibration");
  const [testValue, setTestValue] = useState("2.4");
  const [injecting, setInjecting] = useState(false);
  const [responseMsg, setResponseMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/iot/gateway");
      if (res.ok) {
        const data = await res.json();
        setGateway(data.gateway || null);
        setMachines(data.machines || []);
      }
    } catch (err) {
      console.error("Failed to load gateway data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInject = async (e: React.FormEvent) => {
    e.preventDefault();
    setInjecting(true);
    setResponseMsg(null);
    try {
      const res = await fetch("/api/iot/gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: testTopic,
          payload: {
            value: parseFloat(testValue) || testValue,
            timestamp: new Date().toISOString(),
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResponseMsg(data.message || "Published successfully");
        await fetchData();
      }
    } catch (err) {
      console.error("Injection error:", err);
    } finally {
      setInjecting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="MQTT / OPC-UA Edge Gateway & Ingestion Bridge"
        description="United Manufacturing Hub (UMH) Core Docker daemon: Benthos streaming pipelines, local Redpanda buffer, and PLC connectors."
      >
        <button
          onClick={fetchData}
          className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text-2 hover:text-text-1 cursor-pointer transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </PageHeader>

      {/* Top Diagnostics KPI Cards */}
      {gateway && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-text-3">
              Edge Gateway
            </span>
            <div className="text-2xl font-black font-mono text-emerald-400 mt-1 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{gateway.status}</span>
            </div>
            <div className="text-[11px] text-text-3 mt-0.5 font-mono">
              {gateway.gatewayId}
            </div>
          </div>

          <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-text-3">
              Ingress Stream Rate
            </span>
            <div className="text-2xl font-black font-mono text-cyan-400 mt-1">
              {gateway.ingressMsgPerSec.toLocaleString()}{" "}
              <span className="text-xs text-text-3">msg/s</span>
            </div>
            <div className="text-[11px] text-text-3 mt-0.5">
              {gateway.egressKbPerSec} KB/s egress throughput
            </div>
          </div>

          <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-text-3">
              Engine Resource Load
            </span>
            <div className="text-2xl font-black font-mono text-purple-400 mt-1">
              {gateway.cpuUsagePct}% CPU
            </div>
            <div className="text-[11px] text-text-3 mt-0.5 font-mono">
              {gateway.memoryUsageMb} MB RAM Used
            </div>
          </div>

          <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-text-3">
              Connected PLCs / CNCs
            </span>
            <div className="text-2xl font-black font-mono text-text-1 mt-1">
              {gateway.activeClientConnections} Clients
            </div>
            <div className="text-[11px] text-text-3 mt-0.5">
              Port {gateway.mqttBrokerPort} (MQTT) & OPC-UA
            </div>
          </div>
        </div>
      )}

      {/* UMH Pipeline Architecture Visualizer */}
      <div className="bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-text-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-accent" />
          Live Ingestion Pipeline Architecture (UMH Core)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          {/* Step 1: PLCs & CNCs */}
          <div className="p-4 rounded-2xl bg-surface-2 border border-border space-y-1.5 text-center">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mx-auto">
              <Cpu className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-xs text-text-1">
              1. Shopfloor Controllers
            </h4>
            <p className="text-[11px] text-text-3">
              Fanuc, Siemens S7, Modbus TCP, Beckhoff
            </p>
          </div>

          {/* Step 2: OPC-UA & MQTT Bridge */}
          <div className="p-4 rounded-2xl bg-surface-2 border border-border space-y-1.5 text-center">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center mx-auto">
              <Radio className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-xs text-text-1">
              2. Edge Connectors
            </h4>
            <p className="text-[11px] text-text-3">
              opc.tcp (Port 4840) & MQTT (Port 1883)
            </p>
          </div>

          {/* Step 3: UMH Benthos Stream Engine */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/20 to-surface-2 border border-emerald-500/30 space-y-1.5 text-center">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <Server className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-xs text-text-1">
              3. Benthos UMH Engine
            </h4>
            <p className="text-[11px] text-text-3">
              Data Flow Components (DFC) & Local Buffer
            </p>
          </div>

          {/* Step 4: MES Database */}
          <div className="p-4 rounded-2xl bg-surface-2 border border-border space-y-1.5 text-center">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center mx-auto">
              <HardDrive className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-xs text-text-1">
              4. MES Telemetry DB
            </h4>
            <p className="text-[11px] text-text-3">
              PostgreSQL Time-Series & Anomaly Alerts
            </p>
          </div>
        </div>
      </div>

      {/* Split: Live Ingress Packets Terminal & MQTT Payload Injector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Terminal Log (7 cols) */}
        <div className="lg:col-span-7 bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-2 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              Live Edge Ingress Packets Log
            </h3>
            <span className="text-[11px] font-mono text-text-3">
              Benthos DFC Active
            </span>
          </div>

          <div className="bg-slate-950 border border-border/80 rounded-2xl p-4 space-y-2 font-mono text-xs overflow-x-auto max-h-[300px]">
            {gateway?.recentPackets.map((pkt, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-slate-300 py-1 border-b border-slate-900 last:border-none"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-text-3 text-[10px]">{pkt.time}</span>
                  <span className="text-cyan-300 font-bold truncate">
                    {pkt.topic}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-[11px]">
                  <span className="text-text-3">{pkt.bytes}B</span>
                  <span className="text-emerald-400">{pkt.latencyMs}ms</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                    {pkt.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Payload Injector (5 cols) */}
        <div className="lg:col-span-5 bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-4">
          <div className="border-b border-border pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-2 flex items-center gap-2">
              <Send className="w-4 h-4 text-accent" />
              MQTT Test Ingestion Injector
            </h3>
            <p className="text-[11px] text-text-3 mt-0.5">
              Publish test telemetry payloads to the edge broker.
            </p>
          </div>

          <form onSubmit={handleInject} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-text-3 mb-1">
                Target MQTT Topic
              </label>
              <input
                type="text"
                value={testTopic}
                onChange={(e) => setTestTopic(e.target.value)}
                required
                className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2 text-xs font-mono text-text-1 focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-text-3 mb-1">
                Simulated Value
              </label>
              <input
                type="text"
                value={testValue}
                onChange={(e) => setTestValue(e.target.value)}
                required
                placeholder="e.g. 2.4 mm/s vibration"
                className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2 text-xs font-mono text-text-1 focus:outline-none focus:border-accent"
              />
            </div>

            <button
              type="submit"
              disabled={injecting}
              className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              {injecting ? "Publishing..." : "Publish MQTT Payload"}
            </button>

            {responseMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-mono">{responseMsg}</span>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
