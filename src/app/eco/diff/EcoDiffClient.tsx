"use client";

import { useState, useEffect } from "react";
import { FileSignature, Boxes, Cpu, ShieldCheck } from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface BomItemDiff {
  code: string;
  name: string;
  qty: number;
  unit: string;
  cost: number;
  status: "ADDED" | "REMOVED" | "MODIFIED" | "UNCHANGED";
}

interface RoutingStepDiff {
  seq: number;
  station: string;
  machine: string;
  cycleTimeMin: number;
  status: "ADDED" | "REMOVED" | "MODIFIED" | "UNCHANGED";
}

interface RevisionDetails {
  rev: string;
  title: string;
  materialCost: number;
  cycleTimeTotalMin: number;
  bom: BomItemDiff[];
  routing: RoutingStepDiff[];
}

interface SignatureItem {
  role: string;
  name: string;
  status: "APPROVED" | "PENDING";
  date?: string | null;
}

interface EcoDiffData {
  eco: {
    id: string;
    ecoNumber: string;
    title: string;
    status: string;
    productSku: string;
    effectiveDate: string;
    createdAt: string;
  };
  currentRevision: RevisionDetails;
  proposedRevision: RevisionDetails;
  signatures: SignatureItem[];
}

export default function EcoDiffClient() {
  const [ecos, setEcos] = useState<any[]>([]);
  const [selectedEcoId, setSelectedEcoId] = useState<string>("");
  const [diffData, setDiffData] = useState<EcoDiffData | null>(null);
  const [_loading, setLoading] = useState(true);
  const [signingRole, setSigningRole] = useState<string | null>(null);

  const fetchData = async (id?: string) => {
    setLoading(true);
    try {
      const url = id
        ? `/api/eco/diff?id=${encodeURIComponent(id)}`
        : "/api/eco/diff";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEcos(data.ecos || []);
        setDiffData(data.diffData || null);
        if (!selectedEcoId && data.diffData?.eco?.id) {
          setSelectedEcoId(data.diffData.eco.id);
        }
      }
    } catch (err) {
      console.error("Failed to load ECO diff", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSign = async (role: string) => {
    setSigningRole(role);
    try {
      const res = await fetch("/api/eco/diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ecoId: diffData?.eco.id,
          signerRole: role,
          signerName: "Arun Patel (Plant Operations Head)",
        }),
      });
      if (res.ok) {
        await fetchData(selectedEcoId);
      }
    } catch (err) {
      console.error("Sign error", err);
    } finally {
      setSigningRole(null);
    }
  };

  const getItemBadge = (status: BomItemDiff["status"]) => {
    switch (status) {
      case "ADDED":
        return (
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[10px]">
            + ADDED
          </span>
        );
      case "REMOVED":
        return (
          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono font-bold text-[10px]">
            - REMOVED
          </span>
        );
      case "MODIFIED":
        return (
          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-[10px]">
            ~ MODIFIED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded bg-surface-3 text-text-3 font-mono text-[10px]">
            = SAME
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Visual Engineering Change Order (ECO) Diff"
        description="Side-by-side BOM & Routing revision comparison, multi-stakeholder electronic signatures, and cut-in management."
      />

      {/* Top ECO Selector Bar */}
      {diffData && (
        <div className="bg-surface-1 border border-border rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 flex-1">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl">
              <FileSignature className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs text-amber-400">
                  {diffData.eco.ecoNumber}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                  {diffData.eco.status}
                </span>
              </div>
              <h2 className="text-lg font-bold text-text-1 mt-0.5">
                {diffData.eco.title}
              </h2>
              <div className="text-xs text-text-3 font-mono mt-0.5">
                Target SKU: {diffData.eco.productSku} · Effective:{" "}
                {new Date(diffData.eco.effectiveDate).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedEcoId}
              onChange={(e) => {
                setSelectedEcoId(e.target.value);
                fetchData(e.target.value);
              }}
              className="bg-surface-2 border border-border text-text-1 text-xs rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-accent"
            >
              {ecos.map((eco) => (
                <option key={eco.id} value={eco.id}>
                  {eco.ecoNumber} - {eco.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {diffData && (
        <div className="space-y-6">
          {/* Side-by-Side BOM Diff Grid */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-3 flex items-center gap-2 px-2">
              <Boxes className="w-4 h-4 text-amber-400" />
              Bill of Materials (BOM) Comparison
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Baseline Current Rev */}
              <div className="bg-surface-1 border border-border rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-3">
                      Current Baseline
                    </span>
                    <h4 className="font-extrabold text-base text-text-1">
                      {diffData.currentRevision.rev} —{" "}
                      {diffData.currentRevision.title}
                    </h4>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-[10px] text-text-3">
                      Material Cost
                    </span>
                    <div className="font-bold text-sm text-text-1">
                      ₹{diffData.currentRevision.materialCost}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {diffData.currentRevision.bom.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl border transition-colors flex items-center justify-between ${
                        item.status === "REMOVED"
                          ? "bg-rose-950/20 border-rose-500/30 text-rose-200 line-through opacity-75"
                          : "bg-surface-2 border-border text-text-2"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs">{item.name}</div>
                        <div className="text-[10px] font-mono opacity-80">
                          {item.code} · {item.qty} {item.unit}
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold text-xs">
                        ₹{item.cost}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Proposed New Rev */}
              <div className="bg-gradient-to-br from-emerald-950/20 via-surface-1 to-surface-1 border-2 border-emerald-500/40 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-500/30 pb-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                      Proposed ECO Revision
                    </span>
                    <h4 className="font-extrabold text-base text-text-1">
                      {diffData.proposedRevision.rev} —{" "}
                      {diffData.proposedRevision.title}
                    </h4>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-[10px] text-text-3">
                      Material Cost
                    </span>
                    <div className="font-bold text-sm text-emerald-400">
                      ₹{diffData.proposedRevision.materialCost}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {diffData.proposedRevision.bom.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl border transition-colors flex items-center justify-between ${
                        item.status === "ADDED"
                          ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
                          : item.status === "MODIFIED"
                            ? "bg-amber-950/30 border-amber-500/40 text-amber-200"
                            : "bg-surface-2 border-border text-text-2"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {getItemBadge(item.status)}
                        <div>
                          <div className="font-bold text-xs">{item.name}</div>
                          <div className="text-[10px] font-mono opacity-80">
                            {item.code} · {item.qty} {item.unit}
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold text-xs">
                        ₹{item.cost}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Side-by-Side Routing Steps Comparison */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-3 flex items-center gap-2 px-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Routing Operations & Cycle Time Diff
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface-1 border border-border rounded-3xl p-5 shadow-sm space-y-2">
                <div className="text-xs font-bold text-text-3 uppercase tracking-wider mb-2">
                  Rev A Routing ({diffData.currentRevision.cycleTimeTotalMin}{" "}
                  min Total)
                </div>
                {diffData.currentRevision.routing.map((rt, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-surface-2 border border-border flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-text-3">{rt.seq}.</span>
                      <span className="font-bold text-text-1">
                        {rt.station}
                      </span>
                      <span className="text-text-3 font-mono">
                        ({rt.machine})
                      </span>
                    </div>
                    <span className="font-mono font-bold text-text-2">
                      {rt.cycleTimeMin} min
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-surface-1 border border-border rounded-3xl p-5 shadow-sm space-y-2">
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
                  Rev B Routing ({diffData.proposedRevision.cycleTimeTotalMin}{" "}
                  min Total)
                </div>
                {diffData.proposedRevision.routing.map((rt, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-surface-2 border border-border flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-text-3">{rt.seq}.</span>
                      <span className="font-bold text-text-1">
                        {rt.station}
                      </span>
                      <span className="text-emerald-400 font-mono font-semibold">
                        ({rt.machine})
                      </span>
                    </div>
                    <span className="font-mono font-bold text-emerald-400">
                      {rt.cycleTimeMin} min
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Multi-Stakeholder Electronic Signatures Gate */}
          <div className="bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-text-1 flex items-center gap-2 border-b border-border pb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Multi-Stakeholder Electronic Sign-off Gate
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {diffData.signatures.map((sig, idx) => {
                const isApproved = sig.status === "APPROVED";

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border transition-all space-y-2 ${
                      isApproved
                        ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                        : "bg-surface-2 border-border text-text-2"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                        {sig.role}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          isApproved
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {sig.status}
                      </span>
                    </div>

                    <div className="font-bold text-xs text-text-1">
                      {sig.name}
                    </div>
                    <div className="text-[10px] opacity-75 font-mono">
                      {isApproved
                        ? `Signed: ${sig.date}`
                        : "Awaiting electronic sign-off"}
                    </div>

                    {!isApproved && (
                      <button
                        onClick={() => handleSign(sig.role)}
                        disabled={signingRole === sig.role}
                        className="w-full mt-2 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {signingRole === sig.role
                          ? "Signing..."
                          : "Sign & Authorize ECO"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
