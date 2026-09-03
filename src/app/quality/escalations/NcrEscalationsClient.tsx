"use client";

import PageHeader from "@/app/components/shared/PageHeader";


import {logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  AlertTriangle,
  ShieldAlert,
  Lock,
  Sparkles,
  FileCheck2,
  ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";

interface NcrItem {
  id: string;
  ncrNumber: string;
  severity: string;
  description: string;
  disposition: string | null;
  quantity: number;
  product?: { name: string; sku: string } | null;
  eightDReports?: { id: string; reportNumber: string; status: string }[];
  raisedAt: string;
}

export default function NcrEscalationsClient() {
  const [ncrs, setNcrs] = useState<NcrItem[]>([]);
  const [criticalCount, setCriticalCount] = useState(0);
  const [quarantinedCount, setQuarantinedCount] = useState(0);

  const fetchNcrs = async () => {
    try {
      const res = await fetch("/api/quality/escalations");
      const data = await res.json();
      if (data?.success) {
        setNcrs(data.ncrs);
        setCriticalCount(data.criticalCount);
        setQuarantinedCount(data.quarantinedCount);
      }
    } catch (err) {
      logClientError(err, "NcrEscalationsClient");
    }
  };

  useEffect(() => {
    fetchNcrs();
  }, []);

  const handleQuarantine = async (ncrId: string, ncrNum: string) => {
    soundFx.playClick();
    try {
      const res = await fetch("/api/quality/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ncrId, action: "QUARANTINE_TRAVELER" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to quarantine");
      soundFx.playSuccess();
      toast.success(`Digital Traveler Quarantine Locked for ${ncrNum}!`);
      fetchNcrs();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTrigger8D = async (ncrId: string) => {
    soundFx.playClick();
    try {
      const res = await fetch("/api/quality/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ncrId, action: "TRIGGER_8D" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to trigger 8D");
      soundFx.playSuccess();
      toast.success(`Created 8D Case ${data.eightD.reportNumber}!`);
      fetchNcrs();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-red-950/40 via-amber-950/30 to-purple-950/40 border border-red-500/20 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 text-xs font-mono font-bold border border-red-500/30 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              <span>AUTONOMOUS NCR AUTO-ESCALATION SENTINEL</span>
            </span>
            <span className="text-xs text-white/50 font-mono">AS9100D CLAUSE 8.7 & 10.2 CAPA</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Quality Defect Escalation & 8D Root-Cause Control
          </h1>
          <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
            Critical non-conformances trigger instant digital traveler lockouts to freeze scrap, alongside automated 8D problem-solving SLAs with Ishikawa root-cause investigation.
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono">
          <div className="p-3.5 rounded-2xl bg-black/40 border border-red-500/30 text-right">
            <div className="text-[10px] text-red-400 font-bold uppercase">High Breaches</div>
            <div className="text-2xl font-black text-red-400">{criticalCount}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-black/40 border border-amber-500/30 text-right">
            <div className="text-[10px] text-amber-400 font-bold uppercase">Quarantined Lots</div>
            <div className="text-2xl font-black text-amber-300">{quarantinedCount}</div>
          </div>
        </div>
      </div>

      {/* NCR List */}
      <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h2 className="text-xs font-mono font-bold text-white uppercase flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span>Active Non-Conformance Reports ({ncrs.length})</span>
          </h2>
          <span className="text-xs text-white/40 font-mono">Auto-Escalation Threshold: Severity = HIGH</span>
        </div>

        <div className="space-y-3">
          {ncrs.map((ncr) => {
            const isQuarantined = ncr.disposition === "SCRAP" || ncr.disposition === "REWORK";
            const isCritical = ncr.severity === "HIGH";
            const existing8D = ncr.eightDReports?.[0];

            return (
              <div
                key={ncr.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  isCritical ? "bg-red-950/20 border-red-500/30" : "bg-black/40 border-white/10"
                }`}
              >
      <PageHeader
        title="Escalations"
        description="Inspections, NCRs, audits and compliance control."
        icon={<ShieldCheck className="w-6 h-6" />}
        iconTone="emerald"
      />

                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-black text-cyan-300">{ncr.ncrNumber}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                      isCritical ? "bg-red-500/30 text-red-200 border border-red-500/40" : "bg-white/10 text-white/70"
                    }`}>
                      {ncr.severity}
                    </span>
                    <span className="text-xs font-bold text-white">• {ncr.product?.name || "General Part"}</span>
                  </div>

                  <p className="text-xs text-white/70 leading-relaxed font-sans">{ncr.description}</p>

                  <div className="flex items-center gap-4 text-[10px] text-white/40 font-mono pt-1">
                    <span>Defect Qty: <strong className="text-red-300">{ncr.quantity} pcs</strong></span>
                    <span>Disposition: <strong className="text-amber-300">{ncr.disposition || "PENDING"}</strong></span>
                    <span>Raised: {new Date(ncr.raisedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                  {!isQuarantined ? (
                    <button
                      onClick={() => handleQuarantine(ncr.id, ncr.ncrNumber)}
                      className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Quarantine Lot</span>
                    </button>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-400 text-[11px] font-bold flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>QUARANTINED</span>
                    </span>
                  )}

                  {existing8D ? (
                    <Link
                      href={`/quality/8d`}
                      className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 flex items-center gap-1.5"
                    >
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span>View {existing8D.reportNumber}</span>
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleTrigger8D(ncr.id)}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Trigger 8D CAPA</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
