"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  Search,
  Boxes,
  Cpu,
  Truck,
  ShieldCheck,
  PackageCheck,
  FileCheck2,
  Printer,
} from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface StageDetail {
  stage: string;
  title: string;
  status: string;
  timestamp: string;
  details: Record<string, any>;
}

interface TraceResult {
  serialNumber: string;
  workOrder: {
    id: string;
    woNumber: string;
    status: string;
    plannedQuantity: number;
    customerName: string;
    promisedDispatchDate?: string;
  };
  product: {
    id: string;
    name: string;
    sku: string;
  };
  stages: StageDetail[];
}

export default function GenealogyClient() {
  const [query, setQuery] = useState("");
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [traceData, setTraceData] = useState<TraceResult | null>(null);
  const [_loading, setLoading] = useState(false);

  const fetchTrace = async (searchTarget: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/quality/genealogy?q=${encodeURIComponent(searchTarget)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setWorkOrders(data.workOrders || []);
        if (data.traceResult) {
          setTraceData(data.traceResult);
        }
      }
    } catch (err) {
      logClientError("Failed to load genealogy trace:", err, "GenealogyClient");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch to load defaults
    fetchTrace("WO-1001");
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      fetchTrace(query.trim());
    }
  };

  const printCertificate = () => {
    window.print();
  };

  const getStageIcon = (idx: number) => {
    switch (idx) {
      case 0:
        return <Boxes className="w-5 h-5 text-amber-400" />;
      case 1:
        return <Cpu className="w-5 h-5 text-cyan-400" />;
      case 2:
        return <Truck className="w-5 h-5 text-purple-400" />;
      case 3:
        return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
      case 4:
        return <PackageCheck className="w-5 h-5 text-blue-400" />;
      default:
        return <FileCheck2 className="w-5 h-5 text-emerald-400" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="360° Serial & Lot Genealogy Traceability"
        description="End-to-end upstream & downstream tracking: Mill Heat Lots, CNC Machining, Special Processes, FAI QC, and Customer Dispatch."
      >
        <div className="flex items-center gap-3">
          <button
            onClick={printCertificate}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text-2 hover:text-text-1 text-xs font-semibold transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-blue-400" />
            Print AS9100 CoC
          </button>
        </div>
      </PageHeader>

      {/* Search Bar & Quick Suggestion Pills */}
      <div className="bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-4">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter Serial Number (e.g. SN-1001-001), Heat Lot (HEAT-LOT-X89), or Work Order..."
              className="w-full bg-surface-2 border border-border rounded-2xl pl-11 pr-4 py-3 text-sm text-text-1 placeholder-text-3 font-semibold focus:outline-none focus:border-accent"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-accent hover:bg-accent-hover text-white rounded-2xl font-bold text-sm shadow-md transition-all cursor-pointer"
          >
            Trace Lot
          </button>
        </form>

        {/* Suggestion Chips */}
        {workOrders.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-1 text-xs text-text-3">
            <span className="font-semibold">Quick Trace:</span>
            {workOrders.slice(0, 5).map((wo) => (
              <button
                key={wo.id}
                onClick={() => {
                  setQuery(wo.woNumber);
                  fetchTrace(wo.woNumber);
                }}
                className="px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border text-text-2 font-mono text-[11px] transition-colors cursor-pointer"
              >
                #{wo.woNumber} ({wo.sku})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Trace Result */}
      {traceData ? (
        <div className="space-y-6">
          {/* Header Summary Card */}
          <div className="bg-gradient-to-r from-blue-950/40 via-surface-1 to-surface-1 border border-blue-500/30 rounded-3xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono text-xs font-bold border border-blue-500/30">
                    Serial No: {traceData.serialNumber}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                    100% Traceability Verified
                  </span>
                </div>
                <h2 className="text-2xl font-black text-text-1 mt-2">
                  {traceData.product.name}
                </h2>
                <div className="text-xs text-text-3 font-mono mt-0.5">
                  SKU: {traceData.product.sku} · Work Order: #
                  {traceData.workOrder.woNumber} · Customer:{" "}
                  {traceData.workOrder.customerName}
                </div>
              </div>

              <div className="text-right font-mono">
                <span className="text-xs text-text-3">Planned Lot Size</span>
                <div className="text-2xl font-black text-cyan-400">
                  {traceData.workOrder.plannedQuantity} Units
                </div>
              </div>
            </div>
          </div>

          {/* Chronological 6-Stage Timeline */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-3 px-2">
              Full Upstream & Downstream Genealogy Flow
            </h3>

            <div className="space-y-4 relative before:absolute before:left-6 before:top-4 before:bottom-4 before:w-0.5 before:bg-border/60">
              {traceData.stages.map((st, idx) => (
                <div
                  key={idx}
                  className="relative flex items-start gap-4 pl-12 group transition-all"
                >
                  {/* Timeline Dot with Icon */}
                  <div className="absolute left-0 top-3 w-12 h-12 rounded-2xl bg-surface-1 border border-border shadow-md flex items-center justify-center group-hover:scale-105 transition-transform z-10">
                    {getStageIcon(idx)}
                  </div>

                  {/* Stage Card */}
                  <div className="flex-1 bg-surface-1 border border-border rounded-3xl p-5 shadow-sm space-y-3 hover:border-accent/40 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-accent">
                          {st.stage}
                        </span>
                        <h4 className="font-bold text-sm text-text-1 mt-0.5">
                          {st.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold font-mono">
                          {st.status}
                        </span>
                        <span className="text-[11px] text-text-3 font-mono">
                          {new Date(st.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Key Value Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
                      {Object.entries(st.details).map(([k, v]) => (
                        <div
                          key={k}
                          className="p-2.5 rounded-xl bg-surface-2 border border-border/40 space-y-0.5"
                        >
                          <span className="text-[10px] text-text-3 uppercase tracking-wider block">
                            {k.replace(/([A-Z])/g, " $1")}
                          </span>
                          <span className="font-mono font-bold text-text-1 text-xs truncate block">
                            {String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-surface-1 border border-border rounded-3xl p-12 text-center text-xs text-text-3 space-y-2">
          <p>
            No genealogy record loaded. Search by Work Order or Serial Number
            above.
          </p>
        </div>
      )}
    </div>
  );
}
