"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  Truck,
  Battery,
  Navigation,
  Plus,
  MapPin,
  X,
  Radio,
} from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface AGVItem {
  id: string;
  code: string;
  name: string;
  type: string;
  status: "IN_TRANSIT" | "LOADING" | "CHARGING" | "HOLD_SAFETY";
  batteryPct: number;
  speedMps: number;
  currentLocation: string;
  destination: string;
  activeMission: string;
  payloadKg: number;
  coordinates: { x: number; y: number };
}

interface WarehouseAsrs {
  totalCapacityBins: number;
  occupiedBins: number;
  utilizationPct: number;
  activeCraneSpeedMps: number;
  craneStatus: string;
}

export default function AgvFleetClient() {
  const [fleet, setFleet] = useState<AGVItem[]>([]);
  const [warehouse, setWarehouse] = useState<WarehouseAsrs | null>(null);
  const [stats, setStats] = useState({
    totalAgvs: 0,
    activeInTransit: 0,
    avgBatteryPct: 0,
    missionsCompletedToday: 0,
  });
  const [isLive, setIsLive] = useState(true);
  const [_loading, setLoading] = useState(true);
  const [selectedAgv, setSelectedAgv] = useState<AGVItem | null>(null);

  // Dispatch Modal
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchAgvId, setDispatchAgvId] = useState("");
  const [dispatchDestination, setDispatchDestination] = useState(
    "CNC-01 Infeed Station",
  );
  const [dispatchMission, setDispatchMission] = useState("");
  const [dispatching, setDispatching] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/digital-twin/agv");
      if (res.ok) {
        const data = await res.json();
        setFleet(data.fleet || []);
        setWarehouse(data.warehouseAsrs || null);
        setStats(
          data.stats || {
            totalAgvs: 0,
            activeInTransit: 0,
            avgBatteryPct: 0,
            missionsCompletedToday: 0,
          },
        );
      }
    } catch (err) {
      logClientError("Failed to load AGV data:", err, "AgvFleetClient");
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
    }, 2500);
    return () => clearInterval(interval);
  }, [isLive]);

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchAgvId) return;

    setDispatching(true);
    try {
      const res = await fetch("/api/digital-twin/agv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agvId: dispatchAgvId,
          destination: dispatchDestination,
          missionName: dispatchMission || `Transfer to ${dispatchDestination}`,
        }),
      });
      if (res.ok) {
        setShowDispatchModal(false);
        setDispatchMission("");
        await fetchData();
      }
    } catch (err) {
      logClientError("Dispatch error:", err, "AgvFleetClient");
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Intralogistics AGV & Automated Storage (AS/RS) Monitor"
        description="Autonomous Guided Vehicle (AGV) fleet routing, real-time telemetry, battery health, and high-bay AS/RS warehouse utilization."
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
            {isLive ? "Fleet Live Track (2.5s)" : "Paused"}
          </button>
          <button
            onClick={() => setShowDispatchModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Dispatch AGV Mission
          </button>
        </div>
      </PageHeader>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Active AGV Fleet
          </span>
          <div className="text-2xl font-black font-mono text-cyan-400 mt-1">
            {stats.activeInTransit} / {stats.totalAgvs} Moving
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            SLAM Lidar Navigation
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Fleet Avg Battery
          </span>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1 flex items-center gap-2">
            <Battery className="w-5 h-5 text-emerald-400" />
            <span>{stats.avgBatteryPct}%</span>
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Fast-charging enabled
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Missions Completed
          </span>
          <div className="text-2xl font-black font-mono text-amber-400 mt-1">
            {stats.missionsCompletedToday} Missions
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Today's pallet transfers
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            AS/RS High-Bay Racks
          </span>
          <div className="text-2xl font-black font-mono text-purple-400 mt-1">
            {warehouse?.utilizationPct}% Full
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            {warehouse?.occupiedBins} / {warehouse?.totalCapacityBins} bins
            occupied
          </div>
        </div>
      </div>

      {/* Main Grid: Plant Map & AGV Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Plant Layout Map (7 cols) */}
        <div className="lg:col-span-7 bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-2 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-accent" />
              Live Plant Intralogistics Map
            </h3>
            <span className="text-[11px] font-mono text-text-3">
              Lidar SLAM Mesh Active
            </span>
          </div>

          {/* Plant Floor SVG Map */}
          <div className="relative w-full h-[360px] bg-slate-950 border border-border/80 rounded-2xl p-4 overflow-hidden select-none">
            {/* Grid Lines */}
            <div
              className="absolute inset-0 opacity-15"
              style={{
                backgroundImage:
                  "radial-gradient(#94a3b8 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />

            {/* Shop Floor Zones */}
            <div className="absolute left-6 top-6 w-36 h-24 border border-cyan-500/30 bg-cyan-950/20 rounded-xl p-2 text-[10px] font-mono text-cyan-300">
              [AS/RS Racks]
            </div>
            <div className="absolute right-6 top-6 w-44 h-24 border border-amber-500/30 bg-amber-950/20 rounded-xl p-2 text-[10px] font-mono text-amber-300">
              [CNC Machining Bay]
            </div>
            <div className="absolute right-6 bottom-6 w-44 h-24 border border-purple-500/30 bg-purple-950/20 rounded-xl p-2 text-[10px] font-mono text-purple-300">
              [Packaging Line 01]
            </div>
            <div className="absolute left-6 bottom-6 w-36 h-24 border border-emerald-500/30 bg-emerald-950/20 rounded-xl p-2 text-[10px] font-mono text-emerald-300">
              [Dock Charging Hub]
            </div>

            {/* Render AGV Waypoint Markers */}
            {fleet.map((agv) => {
              const isSelected = selectedAgv?.id === agv.id;

              return (
                <div
                  key={agv.id}
                  onClick={() => setSelectedAgv(agv)}
                  style={{
                    left: `${agv.coordinates.x}%`,
                    top: `${agv.coordinates.y}%`,
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 p-2 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-2 shadow-2xl z-20 ${
                    isSelected
                      ? "bg-accent text-white border-white scale-110"
                      : "bg-surface-1 border-border text-text-1 hover:scale-105"
                  }`}
                >
                  <Truck className="w-4 h-4 text-cyan-400" />
                  <div>
                    <div className="font-mono font-bold text-[11px] whitespace-nowrap">
                      {agv.code}
                    </div>
                    <div className="text-[9px] opacity-80 font-mono">
                      {agv.batteryPct}% · {agv.speedMps}m/s
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right AGV Detail Cards (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {fleet.map((agv) => {
            const isSelected = selectedAgv?.id === agv.id;

            return (
              <div
                key={agv.id}
                onClick={() => setSelectedAgv(agv)}
                className={`bg-surface-1 border rounded-3xl p-5 shadow-sm space-y-3 cursor-pointer transition-all ${
                  isSelected
                    ? "border-accent ring-2 ring-accent/20"
                    : "border-border hover:border-accent/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-surface-2 border border-border">
                      <Truck className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-text-1">
                        {agv.code} — {agv.name}
                      </h4>
                      <span className="text-[10px] text-text-3 font-mono">
                        {agv.type}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                      agv.status === "IN_TRANSIT"
                        ? "bg-cyan-500/20 text-cyan-300"
                        : agv.status === "CHARGING"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {agv.status}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-surface-2 border border-border/80 space-y-1 text-xs">
                  <div className="font-bold text-text-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-accent" />
                    {agv.activeMission}
                  </div>
                  <div className="text-[11px] text-text-3 font-mono flex items-center justify-between">
                    <span>Dest: {agv.destination}</span>
                    <span>Payload: {agv.payloadKg} kg</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-text-3 pt-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <Battery className="w-3.5 h-3.5" />
                    <span>{agv.batteryPct}% Battery</span>
                  </div>
                  <span>Speed: {agv.speedMps} m/s</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dispatch Modal */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-extrabold text-text-1 text-base flex items-center gap-2">
                <Truck className="w-5 h-5 text-accent" />
                Dispatch AGV Mission
              </h3>
              <button
                onClick={() => setShowDispatchModal(false)}
                className="p-1 rounded-lg hover:bg-surface-3 text-text-3 hover:text-text-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDispatch} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
                  Select AGV Vehicle
                </label>
                <select
                  value={dispatchAgvId}
                  onChange={(e) => setDispatchAgvId(e.target.value)}
                  required
                  className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-xs text-text-1 font-semibold focus:outline-none focus:border-accent"
                >
                  <option value="">-- Choose AGV --</option>
                  {fleet.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} ({a.name}) · {a.batteryPct}% Bat
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
                  Destination Waypoint
                </label>
                <select
                  value={dispatchDestination}
                  onChange={(e) => setDispatchDestination(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-xs text-text-1 font-semibold focus:outline-none focus:border-accent"
                >
                  <option value="CNC-01 Infeed Station">
                    CNC-01 Infeed Station
                  </option>
                  <option value="CNC-02 Infeed Station">
                    CNC-02 Infeed Station
                  </option>
                  <option value="Packaging Line 01">Packaging Line 01</option>
                  <option value="AS/RS High-Bay Warehouse">
                    AS/RS High-Bay Warehouse
                  </option>
                  <option value="Tool Room Preset Bay">
                    Tool Room Preset Bay
                  </option>
                  <option value="Fast Charge Station #3">
                    Fast Charge Station #3
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
                  Mission Task Description
                </label>
                <input
                  type="text"
                  value={dispatchMission}
                  onChange={(e) => setDispatchMission(e.target.value)}
                  placeholder="e.g. Transfer 50 pcs Machined Housings to Packaging"
                  className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2 text-xs text-text-1 focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-2 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dispatching}
                  className="w-1/2 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-xs shadow-md transition-colors"
                >
                  {dispatching ? "Dispatching..." : "Launch Mission"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
