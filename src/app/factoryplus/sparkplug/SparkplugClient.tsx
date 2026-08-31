"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import { Radio, Cpu, RefreshCw, Zap, Terminal } from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface MetricItem {
  name: string;
  alias: number;
  type: string;
  value: any;
  isHistorical: boolean;
}

interface SparkplugDevice {
  deviceId: string;
  deviceName: string;
  sparkplugAddress: string;
  status: "ONLINE" | "STANDBY" | "OFFLINE";
  sequenceNumber: number;
  lastBirthTime: string;
  lastDataTime: string;
  metrics: MetricItem[];
}

interface SparkplugPacket {
  id: string;
  topic: string;
  msgType: string;
  seq: number;
  metricsCount: number;
  deltaMetrics: string[];
  compressionSavingPct: number;
  timestamp: string;
}

export default function SparkplugClient() {
  const [devices, setDevices] = useState<SparkplugDevice[]>([]);
  const [recentPackets, setRecentPackets] = useState<SparkplugPacket[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<SparkplugDevice | null>(
    null,
  );
  const [stats, setStats] = useState({
    totalDevices: 0,
    onlineDevices: 0,
    reportByExceptionSavingsPct: 0,
    packetsProcessed24h: 0,
  });
  const [isLive, setIsLive] = useState(true);
  const [_loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/factoryplus/sparkplug");
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
        setRecentPackets(data.recentPackets || []);
        setStats(
          data.stats || {
            totalDevices: 0,
            onlineDevices: 0,
            reportByExceptionSavingsPct: 0,
            packetsProcessed24h: 0,
          },
        );
        if (!selectedDevice && data.devices?.length > 0) {
          setSelectedDevice(data.devices[0]);
        }
      }
    } catch (err) {
      logClientError("Failed to load Sparkplug B data:", err, "SparkplugClient");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      fetchData();
    }, 2500);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);

  const handlePublishDbirth = async (deviceId: string) => {
    try {
      const res = await fetch("/api/factoryplus/sparkplug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DBIRTH", deviceId }),
      });
      if (res.ok) {
        const data = await res.json();
        setActionMsg(data.message || "DBIRTH published");
        setTimeout(() => setActionMsg(null), 3000);
        await fetchData();
      }
    } catch (err) {
      logClientError("DBIRTH error:", err, "SparkplugClient");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="MQTT Sparkplug B Node & Device Manager"
        description="AMRC Factory+ Report-by-Exception protocol: DBIRTH/DDEATH certificates, metric alias compression, and sequence integrity tracking."
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
            {isLive ? "Sparkplug Live (2.5s)" : "Paused"}
          </button>
          <button
            onClick={fetchData}
            className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text-2 hover:text-text-1 cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </PageHeader>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Sparkplug Devices
          </span>
          <div className="text-2xl font-black font-mono text-cyan-400 mt-1">
            {stats.onlineDevices} / {stats.totalDevices} Online
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Edge Node: Cell-01-Gateway
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Bandwidth Saved
          </span>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
            {stats.reportByExceptionSavingsPct}%
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Report-by-Exception vs Polling
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Packets Processed
          </span>
          <div className="text-2xl font-black font-mono text-amber-400 mt-1">
            {stats.packetsProcessed24h.toLocaleString()}
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            24h Sparkplug B stream
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Namespace Spec
          </span>
          <div className="text-2xl font-black font-mono text-text-1 mt-1">
            spBv1.0
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Eclipse Sparkplug B Compliant
          </div>
        </div>
      </div>

      {actionMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* Main Split Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Devices Column (6 cols) */}
        <div className="lg:col-span-6 bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-2 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-accent" />
              Registered Sparkplug B Devices
            </h3>
            <span className="text-[11px] font-mono text-text-3">
              Group: ApexAerospace
            </span>
          </div>

          <div className="space-y-3">
            {devices.map((d) => {
              const isSelected = selectedDevice?.deviceId === d.deviceId;

              return (
                <div
                  key={d.deviceId}
                  onClick={() => setSelectedDevice(d)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                    isSelected
                      ? "bg-surface-2 border-accent ring-2 ring-accent/20"
                      : "bg-surface-2/60 border-border/80 hover:border-accent/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-surface-1 border border-border text-cyan-400">
                        <Cpu className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-text-1">
                          {d.deviceId} — {d.deviceName}
                        </h4>
                        <span className="text-[10px] text-text-3 font-mono">
                          {d.sparkplugAddress}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                          d.status === "ONLINE"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {d.status}
                      </span>
                      <div className="text-[9px] font-mono text-text-3 mt-1">
                        seq: {d.sequenceNumber}
                      </div>
                    </div>
                  </div>

                  {/* Metric Aliases Pill Bar */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/40 text-[10px] font-mono text-text-3">
                    {d.metrics.slice(0, 4).map((m) => (
                      <span
                        key={m.name}
                        className="px-2 py-0.5 rounded bg-surface-1 border border-border text-text-2"
                      >
                        {m.name}:{" "}
                        <span className="text-cyan-300 font-bold">
                          {String(m.value)}
                        </span>
                      </span>
                    ))}
                    {d.metrics.length > 4 && (
                      <span className="px-1.5 py-0.5 rounded bg-surface-1 text-[9px]">
                        +{d.metrics.length - 4} more
                      </span>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/30">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePublishDbirth(d.deviceId);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-surface-3 hover:bg-surface-1 border border-border text-[11px] font-bold text-text-2 hover:text-text-1 cursor-pointer transition-colors"
                    >
                      Re-Publish DBIRTH
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Packets Stream Column (6 cols) */}
        <div className="lg:col-span-6 bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-2 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              Live Sparkplug B Ingress Stream
            </h3>
            <span className="text-[11px] font-mono text-text-3">
              {recentPackets.length} In Buffer
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {recentPackets.map((pkt) => (
              <div
                key={pkt.id}
                className="bg-surface-2/60 border border-border/80 rounded-2xl p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        pkt.msgType === "DBIRTH" || pkt.msgType === "NBIRTH"
                          ? "bg-purple-500/20 text-purple-300"
                          : "bg-cyan-500/20 text-cyan-300"
                      }`}
                    >
                      {pkt.msgType}
                    </span>
                    <span className="text-[11px] font-bold text-text-1 truncate max-w-[220px]">
                      {pkt.topic}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-text-3">
                    <span>seq: {pkt.seq}</span>
                    <span>{new Date(pkt.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-border/60 text-text-2 text-[11px] space-y-1">
                  <div className="text-[10px] text-text-3">
                    Delta Metrics ({pkt.metricsCount}):
                  </div>
                  <div className="text-emerald-300 font-bold">
                    {pkt.deltaMetrics.join(" · ")}
                  </div>
                </div>

                {pkt.compressionSavingPct > 0 && (
                  <div className="text-[10px] text-emerald-400 text-right">
                    Bandwidth Savings: {pkt.compressionSavingPct}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
