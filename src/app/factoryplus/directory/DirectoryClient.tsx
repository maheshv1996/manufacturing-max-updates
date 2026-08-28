"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Cpu,
  Server,
  Copy,
  Check,
  RefreshCw,
  FileCode2,
} from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface DirectoryNode {
  nodeId: string;
  nodeUuid: string;
  hardware: string;
  ipAddress: string;
  os: string;
  status: string;
  firmware: string;
  devicesCount: number;
}

interface DirectoryDevice {
  deviceId: string;
  deviceUuid: string;
  name: string;
  type: string;
  parentNodeId: string;
  schemaUuid: string;
  schemaName: string;
  status: string;
  line: string;
  sparkplugAddress: string;
}

export default function DirectoryClient() {
  const [nodes, setNodes] = useState<DirectoryNode[]>([]);
  const [devices, setDevices] = useState<DirectoryDevice[]>([]);
  const [stats, setStats] = useState({
    totalRegisteredNodes: 0,
    totalRegisteredDevices: 0,
    activeSchemas: 0,
  });
  const [search, setSearch] = useState("");
  const [_loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/factoryplus/directory");
      if (res.ok) {
        const data = await res.json();
        setNodes(data.nodes || []);
        setDevices(data.devices || []);
        setStats(
          data.stats || {
            totalRegisteredNodes: 0,
            totalRegisteredDevices: 0,
            activeSchemas: 0,
          },
        );
      }
    } catch (err) {
      console.error("Failed to load directory data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredDevices = devices.filter(
    (d) =>
      d.deviceId.toLowerCase().includes(search.toLowerCase()) ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.schemaName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Factory+ Asset Directory & Device Catalog"
        description="Centralized UUID-indexed registry of Edge Gateways, CNC Machine Tools, CMM Metrology, and Sensors linked to standardized JSON schemas."
      >
        <button
          onClick={fetchData}
          className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text-2 hover:text-text-1 cursor-pointer transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </PageHeader>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Edge Gateway Nodes
          </span>
          <div className="text-2xl font-black font-mono text-cyan-400 mt-1">
            {stats.totalRegisteredNodes} Gateways
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Hardware: Dell Edge 3000
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Registered Devices
          </span>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
            {stats.totalRegisteredDevices} Devices
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            CNCs, CMMs & Environmental
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Active Data Schemas
          </span>
          <div className="text-2xl font-black font-mono text-purple-400 mt-1">
            {stats.activeSchemas} Schemas
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            AMRC Specification Schemas
          </div>
        </div>
      </div>

      {/* Edge Gateway Node Card */}
      {nodes.map((node) => (
        <div
          key={node.nodeId}
          className="bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-text-1">
                    {node.nodeId}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] font-mono">
                    {node.status}
                  </span>
                </div>
                <div className="text-xs font-mono text-text-3 flex items-center gap-2 mt-0.5">
                  <span>UUID: {node.nodeUuid}</span>
                  <button
                    onClick={() => copyToClipboard(node.nodeId, node.nodeUuid)}
                    className="hover:text-text-1 text-accent cursor-pointer"
                  >
                    {copiedId === node.nodeId ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono text-text-3">
              <div>
                IP:{" "}
                <span className="text-text-1 font-bold">{node.ipAddress}</span>
              </div>
              <div>
                Devices:{" "}
                <span className="text-cyan-400 font-bold">
                  {node.devicesCount}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 rounded-2xl bg-surface-2 border border-border/80">
              <span className="text-[10px] text-text-3 uppercase block">
                Hardware Model
              </span>
              <span className="font-bold text-text-1">{node.hardware}</span>
            </div>
            <div className="p-3 rounded-2xl bg-surface-2 border border-border/80">
              <span className="text-[10px] text-text-3 uppercase block">
                Operating System
              </span>
              <span className="font-bold text-text-1">{node.os}</span>
            </div>
            <div className="p-3 rounded-2xl bg-surface-2 border border-border/80">
              <span className="text-[10px] text-text-3 uppercase block">
                Benthos Engine
              </span>
              <span className="font-bold text-text-1">{node.firmware}</span>
            </div>
            <div className="p-3 rounded-2xl bg-surface-2 border border-border/80">
              <span className="text-[10px] text-text-3 uppercase block">
                Sparkplug Protocol
              </span>
              <span className="font-bold text-emerald-400">
                spBv1.0 (Active)
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* Devices Catalog Table */}
      <div className="bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-accent" />
            <h3 className="font-extrabold text-sm text-text-1 uppercase tracking-wider">
              Registered Devices & Sensors ({filteredDevices.length})
            </h3>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-text-3 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search devices or schemas..."
              className="w-full bg-surface-2 border border-border rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-text-1 focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border text-text-3 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3">Device Code & Name</th>
                <th className="py-3">Type & Line</th>
                <th className="py-3">Schema Definition</th>
                <th className="py-3">Sparkplug B Topic</th>
                <th className="py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono">
              {filteredDevices.map((d) => (
                <tr
                  key={d.deviceId}
                  className="hover:bg-surface-2/40 transition-colors"
                >
                  <td className="py-3 font-sans">
                    <div className="font-bold text-text-1">
                      {d.deviceId} — {d.name}
                    </div>
                    <div className="text-[10px] text-text-3 font-mono mt-0.5 flex items-center gap-1.5">
                      <span>UUID: {d.deviceUuid}</span>
                      <button
                        onClick={() =>
                          copyToClipboard(d.deviceId, d.deviceUuid)
                        }
                        className="hover:text-text-1 text-accent cursor-pointer"
                      >
                        {copiedId === d.deviceId ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="py-3 font-sans">
                    <div className="font-bold text-text-2">{d.type}</div>
                    <div className="text-[10px] text-text-3 font-mono">
                      {d.line}
                    </div>
                  </td>
                  <td className="py-3 font-sans">
                    <div className="flex items-center gap-1.5">
                      <FileCode2 className="w-3.5 h-3.5 text-purple-400" />
                      <span className="font-bold text-text-1">
                        {d.schemaName}
                      </span>
                    </div>
                    <div className="text-[10px] text-text-3 font-mono">
                      {d.schemaUuid}
                    </div>
                  </td>
                  <td className="py-3 text-[11px] text-cyan-300 font-mono">
                    {d.sparkplugAddress}
                  </td>
                  <td className="py-3 text-right font-sans">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        d.status === "ONLINE"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
