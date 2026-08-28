"use client";

import { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Search,
  ChevronDown,
  ChevronRight,
  Boxes,
  Cpu,
  Wrench,
  Users,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface CostingItem {
  id: string;
  woNumber: string;
  productName: string;
  productSku: string;
  customerName: string;
  status: string;
  plannedQuantity: number;
  goodQuantity: number;
  standardCosting: {
    materialCost: number;
    machiningCost: number;
    toolingCost: number;
    laborCost: number;
    totalCost: number;
  };
  actualCosting: {
    materialCost: number;
    machiningCost: number;
    toolingCost: number;
    laborCost: number;
    totalCost: number;
  };
  economics: {
    totalRevenue: number;
    grossMarginRupees: number;
    grossMarginPct: number;
    costVariance: number;
    isFavorable: boolean;
  };
}

export default function JobCostingClient() {
  const [costingLedger, setCostingLedger] = useState<CostingItem[]>([]);
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalCost: 0,
    totalGrossProfit: 0,
    avgMarginPct: 0,
    unfavorableCount: 0,
  });
  const [_loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"ALL" | "OVERRUNS" | "COMPLETED">(
    "ALL",
  );
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/finance/costing");
      if (res.ok) {
        const data = await res.json();
        setCostingLedger(data.costingLedger || []);
        setSummary(
          data.summary || {
            totalRevenue: 0,
            totalCost: 0,
            totalGrossProfit: 0,
            avgMarginPct: 0,
            unfavorableCount: 0,
          },
        );
      }
    } catch (err) {
      console.error("Failed to load job costing ledger", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const exportCsv = () => {
    const rows = [
      [
        "Work Order",
        "Part Name",
        "SKU",
        "Customer",
        "Status",
        "Planned Qty",
        "Std Material (Rs)",
        "Actual Material (Rs)",
        "Std Machining (Rs)",
        "Actual Machining (Rs)",
        "Std Total (Rs)",
        "Actual Total (Rs)",
        "Revenue (Rs)",
        "Gross Profit (Rs)",
        "Margin %",
        "Cost Variance (Rs)",
      ],
      ...costingLedger.map((item) => [
        item.woNumber,
        item.productName,
        item.productSku,
        item.customerName,
        item.status,
        item.plannedQuantity.toString(),
        item.standardCosting.materialCost.toString(),
        item.actualCosting.materialCost.toString(),
        item.standardCosting.machiningCost.toString(),
        item.actualCosting.machiningCost.toString(),
        item.standardCosting.totalCost.toString(),
        item.actualCosting.totalCost.toString(),
        item.economics.totalRevenue.toString(),
        item.economics.grossMarginRupees.toString(),
        `${item.economics.grossMarginPct}%`,
        item.economics.costVariance.toString(),
      ]),
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Job_Costing_Ledger_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredItems = costingLedger.filter((item) => {
    const matchesSearch =
      item.woNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.customerName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterTab === "ALL") return true;
    if (filterTab === "OVERRUNS") return !item.economics.isFavorable;
    if (filterTab === "COMPLETED") return item.status === "COMPLETED";
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Actual vs Standard Job Costing Ledger"
        description="Work order profitability reconciliation, standard BOM baseline vs realized shopfloor consumption, and margin variance."
      >
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text-2 hover:text-text-1 text-xs font-semibold transition-all cursor-pointer"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          Export Ledger CSV
        </button>
      </PageHeader>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Total Order Revenue
          </span>
          <div className="text-2xl font-black font-mono text-cyan-400 mt-1">
            ₹{summary.totalRevenue.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Across active & closed WOs
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Actual Realized Cost
          </span>
          <div className="text-2xl font-black font-mono text-text-1 mt-1">
            ₹{summary.totalCost.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            RM + Machine + Labor + Tooling
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Gross Realized Profit
          </span>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1 flex items-center gap-1.5">
            <span>₹{summary.totalGrossProfit.toLocaleString("en-IN")}</span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
              {summary.avgMarginPct}%
            </span>
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Weighted portfolio margin
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Cost Overruns
          </span>
          <div className="text-2xl font-black font-mono text-rose-400 mt-1">
            {summary.unfavorableCount} Orders
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Actual cost exceeded standard
          </div>
        </div>
      </div>

      {/* Costing Ledger Table */}
      <div className="bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl border border-border">
            <button
              onClick={() => setFilterTab("ALL")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterTab === "ALL"
                  ? "bg-accent text-white shadow-sm"
                  : "text-text-3 hover:text-text-1"
              }`}
            >
              All Orders ({costingLedger.length})
            </button>
            <button
              onClick={() => setFilterTab("OVERRUNS")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterTab === "OVERRUNS"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-text-3 hover:text-text-1"
              }`}
            >
              Cost Overruns ({summary.unfavorableCount})
            </button>
            <button
              onClick={() => setFilterTab("COMPLETED")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterTab === "COMPLETED"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-text-3 hover:text-text-1"
              }`}
            >
              Completed Orders
            </button>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search WO, product, customer..."
              className="w-full bg-surface-2 border border-border rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-text-1 placeholder-text-3 focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-xs text-text-3">
            No work orders match the criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-text-3 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 w-8"></th>
                  <th className="py-3">Work Order / Customer</th>
                  <th className="py-3">Part & Qty</th>
                  <th className="py-3 text-right">Standard Cost</th>
                  <th className="py-3 text-right">Actual Cost</th>
                  <th className="py-3 text-right">Revenue</th>
                  <th className="py-3 text-right">Gross Margin</th>
                  <th className="py-3 text-center">Variance (Δ)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {filteredItems.map((item) => {
                  const isExpanded = !!expandedRows[item.id];
                  const isFavorable = item.economics.isFavorable;

                  return (
                    <div key={item.id} className="contents">
                      <tr
                        onClick={() => toggleRow(item.id)}
                        className="hover:bg-surface-2/40 transition-colors cursor-pointer"
                      >
                        <td className="py-3 text-text-3">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-accent" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </td>

                        <td className="py-3">
                          <div className="font-extrabold text-text-1">
                            #{item.woNumber}
                          </div>
                          <div className="text-[11px] text-text-3 font-sans mt-0.5 truncate max-w-[150px]">
                            {item.customerName}
                          </div>
                        </td>

                        <td className="py-3 font-sans">
                          <div className="font-bold text-text-1">
                            {item.productName}
                          </div>
                          <div className="text-[10px] text-text-3 font-mono">
                            Qty:{" "}
                            <span className="font-bold text-text-2">
                              {item.plannedQuantity} pcs
                            </span>
                          </div>
                        </td>

                        <td className="py-3 text-right text-text-3">
                          ₹
                          {item.standardCosting.totalCost.toLocaleString(
                            "en-IN",
                          )}
                        </td>

                        <td className="py-3 text-right font-extrabold text-text-1">
                          ₹
                          {item.actualCosting.totalCost.toLocaleString("en-IN")}
                        </td>

                        <td className="py-3 text-right text-cyan-400 font-bold">
                          ₹{item.economics.totalRevenue.toLocaleString("en-IN")}
                        </td>

                        <td className="py-3 text-right font-sans">
                          <div className="font-mono font-bold text-emerald-400">
                            ₹
                            {item.economics.grossMarginRupees.toLocaleString(
                              "en-IN",
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-emerald-300 font-bold">
                            {item.economics.grossMarginPct}% Margin
                          </div>
                        </td>

                        <td className="py-3 text-center font-sans">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold ${
                              isFavorable
                                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                : "bg-rose-500/10 text-rose-300 border-rose-500/30"
                            }`}
                          >
                            {isFavorable ? (
                              <ArrowDownRight className="w-3 h-3" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3" />
                            )}
                            {isFavorable ? "-" : "+"}₹
                            {Math.abs(item.economics.costVariance).toFixed(0)}
                          </span>
                        </td>
                      </tr>

                      {/* Expanded Sub-Breakdown Row */}
                      {isExpanded && (
                        <tr className="bg-surface-2/30 border-b border-border">
                          <td colSpan={8} className="p-4 font-sans">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                              {/* Material Cost Breakdown */}
                              <div className="p-3.5 rounded-2xl bg-surface-1 border border-border space-y-1.5">
                                <div className="flex items-center gap-2 font-bold text-text-1">
                                  <Boxes className="w-4 h-4 text-amber-400" />
                                  Raw Materials
                                </div>
                                <div className="flex justify-between text-text-3 text-[11px]">
                                  <span>Standard:</span>
                                  <span className="font-mono">
                                    ₹
                                    {item.standardCosting.materialCost.toLocaleString(
                                      "en-IN",
                                    )}
                                  </span>
                                </div>
                                <div className="flex justify-between font-bold text-amber-400">
                                  <span>Actual Issued:</span>
                                  <span className="font-mono">
                                    ₹
                                    {item.actualCosting.materialCost.toLocaleString(
                                      "en-IN",
                                    )}
                                  </span>
                                </div>
                              </div>

                              {/* Machining Cost Breakdown */}
                              <div className="p-3.5 rounded-2xl bg-surface-1 border border-border space-y-1.5">
                                <div className="flex items-center gap-2 font-bold text-text-1">
                                  <Cpu className="w-4 h-4 text-cyan-400" />
                                  CNC Machining & Setup
                                </div>
                                <div className="flex justify-between text-text-3 text-[11px]">
                                  <span>Standard Cycle:</span>
                                  <span className="font-mono">
                                    ₹
                                    {item.standardCosting.machiningCost.toLocaleString(
                                      "en-IN",
                                    )}
                                  </span>
                                </div>
                                <div className="flex justify-between font-bold text-cyan-400">
                                  <span>Actual Hours:</span>
                                  <span className="font-mono">
                                    ₹
                                    {item.actualCosting.machiningCost.toLocaleString(
                                      "en-IN",
                                    )}
                                  </span>
                                </div>
                              </div>

                              {/* Tooling & Fixtures */}
                              <div className="p-3.5 rounded-2xl bg-surface-1 border border-border space-y-1.5">
                                <div className="flex items-center gap-2 font-bold text-text-1">
                                  <Wrench className="w-4 h-4 text-purple-400" />
                                  Tooling & Fixtures
                                </div>
                                <div className="flex justify-between text-text-3 text-[11px]">
                                  <span>Standard Amort:</span>
                                  <span className="font-mono">
                                    ₹
                                    {item.standardCosting.toolingCost.toLocaleString(
                                      "en-IN",
                                    )}
                                  </span>
                                </div>
                                <div className="flex justify-between font-bold text-purple-400">
                                  <span>Tool Room Actual:</span>
                                  <span className="font-mono">
                                    ₹
                                    {item.actualCosting.toolingCost.toLocaleString(
                                      "en-IN",
                                    )}
                                  </span>
                                </div>
                              </div>

                              {/* Operator Wages & Labor */}
                              <div className="p-3.5 rounded-2xl bg-surface-1 border border-border space-y-1.5">
                                <div className="flex items-center gap-2 font-bold text-text-1">
                                  <Users className="w-4 h-4 text-emerald-400" />
                                  Labor & Overhead
                                </div>
                                <div className="flex justify-between text-text-3 text-[11px]">
                                  <span>Standard Budget:</span>
                                  <span className="font-mono">
                                    ₹
                                    {item.standardCosting.laborCost.toLocaleString(
                                      "en-IN",
                                    )}
                                  </span>
                                </div>
                                <div className="flex justify-between font-bold text-emerald-400">
                                  <span>Logged Labor:</span>
                                  <span className="font-mono">
                                    ₹
                                    {item.actualCosting.laborCost.toLocaleString(
                                      "en-IN",
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </div>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
