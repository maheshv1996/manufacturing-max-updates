"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Boxes,
  FileText,
  PackageCheck,
} from "lucide-react";
import PrintButton from "@/app/components/print/PrintButton";

interface MaterialPlanClientProps {
  initialWorkOrders: any[];
  allRawMaterials: any[];
}

export default function MaterialPlanClient({
  initialWorkOrders,
  allRawMaterials,
}: MaterialPlanClientProps) {
  // Preset date ranges: 7d, 30d, 90d, ALL
  const [rangePreset, setRangePreset] = useState<"7d" | "30d" | "90d" | "ALL">(
    "30d",
  );
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Filter WOs based on selected date range
  const now = new Date();
  const getFilteredWOs = () => {
    return initialWorkOrders.filter((wo) => {
      if (wo.status === "COMPLETED" || wo.status === "CANCELLED") return false;

      const startDate = new Date(wo.plannedStartDate);

      if (customStartDate && customEndDate) {
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        return startDate >= start && startDate <= end;
      }

      if (rangePreset === "7d") {
        const limit = new Date(now);
        limit.setDate(limit.getDate() + 7);
        return startDate <= limit;
      }

      if (rangePreset === "30d") {
        const limit = new Date(now);
        limit.setDate(limit.getDate() + 30);
        return startDate <= limit;
      }

      if (rangePreset === "90d") {
        const limit = new Date(now);
        limit.setDate(limit.getDate() + 90);
        return startDate <= limit;
      }

      return true; // ALL open WOs
    });
  };

  const filteredWOs = getFilteredWOs();

  // Aggregate Material Demand across filtered WOs
  const materialDemandMap = new Map<
    string,
    {
      rawMaterial: any;
      totalRequired: number;
      woCount: number;
      contributingWOs: {
        woNumber: string;
        product: string;
        plannedQty: number;
        required: number;
      }[];
    }
  >();

  // Initialize map with all raw materials so complete inventory is evaluated
  allRawMaterials.forEach((rm) => {
    materialDemandMap.set(rm.id, {
      rawMaterial: rm,
      totalRequired: 0,
      woCount: 0,
      contributingWOs: [],
    });
  });

  // Calculate required quantities per raw material
  filteredWOs.forEach((wo) => {
    const bomLines: any[] = wo.product?.bomLines || [];
    const plannedQty = wo.plannedQuantity || 0;

    bomLines.forEach((line) => {
      const rmId = line.rawMaterialId;
      const qtyPerUnit = line.qtyPerUnit || 0;
      const reqForWO = plannedQty * qtyPerUnit;

      if (materialDemandMap.has(rmId)) {
        const item = materialDemandMap.get(rmId)!;
        item.totalRequired += reqForWO;
        item.woCount += 1;
        item.contributingWOs.push({
          woNumber: wo.woNumber,
          product: wo.product?.name || "Product",
          plannedQty,
          required: reqForWO,
        });
      }
    });
  });

  const materialPlan = Array.from(materialDemandMap.values()).map((item) => {
    const rm = item.rawMaterial;
    const currentStock = rm.currentStock || 0;
    const totalRequired = Number(item.totalRequired.toFixed(4));
    const shortageQty = Math.max(
      0,
      Number((totalRequired - currentStock).toFixed(4)),
    );
    const suggestedPOQty = shortageQty;
    const unitCost = rm.unitCost || 0;
    const shortageValue = Number((shortageQty * unitCost).toFixed(2));
    const isShort = shortageQty > 0;

    return {
      rawMaterialId: rm.id,
      name: rm.name,
      sku: rm.sku,
      unit: rm.unit,
      unitCost,
      supplier: rm.supplier,
      currentStock,
      totalRequired,
      shortageQty,
      suggestedPOQty,
      shortageValue,
      isShort,
      woCount: item.woCount,
      contributingWOs: item.contributingWOs,
    };
  });

  const shortItems = materialPlan.filter((m) => m.isShort);
  const totalShortageCost = shortItems.reduce(
    (sum, m) => sum + m.shortageValue,
    0,
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* NAV & PRINT HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <Link
            href="/reports"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-200 bg-slate-800/60 border border-slate-700 rounded-xl hover:bg-slate-800/90 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Reports Hub
          </Link>
          <PrintButton />
        </div>

        {/* DOCUMENT TITLE CARD */}
        <header className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700 pb-6">
            <div className="flex items-start gap-4">
              <div className="p-3.5 bg-blue-50 dark:bg-blue-950/60 text-blue-400 rounded-2xl">
                <Boxes className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    Material Requirement &amp; Readiness Plan (MRP)
                  </h1>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/60 text-blue-200 text-xs font-bold font-mono rounded-full border border-blue-300 dark:border-blue-700">
                    Official MES Printable Report
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  Comprehensive MRP schedule comparing raw material stock
                  against total Work Order demand in the selected date window.
                </p>
              </div>
            </div>
          </div>

          {/* DATE RANGE FILTER CONTROLS (HIDDEN DURING PRINT) */}
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-4 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-extrabold uppercase text-slate-600 text-slate-300">
                  Planning Horizon:
                </span>
              </div>

              {/* Preset Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setRangePreset("7d");
                    setCustomStartDate("");
                    setCustomEndDate("");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    rangePreset === "7d" && !customStartDate
                      ? "bg-blue-600 text-white shadow"
                      : "bg-slate-800/60 text-slate-300 border border-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Next 7 Days
                </button>
                <button
                  onClick={() => {
                    setRangePreset("30d");
                    setCustomStartDate("");
                    setCustomEndDate("");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    rangePreset === "30d" && !customStartDate
                      ? "bg-blue-600 text-white shadow"
                      : "bg-slate-800/60 text-slate-300 border border-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Next 30 Days
                </button>
                <button
                  onClick={() => {
                    setRangePreset("90d");
                    setCustomStartDate("");
                    setCustomEndDate("");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    rangePreset === "90d" && !customStartDate
                      ? "bg-blue-600 text-white shadow"
                      : "bg-slate-800/60 text-slate-300 border border-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Next 90 Days
                </button>
                <button
                  onClick={() => {
                    setRangePreset("ALL");
                    setCustomStartDate("");
                    setCustomEndDate("");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    rangePreset === "ALL" && !customStartDate
                      ? "bg-blue-600 text-white shadow"
                      : "bg-slate-800/60 text-slate-300 border border-slate-600 hover:bg-slate-100"
                  }`}
                >
                  All Open Work Orders
                </button>
              </div>

              {/* Custom Date Range Pickers */}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-slate-800/60 border border-slate-600 rounded-lg text-xs p-2 text-white"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-slate-800/60 border border-slate-600 rounded-lg text-xs p-2 text-white"
                />
              </div>
            </div>
          </div>

          {/* KPI SUMMARY CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl space-y-1">
              <span className="text-[11px] font-extrabold uppercase text-slate-500">
                Work Orders Evaluated
              </span>
              <p className="text-2xl font-black text-white font-mono">
                {filteredWOs.length}
              </p>
              <p className="text-[11px] text-slate-400">
                Active &amp; Planned WOs in range
              </p>
            </div>

            <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl space-y-1">
              <span className="text-[11px] font-extrabold uppercase text-slate-500">
                Total Materials Analyzed
              </span>
              <p className="text-2xl font-black text-white font-mono">
                {materialPlan.length}
              </p>
              <p className="text-[11px] text-slate-400">
                Raw materials in catalog
              </p>
            </div>

            <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl space-y-1">
              <span className="text-[11px] font-extrabold uppercase text-rose-400">
                Shortage Items
              </span>
              <p className="text-2xl font-black text-rose-400 font-mono">
                {shortItems.length}
              </p>
              <p className="text-[11px] text-slate-400">
                Materials with stock deficit
              </p>
            </div>

            <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl space-y-1">
              <span className="text-[11px] font-extrabold uppercase text-slate-500">
                Estimated Shortage Cost
              </span>
              <p className="text-2xl font-black text-amber-400 font-mono">
                â‚¹{totalShortageCost.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400">
                Total PO value required
              </p>
            </div>
          </div>
        </header>

        {/* MATERIAL PLAN MAIN TABLE */}
        <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-blue-500" />
              Raw Material Stock vs Requirements Matrix
            </h2>
            <span className="text-xs font-mono text-slate-400">
              Report Generated: {now.toLocaleDateString()}{" "}
              {now.toLocaleTimeString()}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 rounded-l-lg font-semibold">
                    Raw Material / SKU
                  </th>
                  <th className="py-3.5 px-4 font-semibold">Supplier</th>
                  <th className="py-3.5 px-4 font-semibold text-right">
                    Current Stock
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-right">
                    Total Required
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-center">
                    Shortage
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-right">
                    Suggested PO Qty
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-right">
                    Unit Cost
                  </th>
                  <th className="py-3.5 px-4 rounded-r-lg font-semibold text-right">
                    Shortage Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 divide-slate-800 font-sans">
                {materialPlan.map((mat) => {
                  return (
                    <tr
                      key={mat.rawMaterialId}
                      className={`transition-colors ${
                        mat.isShort
                          ? "bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70 hover:bg-rose-950/40"
                          : "hover:bg-slate-50/60 hover:bg-slate-800/90/40"
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">{mat.name}</div>
                        <div className="text-xs font-mono text-slate-400">
                          SKU: {mat.sku}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-medium text-slate-200">
                          {mat.supplier?.name || "â€”"}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Lead: {mat.supplier?.defaultLeadDays || 7}d
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-300 text-right">
                        {mat.currentStock.toLocaleString()} {mat.unit}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-white text-right">
                        {mat.totalRequired.toLocaleString()} {mat.unit}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {mat.isShort ? (
                          <span className="px-3 py-1 bg-rose-500 text-white font-mono font-black text-xs rounded-full shadow-sm">
                            -{mat.shortageQty.toLocaleString()} {mat.unit}
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950 text-emerald-400 font-mono font-bold text-xs rounded-full border border-emerald-200 dark:border-emerald-800">
                            0 (In Stock)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-black text-cyan-400 text-right">
                        {mat.suggestedPOQty > 0
                          ? `${mat.suggestedPOQty.toLocaleString()} ${mat.unit}`
                          : "0"}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400 text-right">
                        â‚¹{mat.unitCost.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-right">
                        {mat.shortageValue > 0 ? (
                          <span className="text-rose-400 font-extrabold">
                            â‚¹{mat.shortageValue.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">â‚¹0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* WORK ORDER DEMAND CONTRIBUTION BREAKDOWN */}
        <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-700 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Work Order Demand Contribution Traceability
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Traceability detailing which scheduled &amp; active Work Orders
              contribute to each raw material requirement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {materialPlan
              .filter((m) => m.contributingWOs.length > 0)
              .map((mat) => (
                <div
                  key={mat.rawMaterialId}
                  className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-600/60 pb-2">
                    <div>
                      <span className="font-bold text-white text-sm">
                        {mat.name}
                      </span>
                      <span className="text-xs font-mono text-slate-500 ml-2">
                        ({mat.sku})
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/60 text-blue-300 rounded font-mono text-xs font-bold">
                      Req: {mat.totalRequired} {mat.unit}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {mat.contributingWOs.map((wo, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-slate-300 font-mono bg-slate-800/60 p-2 rounded-lg border border-slate-700"
                      >
                        <span className="font-bold text-blue-400">
                          {wo.woNumber} ({wo.product})
                        </span>
                        <span>
                          {wo.plannedQty} pcs Ã— BOM ={" "}
                          <strong className="text-white">
                            {wo.required} {mat.unit}
                          </strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
