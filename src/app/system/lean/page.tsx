import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import { Clock, Gauge, ShieldAlert, TrendingUp, Wrench } from "lucide-react";
import { getLeanAnalyticsData } from "@/lib/leanData";
import LeanChartsClient from "./LeanChartsClient";
import DateRangeBar from "@/app/components/dashboard/DateRangeBar";
import { parseDateRange } from "@/lib/date-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LeanAnalyticsPage(props: {
  searchParams?: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/system/lean");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  const searchParams = await props.searchParams;
  const parsedRange = parseDateRange(searchParams || {});

  const leanData = await getLeanAnalyticsData(parsedRange);
  const { kpis } = leanData;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* HEADER SECTION */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-700 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <Gauge className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Lean Six Sigma Analytics
              </h1>
              <p className="text-sm text-slate-400 font-medium">
                Operational Excellence, Process Stability & Quality Control
              </p>
            </div>
          </div>
        </header>

        <DateRangeBar />

        {/* 1. KPI CARD ROW */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* MTTR */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-3xl p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                MTTR (Mean Time to Repair)
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">
                  {kpis.mttrMinutes}{" "}
                  <span className="text-sm font-normal text-slate-500">
                    mins
                  </span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Avg downtime duration per event
              </p>
            </div>
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 text-rose-400 rounded-2xl border border-rose-100 dark:border-rose-900/50">
              <Wrench className="w-7 h-7" />
            </div>
          </div>

          {/* MTBF */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-3xl p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                MTBF (Between Failures)
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">
                  {kpis.mtbfHours}{" "}
                  <span className="text-sm font-normal text-slate-500">
                    hrs
                  </span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Avg operating run time between failures
              </p>
            </div>
            <div className="p-3.5 bg-blue-50 dark:bg-blue-950/50 text-blue-400 rounded-2xl border border-blue-100 dark:border-blue-900/50">
              <Clock className="w-7 h-7" />
            </div>
          </div>

          {/* FIRST PASS YIELD */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-3xl p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                First Pass Yield (FPY)
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">
                  {kpis.firstPassYieldPct}%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {kpis.totalGoodUnits.toLocaleString()} good /{" "}
                {(kpis.totalGoodUnits + kpis.totalScrapUnits).toLocaleString()}{" "}
                total
              </p>
            </div>
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
              <TrendingUp className="w-7 h-7" />
            </div>
          </div>

          {/* SCRAP RATE */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-3xl p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Scrap Rate %
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">
                  {kpis.scrapRatePct}%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {kpis.totalScrapUnits.toLocaleString()} total defective units
              </p>
            </div>
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/50 text-amber-400 rounded-2xl border border-amber-100 dark:border-amber-900/50">
              <ShieldAlert className="w-7 h-7" />
            </div>
          </div>
        </section>

        {/* 2. CHARTS GRID */}
        <LeanChartsClient
          downtimeParetoData={leanData.downtimeParetoData}
          defectParetoData={leanData.defectParetoData}
          controlChartData={leanData.controlChartData}
          fpyTrendData={leanData.fpyTrendData}
          downtimeCategoryData={leanData.downtimeCategoryData}
        />
      </div>
    </div>
  );
}
