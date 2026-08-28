"use client";

import { useState, useEffect } from "react";
import PageHeader from "@/app/components/shared/PageHeader";
import {
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface ExplodedReq {
  itemCode: string;
  grossRequirement: number;
  projectedAvailable: number;
  netRequirement: number;
  scrapAllowanceQty: number;
}

interface PlannedOrder {
  itemCode: string;
  itemName: string;
  orderType: "PURCHASE_ORDER" | "WORK_ORDER" | "SUBCONTRACT_PO";
  suggestedQty: number;
  releaseDate: string;
  requiredDate: string;
  estimatedCost: number;
  reason: string;
  parentDemandRef: string;
}

interface CriticalShortage {
  itemCode: string;
  shortageQty: number;
  daysUntilStockout: number;
  severity: "HIGH" | "MEDIUM" | "LOW";
}

interface MrpResponse {
  explodedRequirements: ExplodedReq[];
  plannedOrders: PlannedOrder[];
  criticalShortages: CriticalShortage[];
  totalEstimatedSpend: number;
}

export default function MrpWorkbench() {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [demandsCount, setDemandsCount] = useState(0);
  const [mrpData, setMrpData] = useState<MrpResponse | null>(null);
  const [activeTab, setActiveTab] = useState<
    "PLANNED" | "EXPLODED" | "SHORTAGES"
  >("PLANNED");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const runMrpCalculation = async () => {
    setLoading(true);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/mrp/run");
      if (res.ok) {
        const data = await res.json();
        setDemandsCount(data.workOrdersCount || 0);
        setMrpData(data.mrpResult);
      }
    } catch (err) {
      console.error("MRP run failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runMrpCalculation();
  }, []);

  const handleGenerateRequisitions = async () => {
    if (!mrpData || mrpData.plannedOrders.length === 0) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/mrp/generate-requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plannedOrders: mrpData.plannedOrders }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuccessMessage(
          `Successfully created ${data.count} Purchase Requisitions in ERP!`,
        );
        setTimeout(() => setSuccessMessage(null), 6000);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to generate requisitions");
      }
    } catch (err) {
      console.error("Generate requisitions error:", err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Material Requirements Planning (MRP Workbench)"
        description="Automated demand explosion, net stock shortage calculation, lead-time offsets, and one-click PO generation."
      >
        <div className="flex items-center gap-3">
          <button
            onClick={runMrpCalculation}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text-2 hover:text-text-1 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Re-calculate MRP
          </button>

          {mrpData && mrpData.plannedOrders.length > 0 && (
            <button
              onClick={handleGenerateRequisitions}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShoppingCart className="w-4 h-4" />
              )}
              {generating
                ? "Creating PRs..."
                : `Create ${mrpData.plannedOrders.length} Purchase Requisitions`}
            </button>
          )}
        </div>
      </PageHeader>

      {successMessage && (
        <div className="p-4 bg-emerald-950/70 border border-emerald-700 text-emerald-300 rounded-2xl flex items-center justify-between text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMessage}</span>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Active Demands
          </span>
          <div className="text-2xl font-black font-mono text-blue-400 mt-1">
            {demandsCount} Work Orders
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Exploded against active BOMs
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Critical Stockouts
          </span>
          <div className="text-2xl font-black font-mono text-rose-400 mt-1">
            {mrpData ? mrpData.criticalShortages.length : 0} items
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Deficit before planned start
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Planned Purchase Orders
          </span>
          <div className="text-2xl font-black font-mono text-amber-400 mt-1">
            {mrpData ? mrpData.plannedOrders.length : 0} Orders
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Ready for procurement release
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Estimated Spend
          </span>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
            ₹
            {mrpData
              ? mrpData.totalEstimatedSpend.toLocaleString("en-IN")
              : "0"}
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Requisition budget required
          </div>
        </div>
      </div>

      {/* Main Tabs Container */}
      <div className="bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-surface-2 p-1 rounded-xl border border-border">
            <button
              onClick={() => setActiveTab("PLANNED")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "PLANNED"
                  ? "bg-accent text-white shadow-sm"
                  : "text-text-3 hover:text-text-1"
              }`}
            >
              Planned Purchase Orders ({mrpData?.plannedOrders.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("SHORTAGES")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "SHORTAGES"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-text-3 hover:text-text-1"
              }`}
            >
              Critical Shortages ({mrpData?.criticalShortages.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("EXPLODED")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "EXPLODED"
                  ? "bg-accent text-white shadow-sm"
                  : "text-text-3 hover:text-text-1"
              }`}
            >
              Exploded Gross vs Net ({mrpData?.explodedRequirements.length || 0}
              )
            </button>
          </div>
        </div>

        {/* Tab 1: Planned Orders */}
        {activeTab === "PLANNED" && (
          <div className="space-y-3">
            {!mrpData || mrpData.plannedOrders.length === 0 ? (
              <div className="text-center py-12 text-xs text-text-3">
                No planned purchase orders required. All stock on hand covers
                active demand!
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {mrpData.plannedOrders.map((po, idx) => (
                  <div
                    key={idx}
                    className="py-3.5 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <ShoppingCart className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-text-1 flex items-center gap-2">
                          <span>{po.itemName}</span>
                          <span className="font-mono text-[10px] text-text-3">
                            ({po.itemCode})
                          </span>
                        </div>
                        <div className="text-[11px] text-text-3 mt-0.5">
                          Demand:{" "}
                          <span className="text-text-2 font-medium">
                            {po.parentDemandRef}
                          </span>{" "}
                          · Reason: {po.reason}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <div className="text-xs font-mono font-bold text-cyan-400">
                          {po.suggestedQty} units
                        </div>
                        <div className="text-[10px] text-text-3 font-mono">
                          Est: ₹{po.estimatedCost.toLocaleString("en-IN")}
                        </div>
                      </div>
                      <div className="hidden sm:block text-right">
                        <div className="text-[10px] text-text-3">
                          Release By
                        </div>
                        <div className="text-xs font-mono font-semibold text-text-2">
                          {new Date(po.releaseDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Critical Shortages */}
        {activeTab === "SHORTAGES" && (
          <div className="space-y-3">
            {!mrpData || mrpData.criticalShortages.length === 0 ? (
              <div className="text-center py-12 text-xs text-emerald-400 font-bold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Zero critical material shortages detected!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mrpData.criticalShortages.map((shortage, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-rose-950/30 border border-rose-700/60 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-mono font-bold text-xs text-rose-200">
                          {shortage.itemCode}
                        </div>
                        <div className="text-xs text-rose-300 font-bold mt-0.5">
                          Deficit: {shortage.shortageQty} units
                        </div>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 bg-rose-900/80 text-rose-200 text-[10px] font-bold rounded-lg uppercase">
                      Stockout in {shortage.daysUntilStockout}d
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Exploded Requirements */}
        {activeTab === "EXPLODED" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-text-3 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5">Item Code</th>
                  <th className="py-2.5">Gross Demand</th>
                  <th className="py-2.5">On-Hand Stock</th>
                  <th className="py-2.5">Scrap Allowance</th>
                  <th className="py-2.5">Net Requirement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {mrpData?.explodedRequirements.map((req, idx) => (
                  <tr key={idx} className="hover:bg-surface-2/40">
                    <td className="py-2.5 font-bold text-text-1">
                      {req.itemCode}
                    </td>
                    <td className="py-2.5 text-text-2">
                      {req.grossRequirement.toFixed(1)}
                    </td>
                    <td className="py-2.5 text-text-3">
                      {req.projectedAvailable.toFixed(1)}
                    </td>
                    <td className="py-2.5 text-amber-400">
                      +{req.scrapAllowanceQty.toFixed(1)}
                    </td>
                    <td className="py-2.5 font-bold text-cyan-400">
                      {req.netRequirement.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
