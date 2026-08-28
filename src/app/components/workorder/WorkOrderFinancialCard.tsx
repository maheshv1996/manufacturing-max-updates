"use client";

import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, TrendingDown, PieChart } from "lucide-react";
import OverrideBadgeModal from "../modals/OverrideBadgeModal";
import SourceRecordEditModal from "../modals/SourceRecordEditModal";

interface WorkOrderFinancialCardProps {
  wo: any;
  costing: any;
  userRole?: string;
}

export default function WorkOrderFinancialCard({
  wo,
  costing,
  userRole = "ADMIN",
}: WorkOrderFinancialCardProps) {
  const [overrides, setOverrides] = useState<any[]>([]);

  const fetchOverrides = () => {
    fetch(`/api/overrides?entityType=WO_COSTING&entityId=${wo.id}`)
      .then((r) => r.json())
      .then((d) => setOverrides(d.overrides || []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchOverrides();
  }, [wo.id]);

  const costOverride = overrides.find((o) => o.field === "totalCost");
  const marginOverride = overrides.find((o) => o.field === "marginPct");

  const displayTotalCost = costOverride
    ? costOverride.value
    : costing.totalCost;
  const baseMargin = costing.marginPercentage ?? costing.marginPct ?? 0;
  const displayMarginPct = marginOverride ? marginOverride.value : baseMargin;
  const displayProfit = costing.revenue - displayTotalCost;
  const isLoss = displayProfit < 0 || displayMarginPct < 0;

  const safeTotalCost = displayTotalCost > 0 ? displayTotalCost : 1;
  const matPct = ((costing.materialCost / safeTotalCost) * 100).toFixed(1);
  const labPct = ((costing.laborCost / safeTotalCost) * 100).toFixed(1);
  const macPct = ((costing.machineCost / safeTotalCost) * 100).toFixed(1);
  const scrPct = ((costing.scrapLoss / safeTotalCost) * 100).toFixed(1);
  const engPct = (((costing.energyCost || 0) / safeTotalCost) * 100).toFixed(1);

  return (
    <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-5">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-emerald-500" />
            Job Costing &amp; Profitability Analysis
            <SourceRecordEditModal
              entityType="WorkOrder"
              entityId={wo.id}
              title="Work Order Parameters"
              fields={[
                {
                  key: "plannedQuantity",
                  label: "Planned Quantity",
                  type: "number",
                },
                {
                  key: "quotedPrice",
                  label: "Quoted Price (â‚¹)",
                  type: "number",
                },
                {
                  key: "setupTimeMinutes",
                  label: "Setup Time (Mins)",
                  type: "number",
                },
                {
                  key: "cycleTimeSeconds",
                  label: "Cycle Time (Secs)",
                  type: "number",
                },
              ]}
              initialValues={{
                plannedQuantity: wo.plannedQuantity,
                quotedPrice: wo.quotedPrice,
                setupTimeMinutes: wo.setupTimeMinutes,
                cycleTimeSeconds: wo.cycleTimeSeconds,
              }}
              userRole={userRole}
              onSaved={() => window.location.reload()}
            />
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time material, labor, machine, and scrap cost aggregation.
          </p>
        </div>

        {isLoss ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-rose-100 text-rose-700 dark:bg-rose-950/80 text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse">
            <TrendingDown className="w-4 h-4" />
            LOSS-MAKER JOB! ({displayMarginPct.toFixed(1)}%)
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <TrendingUp className="w-4 h-4" />
            PROFITABLE JOB ({displayMarginPct.toFixed(1)}%)
          </span>
        )}
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Quoted Revenue
          </span>
          <span className="text-xl font-extrabold font-mono text-white mt-1 block">
            â‚¹{costing.revenue.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block flex items-center">
            Total Job Cost
            <OverrideBadgeModal
              entityType="WO_COSTING"
              entityId={wo.id}
              field="totalCost"
              fieldLabel="Total Job Cost (â‚¹)"
              currentCalculatedValue={costing.totalCost}
              existingOverride={costOverride}
              unit="â‚¹"
              userRole={userRole}
              onOverrideSaved={fetchOverrides}
            />
          </span>
          <span className="text-xl font-extrabold font-mono text-white mt-1 block">
            â‚¹{displayTotalCost.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Net Profit / (Loss)
          </span>
          <span
            className={`text-xl font-extrabold font-mono mt-1 block ${
              displayProfit >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            â‚¹{displayProfit.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block flex items-center">
            Margin %
            <OverrideBadgeModal
              entityType="WO_COSTING"
              entityId={wo.id}
              field="marginPct"
              fieldLabel="Margin %"
              currentCalculatedValue={costing.marginPct}
              existingOverride={marginOverride}
              unit="%"
              userRole={userRole}
              onOverrideSaved={fetchOverrides}
            />
          </span>
          <span
            className={`text-xl font-extrabold font-mono mt-1 block ${
              displayMarginPct >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {displayMarginPct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* COST STACK BAR */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
          <span className="flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-blue-500" />
            Cost Elements Share Breakdown
          </span>
          <span className="font-mono text-slate-500">100% of Total Cost</span>
        </div>

        <div className="h-4 w-full bg-slate-800/60 rounded-full overflow-hidden flex text-[10px] font-bold text-white font-mono">
          {costing.materialCost > 0 && (
            <div
              style={{ width: `${matPct}%` }}
              className="bg-blue-500 h-full flex items-center justify-center transition-all"
              title={`Material: â‚¹${costing.materialCost} (${matPct}%)`}
            >
              {Number(matPct) > 10 ? `${matPct}%` : ""}
            </div>
          )}
          {costing.laborCost > 0 && (
            <div
              style={{ width: `${labPct}%` }}
              className="bg-amber-500 h-full flex items-center justify-center transition-all"
              title={`Labor: â‚¹${costing.laborCost} (${labPct}%)`}
            >
              {Number(labPct) > 10 ? `${labPct}%` : ""}
            </div>
          )}
          {costing.machineCost > 0 && (
            <div
              style={{ width: `${macPct}%` }}
              className="bg-purple-500 h-full flex items-center justify-center transition-all"
              title={`Machine: â‚¹${costing.machineCost} (${macPct}%)`}
            >
              {Number(macPct) > 10 ? `${macPct}%` : ""}
            </div>
          )}
          {costing.scrapLoss > 0 && (
            <div
              style={{ width: `${scrPct}%` }}
              className="bg-rose-500 h-full flex items-center justify-center transition-all"
              title={`Scrap Loss: â‚¹${costing.scrapLoss} (${scrPct}%)`}
            >
              {Number(scrPct) > 10 ? `${scrPct}%` : ""}
            </div>
          )}
          {(costing.energyCost || 0) > 0 && (
            <div
              style={{ width: `${engPct}%` }}
              className="bg-cyan-500 h-full flex items-center justify-center transition-all"
              title={`Energy: â‚¹${costing.energyCost || 0} (${engPct}%)`}
            >
              {Number(engPct) > 10 ? `${engPct}%` : ""}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 font-medium text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            Material:{" "}
            <strong>â‚¹{costing.materialCost.toLocaleString("en-IN")}</strong>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            Labor:{" "}
            <strong>â‚¹{costing.laborCost.toLocaleString("en-IN")}</strong>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-500" />
            Machine:{" "}
            <strong>â‚¹{costing.machineCost.toLocaleString("en-IN")}</strong>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500" />
            Scrap Loss:{" "}
            <strong>â‚¹{costing.scrapLoss.toLocaleString("en-IN")}</strong>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-500" />
            Energy:{" "}
            <strong>
              â‚¹{(costing.energyCost || 0).toLocaleString("en-IN")}
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
}
