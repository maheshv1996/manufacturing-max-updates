"use client";

import { useState, useEffect } from "react";
import {
  Truck,
  ArrowRight,
} from "lucide-react";

export default function PlantTransfersClient() {
  const [transfers, setTransfers] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/supply/plant-transfers")
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) setTransfers(d.transfers);
      });
  }, []);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-slate-950/40 border border-cyan-500/20 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold border border-cyan-500/30 flex items-center gap-1">
              <Truck className="w-3 h-3" />
              <span>MULTI-PLANT STOCK TRANSFER (STN)</span>
            </span>
            <span className="text-xs text-white/50 font-mono">INTER-UNIT SUPPLY CHAIN BALANCING</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Inter-Plant Material Transfers & Multi-Site Governance
          </h1>
          <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
            Move raw materials, fixtures, and tooling between multiple manufacturing units with GST Stock Transfer Notes (STN) and real-time in-transit visibility.
          </p>
        </div>
      </div>

      {/* List */}
      <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-4">
        <h2 className="text-xs font-mono font-bold text-white uppercase">Active Stock Transfer Notes ({transfers.length})</h2>

        <div className="space-y-3">
          {transfers.map((stn) => (
            <div
              key={stn.id}
              className="p-4 rounded-2xl bg-black/40 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-black text-cyan-300">{stn.stnNumber}</span>
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {stn.status}
                  </span>
                  <span className="text-xs font-bold text-white">• {stn.material} ({stn.quantity})</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-white/70 font-mono">
                  <span>{stn.sourcePlant}</span>
                  <ArrowRight className="w-3 h-3 text-cyan-400" />
                  <span>{stn.destPlant}</span>
                </div>

                <div className="flex items-center gap-4 text-[10px] text-white/40 font-mono pt-1">
                  <span>Vehicle: {stn.vehicleNumber}</span>
                  <span>ETA: {stn.eta}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
