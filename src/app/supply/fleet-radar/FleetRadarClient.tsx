"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import { Truck, MapPin, Navigation, RefreshCw, Radio } from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface Shipment {
  id: string;
  type: string;
  origin: string;
  destination: string;
  carrier: string;
  vehicleNo: string;
  cargo: string;
  weightKg: number;
  status: string;
  progressPct: number;
  eta: string;
  geofenceStatus: string;
  lat: number;
  lng: number;
}

export default function FleetRadarClient() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [stats, setStats] = useState({
    activeInTransit: 0,
    subcontractAtVendor: 0,
    deliveredToday: 0,
    onTimeDeliveryRatePct: 0,
  });
  const [_loading, setLoading] = useState(true);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(
    null,
  );

  const fetchData = async () => {
    try {
      const res = await fetch("/api/supply/fleet-radar");
      if (res.ok) {
        const data = await res.json();
        setShipments(data.shipments || []);
        setStats(
          data.stats || {
            activeInTransit: 0,
            subcontractAtVendor: 0,
            deliveredToday: 0,
            onTimeDeliveryRatePct: 0,
          },
        );
        if (data.shipments && data.shipments.length > 0) {
          setSelectedShipment(data.shipments[0]);
        }
      }
    } catch (err) {
      logClientError("Failed to load fleet radar data:", err, "FleetRadarClient");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Supply Chain Logistics & GPS Shipment Radar"
        description="Real-time multi-modal logistics tracking: Inbound raw materials, outward subcontracting challans, and aerospace customer dispatches."
      >
        <button
          onClick={fetchData}
          className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text-2 hover:text-text-1 cursor-pointer transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </PageHeader>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            In-Transit Freight
          </span>
          <div className="text-2xl font-black font-mono text-cyan-400 mt-1 flex items-center gap-2">
            <Truck className="w-5 h-5 text-cyan-400" />
            <span>{stats.activeInTransit} Active</span>
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Live GPS tracking active
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Subcontract at Vendor
          </span>
          <div className="text-2xl font-black font-mono text-amber-400 mt-1">
            {stats.subcontractAtVendor} Shuttles
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Special surface treatments
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Delivered Today
          </span>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
            {stats.deliveredToday} Dispatches
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Signed gate passes on file
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            On-Time Delivery Rate
          </span>
          <div className="text-2xl font-black font-mono text-purple-400 mt-1">
            {stats.onTimeDeliveryRatePct}%
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            OTIF aerospace compliance
          </div>
        </div>
      </div>

      {/* Main Radar Map & Feed Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Radar Map Visualizer (7 cols) */}
        <div className="lg:col-span-7 bg-slate-950 border border-border rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[460px]">
          {/* Radar Sweep Effect Simulation */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.12)_0%,transparent_70%)] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] border border-cyan-500/20 rounded-full pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] border border-cyan-500/25 rounded-full pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80px] h-[80px] border border-cyan-500/30 rounded-full pointer-events-none" />

          {/* Map Header */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
              <span className="font-bold text-sm text-white font-mono uppercase tracking-wider">
                Industrial Corridor Telematics Radar
              </span>
            </div>
            <span className="text-xs font-mono text-cyan-300 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/30">
              Live GPS Feed
            </span>
          </div>

          {/* Simulated Map Markers */}
          <div className="relative z-10 my-auto grid grid-cols-3 gap-4 py-8">
            {shipments.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedShipment(s)}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer shadow-lg ${
                  selectedShipment?.id === s.id
                    ? "bg-cyan-500/20 border-cyan-400 ring-2 ring-cyan-400/40"
                    : "bg-slate-900/80 border-slate-700 hover:border-cyan-500/50"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-white font-mono">
                  <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{s.vehicleNo}</span>
                </div>
                <div className="text-[10px] text-text-3 truncate mt-1">
                  {s.destination}
                </div>
                <div className="text-[10px] font-mono text-cyan-300 mt-1 font-bold">
                  {s.status.replace(/_/g, " ")}
                </div>
              </button>
            ))}
          </div>

          {/* Map Footer Proximity */}
          {selectedShipment && (
            <div className="relative z-10 p-3 rounded-2xl bg-slate-900/90 border border-slate-700 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-400" />
                <span className="text-white font-bold">
                  {selectedShipment.geofenceStatus}
                </span>
              </div>
              <span className="text-cyan-300 font-bold">
                ETA: {selectedShipment.eta}
              </span>
            </div>
          )}
        </div>

        {/* Shipment Details Feed (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {shipments.map((s) => {
            const isSelected = selectedShipment?.id === s.id;
            const isDelivered = s.status === "DELIVERED";
            const isInTransit = s.status === "IN_TRANSIT";

            return (
              <div
                key={s.id}
                onClick={() => setSelectedShipment(s)}
                className={`bg-surface-1 border rounded-3xl p-5 shadow-sm space-y-3 cursor-pointer transition-all ${
                  isSelected
                    ? "border-cyan-400 ring-2 ring-cyan-400/20"
                    : "border-border hover:border-border/80"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-cyan-400">
                        {s.id}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                          isDelivered
                            ? "bg-emerald-500/20 text-emerald-300"
                            : isInTransit
                              ? "bg-cyan-500/20 text-cyan-300 animate-pulse"
                              : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {s.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="text-xs font-black text-text-1 mt-1">
                      {s.cargo}
                    </div>
                  </div>
                </div>

                {/* Route Path */}
                <div className="p-3 rounded-2xl bg-surface-2 border border-border/60 text-xs space-y-1">
                  <div className="flex items-center gap-2 text-text-2">
                    <span className="text-text-3 font-mono">From:</span>
                    <span className="font-semibold text-text-1 truncate">
                      {s.origin}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-text-2">
                    <span className="text-text-3 font-mono">To:</span>
                    <span className="font-semibold text-cyan-300 truncate">
                      {s.destination}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono text-text-3">
                    <span>Route Transit</span>
                    <span className="text-text-1 font-bold">
                      {s.progressPct}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isDelivered ? "bg-emerald-400" : "bg-cyan-400"
                      }`}
                      style={{ width: `${s.progressPct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-text-3 pt-1 border-t border-border/40">
                  <span>Carrier: {s.carrier}</span>
                  <span className="text-text-1 font-bold">{s.weightKg} kg</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
