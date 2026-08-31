"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  FolderTree,
  Search,
  ChevronDown,
  ChevronRight,
  Radio,
  Cpu,
  Boxes,
  Copy,
  Check,
  RefreshCw,
  Terminal,
  Zap,
} from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface UnsTopic {
  topic: string;
  key: string;
  value: any;
  unit?: string;
  dataType: string;
  quality: string;
  timestamp: string;
}

interface UnsNode {
  machineId: string;
  machineCode: string;
  machineName: string;
  lineName: string;
  status: string;
  basePath: string;
  topics: UnsTopic[];
}

export default function UnsExplorerClient() {
  const [unsNodes, setUnsNodes] = useState<UnsNode[]>([]);
  const [enterprise, setEnterprise] = useState("Apex-Manufacturing-Enterprise");
  const [plant, setPlant] = useState("Bengaluru-Aerospace-Plant-1");
  const [totalTopics, setTotalTopics] = useState(0);
  const [_loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<UnsTopic | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<UnsNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    root: true,
    plant: true,
  });
  const [copied, setCopied] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/iot/uns");
      if (res.ok) {
        const data = await res.json();
        setUnsNodes(data.unsNodes || []);
        setEnterprise(data.enterprise || "Apex-Manufacturing-Enterprise");
        setPlant(data.plant || "Bengaluru-Aerospace-Plant-1");
        setTotalTopics(data.totalActiveTopics || 0);

        if (!selectedTopic && data.unsNodes?.[0]?.topics?.[0]) {
          setSelectedMachine(data.unsNodes[0]);
          setSelectedTopic(data.unsNodes[0].topics[0]);
        }
      }
    } catch (err) {
      logClientError("Failed to fetch UNS data:", err, "UnsExplorerClient");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time polling when live mode is active
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      fetchData();
    }, 2500);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, selectedTopic]);

  const toggleExpand = (key: string) => {
    setExpandedNodes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredNodes = unsNodes.filter((node) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      node.machineCode.toLowerCase().includes(q) ||
      node.machineName.toLowerCase().includes(q) ||
      node.lineName.toLowerCase().includes(q) ||
      node.topics.some(
        (t) =>
          t.topic.toLowerCase().includes(q) || t.key.toLowerCase().includes(q),
      )
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="ISA-95 Unified Namespace (UNS) Live Explorer"
        description="Standardized Industrial IoT semantic topic hierarchy: Enterprise, Site, Area, Line, Machine telemetry, and process values."
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
            {isLive ? "Live Stream (2.5s)" : "Paused"}
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
            Edge Workcells
          </span>
          <div className="text-2xl font-black font-mono text-cyan-400 mt-1">
            {unsNodes.length} Nodes
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            CNC & Metrology controllers
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Active UNS Topics
          </span>
          <div className="text-2xl font-black font-mono text-text-1 mt-1">
            {totalTopics} Topics
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Live MQTT payload endpoints
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Ingress Stream Rate
          </span>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1 flex items-center gap-1.5">
            <span>1,420</span>
            <span className="text-xs font-normal text-emerald-300">msg/s</span>
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            UMH Benthos Stream Engine
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Payload Quality
          </span>
          <div className="text-2xl font-black font-mono text-emerald-300 mt-1">
            100% GOOD (192)
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            OPC-UA DA standard compliant
          </div>
        </div>
      </div>

      {/* Main Split-Pane Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Tree Explorer (5 cols) */}
        <div className="lg:col-span-5 bg-surface-1 border border-border rounded-3xl p-5 shadow-sm space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter topics (e.g. spindleRpm, CNC-01)..."
              className="w-full bg-surface-2 border border-border rounded-xl pl-9 pr-3.5 py-2 text-xs text-text-1 placeholder-text-3 focus:outline-none focus:border-accent"
            />
          </div>

          {/* Tree View Structure */}
          <div className="space-y-2 overflow-y-auto max-h-[600px] pr-1 font-mono text-xs select-none">
            {/* Enterprise Node */}
            <div className="space-y-1">
              <div
                onClick={() => toggleExpand("root")}
                className="flex items-center gap-1.5 py-1.5 px-2 rounded-lg hover:bg-surface-2 cursor-pointer font-bold text-text-1"
              >
                {expandedNodes.root ? (
                  <ChevronDown className="w-4 h-4 text-accent" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <FolderTree className="w-4 h-4 text-cyan-400" />
                <span>{enterprise}</span>
              </div>

              {/* Plant Node */}
              {expandedNodes.root && (
                <div className="pl-4 space-y-1">
                  <div
                    onClick={() => toggleExpand("plant")}
                    className="flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-surface-2 cursor-pointer font-semibold text-text-2"
                  >
                    {expandedNodes.plant ? (
                      <ChevronDown className="w-3.5 h-3.5 text-accent" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    <Boxes className="w-3.5 h-3.5 text-amber-400" />
                    <span>{plant}</span>
                  </div>

                  {/* Machine Nodes */}
                  {expandedNodes.plant && (
                    <div className="pl-4 space-y-1">
                      {filteredNodes.map((node) => {
                        const isExpanded = !!expandedNodes[node.machineId];
                        const isSelectedMachine =
                          selectedMachine?.machineId === node.machineId;

                        return (
                          <div key={node.machineId} className="space-y-1">
                            <div
                              onClick={() => {
                                toggleExpand(node.machineId);
                                setSelectedMachine(node);
                              }}
                              className={`flex items-center justify-between py-1 px-2 rounded-lg hover:bg-surface-2 cursor-pointer transition-colors ${
                                isSelectedMachine
                                  ? "bg-surface-2/80 text-accent font-bold"
                                  : "text-text-2"
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5" />
                                )}
                                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                                <span>{node.machineCode}</span>
                              </div>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-sans ${
                                  node.status === "RUNNING"
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : "bg-amber-500/20 text-amber-300"
                                }`}
                              >
                                {node.status}
                              </span>
                            </div>

                            {/* Topic Leaf Nodes */}
                            {isExpanded && (
                              <div className="pl-4 space-y-0.5 border-l border-border/40 ml-2">
                                {node.topics.map((top) => {
                                  const isSelectedTopic =
                                    selectedTopic?.topic === top.topic;

                                  return (
                                    <div
                                      key={top.topic}
                                      onClick={() => {
                                        setSelectedMachine(node);
                                        setSelectedTopic(top);
                                      }}
                                      className={`flex items-center justify-between py-1 px-2 rounded-md hover:bg-surface-3 cursor-pointer text-[11px] transition-colors ${
                                        isSelectedTopic
                                          ? "bg-accent/20 text-cyan-300 font-bold border-l-2 border-accent"
                                          : "text-text-3 hover:text-text-2"
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 truncate">
                                        <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                                        <span className="truncate">
                                          {top.key}
                                        </span>
                                      </div>
                                      <span className="font-semibold text-text-1 ml-2 shrink-0">
                                        {typeof top.value === "object"
                                          ? "{...}"
                                          : String(top.value)}
                                        {top.unit ? ` ${top.unit}` : ""}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Topic Payload Inspector (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {selectedTopic ? (
            <div className="bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-5">
              <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold border border-cyan-500/30">
                      {selectedTopic.dataType}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold border border-emerald-500/30">
                      {selectedTopic.quality}
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold text-text-1 mt-2 font-mono break-all">
                    {selectedTopic.key}
                  </h3>
                  <div className="text-xs text-text-3 font-mono mt-1 flex items-center gap-2">
                    <span className="truncate">{selectedTopic.topic}</span>
                    <button
                      onClick={() => copyToClipboard(selectedTopic.topic)}
                      className="p-1 hover:bg-surface-2 rounded text-text-3 hover:text-text-1 cursor-pointer"
                      title="Copy full MQTT topic"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-right font-mono shrink-0">
                  <span className="text-[10px] uppercase tracking-wider text-text-3 block">
                    Live Value
                  </span>
                  <div className="text-2xl font-black text-emerald-400 mt-0.5">
                    {typeof selectedTopic.value === "object"
                      ? "JSON Object"
                      : String(selectedTopic.value)}
                    {selectedTopic.unit ? ` ${selectedTopic.unit}` : ""}
                  </div>
                </div>
              </div>

              {/* Metadata Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-surface-2 border border-border space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-text-3">
                    Workcell Node
                  </span>
                  <div className="font-bold font-mono text-text-1">
                    {selectedMachine?.machineCode}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-surface-2 border border-border space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-text-3">
                    Production Line
                  </span>
                  <div className="font-bold text-text-1 truncate">
                    {selectedMachine?.lineName}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-surface-2 border border-border space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-text-3">
                    Last Ingested
                  </span>
                  <div className="font-mono text-text-2 text-[11px]">
                    {new Date(selectedTopic.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              {/* Live JSON Payload Viewer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-text-3">
                  <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-accent" />
                    MQTT Sparkplug / Benthos Payload
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(JSON.stringify(selectedTopic, null, 2))
                    }
                    className="text-[11px] text-accent hover:underline cursor-pointer"
                  >
                    Copy JSON
                  </button>
                </div>

                <div className="bg-slate-950 border border-border/80 rounded-2xl p-4 overflow-x-auto">
                  <pre className="font-mono text-xs text-emerald-300">
                    {JSON.stringify(
                      {
                        topic: selectedTopic.topic,
                        timestamp: selectedTopic.timestamp,
                        metrics: [
                          {
                            name: selectedTopic.key,
                            value: selectedTopic.value,
                            unit: selectedTopic.unit || null,
                            type: selectedTopic.dataType,
                            status: selectedTopic.quality,
                          },
                        ],
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-surface-1 border border-border rounded-3xl p-12 text-center text-xs text-text-3 space-y-2">
              <p>
                Select any node or topic in the ISA-95 Tree to inspect its
                real-time payload.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
