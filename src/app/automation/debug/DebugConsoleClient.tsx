"use client";

import { useState, useEffect } from "react";
import {
  Terminal,
  Radio,
  Download,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface DebugEvent {
  id: string;
  flowName: string;
  trigger: string;
  topic: string;
  payload: Record<string, any>;
  condition: string;
  actionTaken: string;
  actionDetails: string;
  status: string;
  latencyMs: number;
  timestamp: string;
}

export default function DebugConsoleClient() {
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [stats, setStats] = useState({
    totalEventsToday: 0,
    actionsTriggeredToday: 0,
    avgLatencyMs: 0,
  });
  const [isLive, setIsLive] = useState(true);
  const [_loading, setLoading] = useState(true);
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>(
    {},
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/automation/debug");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        setStats(
          data.stats || {
            totalEventsToday: 0,
            actionsTriggeredToday: 0,
            avgLatencyMs: 0,
          },
        );
      }
    } catch (err) {
      console.error("Failed to load debug events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      fetchData();
    }, 2000);
    return () => clearInterval(interval);
  }, [isLive]);

  const toggleExpand = (id: string) => {
    setExpandedEvents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyPayload = (id: string, payload: any) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportEventsJson = () => {
    const jsonStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(events, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", jsonStr);
    link.setAttribute(
      "download",
      `NodeRED_Debug_Events_${new Date().toISOString().slice(0, 10)}.json`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Node-RED Real-Time Debug Wire & Event Engine"
        description="Streaming telemetry evaluation logs, threshold triggers, action dispatch records, and sub-millisecond execution latencies."
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
            {isLive ? "Live Stream (2s)" : "Paused"}
          </button>
          <button
            onClick={exportEventsJson}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text-2 hover:text-text-1 text-xs font-semibold transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Export JSON
          </button>
        </div>
      </PageHeader>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Events Ingested Today
          </span>
          <div className="text-2xl font-black font-mono text-cyan-400 mt-1">
            {stats.totalEventsToday.toLocaleString()}
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Telemetry packets evaluated
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Actions Triggered
          </span>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
            {stats.actionsTriggeredToday} Dispatched
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Rules matched & executed
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Avg Latency
          </span>
          <div className="text-2xl font-black font-mono text-amber-400 mt-1">
            {stats.avgLatencyMs} ms
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Sub-5ms edge response
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Engine State
          </span>
          <div className="text-2xl font-black font-mono text-emerald-300 mt-1 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>LISTENING</span>
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Node-RED Wire Engine
          </div>
        </div>
      </div>

      {/* Live Event Stream Terminal */}
      <div className="bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-2 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            Real-Time Wire Event Feed
          </h3>
          <span className="text-[11px] font-mono text-text-3">
            {events.length} Events In Buffer
          </span>
        </div>

        <div className="space-y-3">
          {events.map((evt) => {
            const isExpanded = !!expandedEvents[evt.id];

            return (
              <div
                key={evt.id}
                className="bg-surface-2/60 border border-border/80 rounded-2xl p-4 space-y-3 transition-colors hover:border-accent/40"
              >
                {/* Event Header */}
                <div
                  onClick={() => toggleExpand(evt.id)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-accent" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-text-3" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                          {evt.id}
                        </span>
                        <span className="font-bold text-xs text-text-1">
                          {evt.flowName}
                        </span>
                      </div>
                      <div className="text-[11px] text-text-3 font-mono mt-0.5">
                        {evt.trigger}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-xs shrink-0">
                    <span className="text-emerald-400 font-bold">
                      {evt.latencyMs} ms
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                      {evt.status}
                    </span>
                    <span className="text-text-3 text-[11px]">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Condition & Action Summary Bar */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono pt-1 border-t border-border/40">
                  <div className="p-2.5 rounded-xl bg-surface-1 border border-border/60">
                    <span className="text-[10px] text-amber-400 font-bold block uppercase">
                      Evaluated Rule
                    </span>
                    <span className="text-text-2">{evt.condition}</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-surface-1 border border-border/60">
                    <span className="text-[10px] text-emerald-400 font-bold block uppercase">
                      Action Executed
                    </span>
                    <span className="text-text-1 font-bold">
                      {evt.actionDetails}
                    </span>
                  </div>
                </div>

                {/* Expanded Payload Viewer */}
                {isExpanded && (
                  <div className="pt-2 space-y-1.5 border-t border-border/40 font-mono text-xs">
                    <div className="flex items-center justify-between text-[11px] text-text-3">
                      <span>msg.payload Inspector:</span>
                      <button
                        onClick={() => copyPayload(evt.id, evt.payload)}
                        className="flex items-center gap-1 text-accent hover:underline cursor-pointer"
                      >
                        {copiedId === evt.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        Copy Payload
                      </button>
                    </div>

                    <div className="bg-slate-950 border border-border/60 rounded-xl p-3 text-emerald-300 overflow-x-auto">
                      <pre className="text-xs">
                        {JSON.stringify(
                          {
                            _msgid: evt.id,
                            topic: evt.topic,
                            payload: evt.payload,
                            action: evt.actionTaken,
                            timestamp: evt.timestamp,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
