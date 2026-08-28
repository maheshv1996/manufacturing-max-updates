"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Clock,
  Cpu,
  TrendingUp,
  Trophy,
  Settings,
  Sparkles,
  DollarSign,
  AlertTriangle,
  ShieldAlert,
  Gauge,
} from "lucide-react";
import CollapsibleDigestCard from "./CollapsibleDigestCard";
import DashboardCharts from "./DashboardCharts";
import {
  UserPreferences,
  DEFAULT_PREFERENCES,
  KpiCardConfig,
} from "@/lib/userPrefs";
import DashboardCustomizer from "./DashboardCustomizer";
import DashboardMachineCards from "./DashboardMachineCards";
import DashboardRecentLogs from "./DashboardRecentLogs";
import MyRoutineCard from "../shared/MyRoutineCard";
import MaintenanceCard from "../machine/MaintenanceCard";
import OverrideBadgeModal from "../modals/OverrideBadgeModal";
import { KpiCard } from "@/app/components/ui/KpiCard";
import { motion } from "framer-motion";
import { AnimatedCounter } from "@/app/components/ui/AnimatedCounter";

export default function DashboardClient({
  machines,
  plantStats,
  champion,
  digestData,
  oeeTrends,
  downtimeByCategory,
  initialPrefs,
  userRole,
  userId,
  financialSummary,
  receivablesSummary,
  payablesSummary,
  lowStockAlerts,
  energySummary,
  complianceAlerts = [],
  mrbSummary,
  noCertBatchCount,
  awaitingInspectorCount,
  pendingEcoCount,
  calibrationStats,
  specialProcessStats,
  complianceFlags = [],
}: {
  machines: any[];
  plantStats: any;
  champion: any;
  digestData: any;
  oeeTrends: any;
  downtimeByCategory: any;
  initialPrefs: UserPreferences | null;
  userRole?: string;
  userId?: string;
  financialSummary?: {
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
  };
  receivablesSummary?: {
    totalOutstanding: number;
    bucket0_30: number;
    bucket31_60: number;
    bucket61_90: number;
    bucket90Plus: number;
  };
  payablesSummary?: {
    totalOutstanding: number;
  };
  lowStockAlerts?: {
    id: string;
    sku: string;
    name: string;
    unit: string;
    currentStock: number;
    minStock: number;
    unitCost: number;
  }[];
  overloadedMachineDays?: number;
  energySummary?: {
    totalCost: number;
    perMachineHour: number;
  };
  complianceAlerts?: {
    id: string;
    operatorName: string;
    machineCode: string;
    validUntil: Date | null;
    isExpired: boolean;
  }[];
  complaintsSummary?: {
    openCount: number;
    criticalCount: number;
  };
  mrbSummary?: {
    openCount: number;
    reviewCount: number;
  };
  noCertBatchCount?: number;
  awaitingInspectorCount?: number;
  pendingEcoCount?: number;
  calibrationStats?: {
    expiredCount: number;
    expiringCount: number;
  };
  specialProcessStats?: {
    expiredVendorsCount: number;
  };
  complianceFlags?: {
    id: string;
    category: string;
    label: string;
    detail: string;
    severity: "critical" | "warning";
    href: string;
  }[];
}) {
  const [prefs, setPrefs] = useState<UserPreferences>(
    initialPrefs || DEFAULT_PREFERENCES,
  );
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [fiveSSummary, setFiveSSummary] = useState<{
    best: any;
    worst: any;
  } | null>(null);
  const [overrides, setOverrides] = useState<any[]>([]);

  const fetchOverrides = () => {
    fetch("/api/overrides")
      .then((r) => r.json())
      .then((d) => setOverrides(d.overrides || []))
      .catch(console.error);
  };

  useEffect(() => {
    fetch("/api/fives")
      .then((r) => r.json())
      .then((d) => {
        if (d.weeklySummary) setFiveSSummary(d.weeklySummary);
      })
      .catch(console.error);

    fetchOverrides();
  }, []);

  const plantOeeOverride = overrides.find(
    (o) =>
      o.entityType === "KPI" &&
      o.entityId === "PLANT_OEE" &&
      o.field === "avgOee",
  );
  const displayPlantOee = plantOeeOverride
    ? plantOeeOverride.value
    : plantStats.avgOee;

  // Apply default view if activeViewId exists, otherwise use root prefs
  const activeView = prefs.activeViewId
    ? prefs.views.find((v) => v.id === prefs.activeViewId)
    : null;

  const currentSections = activeView?.sections ||
    (prefs as any).sections ||
    DEFAULT_PREFERENCES.views?.[0]?.sections || {
      digest: true,
      oeeTrend: true,
      downtimePareto: true,
      categoryDonut: true,
      championTeaser: true,
      recentDowntime: true,
    };

  const currentCards = activeView?.kpiCards ||
    (prefs as any).kpiCards || [
      { id: "oee", visible: true, order: 0 },
      { id: "output", visible: true, order: 1 },
      { id: "downtime", visible: true, order: 2 },
      { id: "scrap", visible: true, order: 3 },
      { id: "capacity", visible: true, order: 4 },
      { id: "mttr", visible: false, order: 5 },
      { id: "fpy", visible: false, order: 6 },
    ];

  const sortedCards = [...currentCards]
    .sort((a, b) => a.order - b.order)
    .filter((c) => c.visible);

  const renderKpiCard = (card: KpiCardConfig) => {
    switch (card.id) {
      case "oee":
        return (
          <KpiCard
            key="oee"
            title="Plant Avg OEE"
            value={
              <div className="flex items-center gap-2">
                <span>
                  <AnimatedCounter
                    to={Number(displayPlantOee)}
                    formatter={(v) => v.toFixed(1)}
                  />
                  %
                </span>
                <OverrideBadgeModal
                  entityType="KPI"
                  entityId="PLANT_OEE"
                  field="avgOee"
                  fieldLabel="Plant Avg OEE %"
                  currentCalculatedValue={plantStats.avgOee}
                  existingOverride={plantOeeOverride}
                  unit="%"
                  userRole={userRole}
                  onOverrideSaved={fetchOverrides}
                />
              </div>
            }
            trend={{
              value: plantStats.oeeDelta,
              label: "vs prev period",
              isPositive: plantStats.isOeeUp,
            }}
            icon={<TrendingUp className="w-5 h-5" />}
          />
        );
      case "output":
      case "downtime":
        if (card.id === "downtime") {
          return (
            <KpiCard
              key="downtime"
              title="Total Downtime Logged"
              value={
                <span>
                  <AnimatedCounter
                    to={plantStats.totalDowntime / 60}
                    formatter={(v) => v.toFixed(1)}
                  />{" "}
                  hrs
                </span>
              }
              icon={<Clock className="w-5 h-5 text-warning" />}
            />
          );
        }
        return (
          <KpiCard
            key="output"
            title="Running Machines"
            value={`${plantStats.activeCount} / ${machines.length}`}
            icon={<Cpu className="w-5 h-5 text-success" />}
          />
        );
      case "scrap":
      case "mttr":
      case "fpy":
        return (
          <KpiCard
            key={card.id}
            title={card.id.toUpperCase()}
            value="--"
            icon={<Activity className="w-5 h-5 text-text-3" />}
            className="opacity-75"
          />
        );
      case "capacity":
        return (
          <Link key="capacity" href="/ops/capacity" className="block">
            <KpiCard
              title="Overloaded Work Centers"
              value={
                <AnimatedCounter
                  to={plantStats.overloadedMachineDays || 0}
                  formatter={(v) => Math.floor(v).toString()}
                />
              }
              icon={<AlertTriangle className="w-5 h-5 text-danger" />}
              trend={
                plantStats.overloadedMachineDays! > 0
                  ? {
                      value: "Review",
                      label: "Required",
                      isPositive: false,
                    }
                  : {
                      value: "Clear",
                      label: "Capacity OK",
                      isPositive: true,
                    }
              }
              className="hover:border-blue-500 cursor-pointer transition-colors"
            />
          </Link>
        );
      default:
        return null;
    }
  };

  const handleUpdatePrefs = async (newPrefs: UserPreferences) => {
    setPrefs(newPrefs);
    try {
      await fetch("/api/user/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPrefs),
      });
    } catch (e) {
      console.error("Failed to save prefs", e);
    }
  };

  return (
    <>
      <div className="flex justify-end mb-4 gap-2">
        <Link
          href="/analyst"
          className="flex items-center gap-2 px-4 py-1.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 border border-transparent rounded-lg shadow-sm transition-colors shadow-blue-500/20"
        >
          <Sparkles className="w-4 h-4" />
          Ask AI Analyst
        </Link>
        <button
          onClick={() => setIsCustomizerOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-300 bg-slate-800/60 border border-slate-600 rounded-lg shadow-sm hover:bg-slate-800/90 transition-colors"
        >
          <Settings className="w-4 h-4" />
          Customize
        </button>
      </div>

      {/* MY ROUTINE CARD */}
      <div className="mb-6">
        <MyRoutineCard role={userRole || "ADMIN"} userId={userId} />
      </div>

      {/* CRITICAL INVENTORY LOW-STOCK ALERTS CARD */}
      {lowStockAlerts && lowStockAlerts.length > 0 && (
        <div className="mb-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rose-100 dark:border-rose-900/60 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-900/80 text-rose-300 rounded-xl animate-pulse">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-rose-200 flex items-center gap-2">
                  <span>Inventory Alerts â€” Critical Low Stock</span>
                  <span className="px-2 py-0.5 bg-rose-600 text-white rounded-full text-[10px] font-black">
                    {lowStockAlerts.length} Item(s)
                  </span>
                </h3>
                <p className="text-xs text-rose-300 font-medium mt-0.5">
                  Raw material stock has fallen below minimum reorder
                  thresholds.
                </p>
              </div>
            </div>

            <Link
              href="/system/admin?tab=inventory"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all shrink-0"
            >
              <span>Manage Store &amp; Reorder</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
            {lowStockAlerts.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-slate-800/60 border border-rose-200 dark:border-rose-900/80 rounded-xl space-y-1 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-white text-xs truncate">
                    {item.name}
                  </span>
                  <a
                    href={`/system/admin?tab=purchasing&materialId=${item.id}`}
                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-black shrink-0 shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                    title="Open Purchasing tab to issue PO for 2x min stock"
                  >
                    <span>Reorder Now!</span>
                  </a>
                </div>
                <div className="text-[11px] text-slate-500 font-mono flex items-center justify-between pt-1 border-t border-slate-700">
                  <span>
                    Current:{" "}
                    <strong className="text-rose-400 font-black">
                      {item.currentStock} {item.unit}
                    </strong>
                  </span>
                  <span>
                    Min: {item.minStock} {item.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* UNCERTIFIED BATCHES ALERT */}
      {noCertBatchCount !== undefined && noCertBatchCount > 0 && (
        <div className="mb-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-900/80 text-rose-300 rounded-xl animate-pulse">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-rose-200 flex items-center gap-2">
                  <span>Aerospace Mode: Uncertified Stock Detected</span>
                  <span className="px-2 py-0.5 bg-rose-600 text-white rounded-full text-[10px] font-black">
                    {noCertBatchCount} Batch(es)
                  </span>
                </h3>
                <p className="text-xs text-rose-300 font-medium mt-0.5">
                  These batches are blocked from issuance until mill certs are
                  attached.
                </p>
              </div>
            </div>

            <Link
              href="/certs"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all shrink-0"
            >
              <span>View Cert Registry</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* THIS MONTH FINANCIAL PERFORMANCE DASHBOARD CARD */}
      {financialSummary && (
        <div className="mb-6 bg-slate-800/60 border border-slate-700 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-400 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">
                  This Month Financial Performance
                </h3>
                <p className="text-base sm:text-lg font-black text-white flex items-center gap-3 flex-wrap mt-0.5 font-mono">
                  <span>
                    Revenue:{" "}
                    <strong className="text-blue-400">
                      â‚¹{financialSummary.revenue.toLocaleString()}
                    </strong>
                  </span>
                  <span className="text-slate-700">â€¢</span>
                  <span>
                    Cost:{" "}
                    <strong className="text-slate-600 text-slate-300">
                      â‚¹{financialSummary.cost.toLocaleString()}
                    </strong>
                  </span>
                  <span className="text-slate-700">â€¢</span>
                  <span>
                    Margin:{" "}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black border ${
                        financialSummary.margin < 0
                          ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 text-rose-300 dark:border-rose-900"
                          : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 text-emerald-300 dark:border-emerald-900"
                      }`}
                    >
                      {financialSummary.margin}%
                    </span>
                  </span>
                </p>
              </div>
            </div>

            <Link
              href="/reports/profitability"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 rounded-xl hover:bg-blue-100 hover:bg-blue-900/60 transition-all shrink-0"
            >
              <span>View Profitability Report</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* RECEIVABLES & PAYABLES DASHBOARD CARD */}
      {(receivablesSummary || payablesSummary) && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {receivablesSummary && receivablesSummary.totalOutstanding > 0 && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-400 rounded-xl">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">
                      Accounts Receivable (A/R)
                    </h3>
                    <p className="text-xl font-black text-white font-mono mt-0.5">
                      Total Outstanding:{" "}
                      <span className="text-blue-400">
                        â‚¹
                        {receivablesSummary.totalOutstanding.toLocaleString(
                          "en-IN",
                        )}
                      </span>
                    </p>
                  </div>
                </div>
                <Link
                  href="/reports/receivables"
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-800/60 text-slate-300 hover:bg-slate-700 rounded-xl shadow-sm transition-all shrink-0"
                >
                  <span>View A/R Report</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-600/50 flex flex-col justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">
                    0 - 30 Days
                  </span>
                  <span className="font-mono font-bold text-slate-200 mt-1">
                    â‚¹{receivablesSummary.bucket0_30.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-600/50 flex flex-col justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">
                    31 - 60 Days
                  </span>
                  <span className="font-mono font-bold text-slate-200 mt-1">
                    â‚¹{receivablesSummary.bucket31_60.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/40 flex flex-col justify-between">
                  <span className="text-xs font-bold text-amber-500 uppercase">
                    61 - 90 Days
                  </span>
                  <span className="font-mono font-bold text-amber-400 mt-1">
                    â‚¹{receivablesSummary.bucket61_90.toLocaleString("en-IN")}
                  </span>
                </div>
                <div
                  className={`p-3 rounded-xl border flex flex-col justify-between ${receivablesSummary.bucket90Plus > 0 ? "bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 animate-pulse" : "bg-slate-800/60 border-slate-600/50"}`}
                >
                  <div className="flex justify-between items-start">
                    <span
                      className={`text-xs font-bold uppercase ${receivablesSummary.bucket90Plus > 0 ? "text-rose-400" : "text-slate-500"}`}
                    >
                      &gt; 90 Days
                    </span>
                    {receivablesSummary.bucket90Plus > 0 && (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    )}
                  </div>
                  <span
                    className={`font-mono font-bold mt-1 ${receivablesSummary.bucket90Plus > 0 ? "text-rose-300" : "text-slate-200"}`}
                  >
                    â‚¹{receivablesSummary.bucket90Plus.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>
          )}

          {payablesSummary && payablesSummary.totalOutstanding > 0 && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 text-rose-400 rounded-xl">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">
                      Accounts Payable (A/P)
                    </h3>
                    <p className="text-xl font-black text-white font-mono mt-0.5">
                      Total Outstanding:{" "}
                      <span className="text-rose-400">
                        â‚¹
                        {payablesSummary.totalOutstanding.toLocaleString(
                          "en-IN",
                        )}
                      </span>
                    </p>
                  </div>
                </div>
                <Link
                  href="/commercial/desk"
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-800/60 text-slate-300 hover:bg-slate-700 rounded-xl shadow-sm transition-all shrink-0"
                >
                  <span>Pay Suppliers</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="pt-2">
                <p className="text-sm text-slate-400">
                  Total amount owed to suppliers for received goods. Clear these
                  to maintain healthy supplier relations.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ENERGY SUMMARY DASHBOARD CARD */}
      {energySummary && energySummary.totalCost > 0 && (
        <div className="mb-6 bg-slate-800/60 border border-slate-700 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-400 rounded-xl">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">
                  Energy Consumption (This Month)
                </h3>
                <p className="text-base sm:text-lg font-black text-white flex items-center gap-3 flex-wrap mt-0.5 font-mono">
                  <span>
                    Total:{" "}
                    <strong className="text-cyan-400">
                      â‚¹
                      {energySummary.totalCost.toLocaleString("en-IN", {
                        maximumFractionDigits: 0,
                      })}
                    </strong>
                  </span>
                  <span className="text-slate-700">â€¢</span>
                  <span>
                    Per Machine Hr:{" "}
                    <strong className="text-slate-600 text-slate-300">
                      â‚¹
                      {energySummary.perMachineHour.toLocaleString("en-IN", {
                        maximumFractionDigits: 1,
                      })}
                    </strong>
                  </span>
                </p>
              </div>
            </div>

            <Link
              href="/system/admin?tab=energy"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800/80 rounded-xl hover:bg-cyan-100 hover:bg-cyan-900/60 transition-all shrink-0"
            >
              <span>View Energy Readings</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* COMPLIANCE & SAFETY ALERTS WIDGET */}
      {complianceAlerts && complianceAlerts.length > 0 && (
        <div className="mb-6 bg-rose-50/50 dark:bg-rose-950/20 border-2 border-rose-200 dark:border-rose-900/50 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rose-200/50 dark:border-rose-800/50 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-900/60 text-rose-400 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-rose-400">
                  Compliance & Safety Alerts
                </h3>
                <p className="text-sm font-medium text-rose-600/80 text-rose-300/80 mt-0.5">
                  Operators with expired or soon-to-expire machine
                  certifications.
                </p>
              </div>
            </div>

            <Link
              href="/system/admin?tab=certifications"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-rose-300 bg-rose-100 dark:bg-rose-900/50 border border-rose-200 dark:border-rose-800/80 rounded-xl hover:bg-rose-200 hover:bg-rose-800/60 transition-all shrink-0"
            >
              <span>Manage Certifications</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {complianceAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border flex flex-col gap-2 ${
                  alert.isExpired
                    ? "bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 shadow-[0_0_10px_rgba(225,29,72,0.1)]"
                    : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white truncate">
                    {alert.operatorName}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded ${
                      alert.isExpired
                        ? "bg-rose-600 text-white"
                        : "bg-amber-500 text-white"
                    }`}
                  >
                    {alert.isExpired ? "Expired" : "Expiring"}
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-400">
                  Machine:{" "}
                  <strong className="text-white">{alert.machineCode}</strong>
                </div>
                <div className="text-xs text-slate-500">
                  Valid Until:{" "}
                  {alert.validUntil
                    ? new Date(alert.validUntil).toLocaleDateString()
                    : "N/A"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CORPORATE COMPLIANCE RED-FLAG STRIP */}
      {complianceFlags.length > 0 && (
        <div className="mb-6 bg-rose-50/60 dark:bg-rose-950/20 border-2 border-rose-200 dark:border-rose-900/60 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rose-200/50 dark:border-rose-800/50 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-900/60 text-rose-400 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-rose-400">
                  Corporate Compliance Flags
                </h3>
                <p className="text-sm font-medium text-rose-600/80 text-rose-300/80 mt-0.5">
                  {complianceFlags.length} item
                  {complianceFlags.length === 1 ? "" : "s"} need attention
                  across the organisation â€” permits, backups, spares,
                  contracts.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {complianceFlags.slice(0, 8).map((flag) => (
              <Link
                key={flag.id}
                href={flag.href}
                className={`p-3.5 rounded-xl border flex flex-col gap-1.5 transition-all hover:scale-[1.02] ${
                  flag.severity === "critical"
                    ? "bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 shadow-[0_0_10px_rgba(225,29,72,0.1)]"
                    : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {flag.category}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded ${
                      flag.severity === "critical"
                        ? "bg-rose-600 text-white"
                        : "bg-amber-500 text-white"
                    }`}
                  >
                    {flag.severity === "critical" ? "Critical" : "Warning"}
                  </span>
                </div>
                <div className="text-xs font-bold text-white leading-snug line-clamp-2">
                  {flag.label}
                </div>
                {flag.detail && (
                  <div className="text-[11px] text-slate-400 truncate">
                    {flag.detail}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* METROLOGY & NADCAP COMPLIANCE WIDGET */}
      {((calibrationStats &&
        (calibrationStats.expiredCount > 0 ||
          calibrationStats.expiringCount > 0)) ||
        (specialProcessStats &&
          specialProcessStats.expiredVendorsCount > 0)) && (
        <div className="mb-6 bg-teal-50/50 dark:bg-teal-950/20 border-2 border-teal-200 dark:border-teal-900/50 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-teal-200/50 dark:border-teal-800/50 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-100 dark:bg-teal-900/60 text-teal-400 rounded-xl">
                <Gauge className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-teal-400">
                  Metrology & Nadcap Compliance
                </h3>
                <p className="text-sm font-medium text-teal-600/80 text-teal-300/80 mt-0.5">
                  Calibrated tooling and outsourced special-process vendor
                  certificates.
                </p>
              </div>
            </div>

            <Link
              href="/system/admin?tab=metrology"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-teal-300 bg-teal-100 dark:bg-teal-900/50 border border-teal-200 dark:border-teal-800/80 rounded-xl hover:bg-teal-200 hover:bg-teal-800/60 transition-all shrink-0"
            >
              <span>Manage Metrology</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl border bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 shadow-[0_0_10px_rgba(225,29,72,0.1)]">
              <div className="text-xs font-bold uppercase tracking-wider text-rose-400">
                Expired Tools
              </div>
              <div className="text-3xl font-black font-mono text-rose-400 mt-1">
                {calibrationStats?.expiredCount || 0}
              </div>
              <div className="text-[11px] text-rose-500/80 mt-1">
                Inspections hard-blocked on these
              </div>
            </div>
            <div className="p-4 rounded-xl border bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Expiring &lt; 30 Days
              </div>
              <div className="text-3xl font-black font-mono text-amber-400 mt-1">
                {calibrationStats?.expiringCount || 0}
              </div>
              <div className="text-[11px] text-amber-600/80 text-amber-500/80 mt-1">
                Recalibrate soon
              </div>
            </div>
            <div className="p-4 rounded-xl border bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800">
              <div className="text-xs font-bold uppercase tracking-wider text-rose-400">
                Expired Vendor Certs
              </div>
              <div className="text-3xl font-black font-mono text-rose-400 mt-1">
                {specialProcessStats?.expiredVendorsCount || 0}
              </div>
              <div className="text-[11px] text-rose-500/80 mt-1">
                Dispatch blocked to these vendors
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUALITY MRB WIDGET */}
      {((mrbSummary &&
        (mrbSummary.openCount > 0 || mrbSummary.reviewCount > 0)) ||
        (awaitingInspectorCount !== undefined &&
          awaitingInspectorCount > 0)) && (
        <div className="mb-6 bg-indigo-50/50 dark:bg-indigo-950/20 border-2 border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-200/50 dark:border-indigo-800/50 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-400 rounded-xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-indigo-400">
                  Quality & MRB Alerts
                </h3>
                <p className="text-sm font-medium text-indigo-600/80 text-indigo-300/80 mt-0.5">
                  Action required on open Non-Conformance Reports and Hold
                  Points.
                </p>
              </div>
            </div>

            <Link
              href="/mrb"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800/80 rounded-xl hover:bg-indigo-200 hover:bg-indigo-800/60 transition-all shrink-0"
            >
              <span>Go to MRB Kanban</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4`}>
            {mrbSummary && (
              <>
                <div className="p-4 rounded-xl border flex flex-col gap-2 bg-indigo-100 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800">
                  <span className="font-bold text-white uppercase text-xs">
                    Open NCRs
                  </span>
                  <span className="text-2xl font-black text-indigo-400 font-mono">
                    {mrbSummary.openCount}
                  </span>
                </div>
                <div className="p-4 rounded-xl border flex flex-col gap-2 bg-purple-100 dark:bg-purple-950/60 border-purple-300 dark:border-purple-800">
                  <span className="font-bold text-white uppercase text-xs">
                    Under Review
                  </span>
                  <span className="text-2xl font-black text-purple-400 font-mono">
                    {mrbSummary.reviewCount}
                  </span>
                </div>
              </>
            )}
            {awaitingInspectorCount !== undefined && (
              <div className="p-4 rounded-xl border flex flex-col gap-2 bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800">
                <span className="font-bold text-white uppercase text-xs">
                  Awaiting Inspector
                </span>
                <span className="text-2xl font-black text-amber-400 font-mono">
                  {awaitingInspectorCount}
                </span>
              </div>
            )}
            {pendingEcoCount !== undefined && (
              <Link
                href="/eco"
                className="p-4 rounded-xl border flex flex-col gap-2 bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-200 hover:bg-emerald-900/80 transition-colors"
              >
                <span className="font-bold text-white uppercase text-xs">
                  Pending ECOs
                </span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {pendingEcoCount}
                </span>
              </Link>
            )}
          </div>
        </div>
      )}

      {currentSections.digest && <CollapsibleDigestCard digest={digestData} />}

      {sortedCards.length > 0 && (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.1 } },
          }}
        >
          {sortedCards.map((card) => (
            <motion.div
              key={card.id}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.4, ease: "easeOut" },
                },
              }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="hover:shadow-[0_4px_20px_rgba(59,130,246,0.15)] transition-shadow rounded-xl"
            >
              {renderKpiCard(card)}
            </motion.div>
          ))}
        </motion.div>
      )}

      {currentSections.championTeaser && champion && (
        <Link href="/people/leaderboard" className="block group mb-6">
          <div className="p-4 bg-accent/10 border border-accent/20 dark:bg-accent-900/20 dark:border-accent-500/30 rounded-xl shadow-sm flex items-center justify-between transition-colors group-hover:bg-accent/20 group-hover:border-accent/40 var-accent-bg var-accent-border">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-accent text-white rounded-full shadow-md var-accent-bg">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-accent-300 uppercase tracking-wider mb-0.5 var-accent-text">
                  Current Champion
                </p>
                <p className="text-lg font-black text-white">
                  {champion.name}{" "}
                  <span className="text-sm font-medium text-slate-400 font-normal ml-1">
                    (Score: {champion.score?.toFixed(0)})
                  </span>
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-accent-400 group-hover:translate-x-1 transition-transform var-accent-text" />
          </div>
        </Link>
      )}

      {/* 5S SUMMARY CARD */}
      {fiveSSummary && (fiveSSummary.best || fiveSSummary.worst) && (
        <Link href="/system/fives" className="block group mb-6">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 dark:bg-emerald-950/30 rounded-xl shadow-sm flex items-center justify-between transition-colors hover:border-emerald-500">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-md">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-300 uppercase tracking-wider mb-0.5">
                  5S Audits This Week
                </p>
                <p className="text-sm font-bold text-white font-mono">
                  {fiveSSummary.best ? (
                    <>
                      Best:{" "}
                      <strong className="text-emerald-400">
                        {fiveSSummary.best.area} ({fiveSSummary.best.pct}%)
                      </strong>
                    </>
                  ) : null}
                  {fiveSSummary.best && fiveSSummary.worst ? " | " : ""}
                  {fiveSSummary.worst ? (
                    <>
                      Needs Work:{" "}
                      <strong className="text-amber-400">
                        {fiveSSummary.worst.area} ({fiveSSummary.worst.pct}%)
                      </strong>
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-emerald-500 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      )}

      {/* MAINTENANCE SUMMARY CARD */}
      <MaintenanceCard />

      <DashboardMachineCards machines={machines} />

      <DashboardCharts
        machines={machines}
        oeeTrends={oeeTrends}
        downtimeByCategory={downtimeByCategory}
        visibleSections={currentSections}
      />

      {currentSections.recentDowntime && <DashboardRecentLogs />}

      <DashboardCustomizer
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        prefs={prefs}
        onUpdatePrefs={handleUpdatePrefs}
      />
    </>
  );
}
