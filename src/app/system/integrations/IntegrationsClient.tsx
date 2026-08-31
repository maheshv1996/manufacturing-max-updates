"use client";

import { useState, useEffect } from "react";
import {
  Network,
  RotateCcw,
} from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";

export default function IntegrationsClient() {
  const [connectors, setConnectors] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/system/integrations")
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) setConnectors(d.connectors);
      });
  }, []);

  const handleTriggerSync = (name: string) => {
    soundFx.playSuccess();
    toast.success(`Triggered full synchronization for ${name}!`);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 border border-blue-500/20 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-mono font-bold border border-blue-500/30 flex items-center gap-1">
              <Network className="w-3 h-3" />
              <span>EXTERNAL ERP & EDI INTEGRATION HUB</span>
            </span>
            <span className="text-xs text-white/50 font-mono">TALLY PRIME // SAP // EDI 850/856 // WEBHOOKS</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Universal Enterprise Systems & Accounting Bridge
          </h1>
          <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
            Bi-directional synchronization for Tally Prime XML accounting vouchers, SAP S/4HANA material masters, Aerospace EDI customer purchase orders, and outgoing webhook payloads.
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {connectors.map((c) => (
          <div
            key={c.id}
            className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 hover:border-blue-400/40 transition-all space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-cyan-300 border border-white/10">
                  {c.category}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {c.status}
                </span>
              </div>

              <h3 className="font-extrabold text-base text-white">{c.name}</h3>
              <p className="text-xs text-white/60 leading-relaxed font-sans">{c.details}</p>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono">
              <span className="text-[10px] text-white/40">Last Synced: {c.lastSync}</span>
              <button
                onClick={() => handleTriggerSync(c.name)}
                className="px-4 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border border-blue-500/40 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Sync Now</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
