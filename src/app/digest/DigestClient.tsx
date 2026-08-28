"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Coffee,
  Factory,
  CheckCircle2,
  PauseCircle,
  Award,
  ClipboardList,
} from "lucide-react";
import { format, parseISO, addDays, subDays } from "date-fns";
import { DigestData } from "@/lib/digestData";

export default function DigestClient({
  initialData,
  currentDateStr,
}: {
  initialData: DigestData;
  currentDateStr: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const currentDate = parseISO(currentDateStr);

  const handleDateChange = (dateStr: string) => {
    router.push(`/digest?date=${dateStr}`);
  };

  const handlePrevDay = () => {
    handleDateChange(format(subDays(currentDate, 1), "yyyy-MM-dd"));
  };

  const handleNextDay = () => {
    handleDateChange(format(addDays(currentDate, 1), "yyyy-MM-dd"));
  };

  const handleCopy = () => {
    const oeeArrow = initialData.oeeDelta >= 0 ? "â–²" : "â–¼";
    const best = initialData.bestMachine
      ? `ðŸ¥‡ ${initialData.bestMachine.name} ${initialData.bestMachine.oee.toFixed(1)}%`
      : "";
    const worst = initialData.worstMachine
      ? ` | âš ï¸ ${initialData.worstMachine.name} ${initialData.worstMachine.oee.toFixed(1)}%`
      : "";
    const topReason = initialData.topDowntimeReason
      ? ` - top: ${initialData.topDowntimeReason}`
      : "";

    const text = `ðŸ­ ${initialData.plantName} - ${format(currentDate, "dd MMM")}
OEE ${initialData.oee.toFixed(1)}% (${oeeArrow}${Math.abs(initialData.oeeDelta).toFixed(1)})
âœ… ${initialData.totalGood.toLocaleString()} good / ${initialData.totalScrap.toLocaleString()} scrap
â¸ï¸ ${initialData.totalDowntimeMin} min downtime${topReason}
${best}${worst}
ðŸ“‹ ${initialData.openWorkOrders} work orders open`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-accent/10 dark:bg-accent-900/30 text-accent-400 rounded-xl var-accent-text var-accent-bg">
            <Coffee className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Morning Digest
            </h1>
            <p className="text-slate-400 font-medium">
              Quick summary of yesterday's performance
            </p>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm transition-colors"
        >
          {copied ? (
            <Check className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          {copied ? "Copied!" : "Copy for WhatsApp"}
        </button>
      </div>

      <div className="flex items-center justify-between p-4 bg-slate-800/60 border border-slate-700 rounded-xl shadow-sm mb-6">
        <button
          onClick={handlePrevDay}
          className="p-2 hover:bg-slate-800/90 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={currentDateStr}
            onChange={(e) => handleDateChange(e.target.value)}
            className="px-3 py-1.5 border border-slate-600 rounded-lg bg-transparent font-medium"
          />
        </div>
        <button
          onClick={handleNextDay}
          className="p-2 hover:bg-slate-800/90 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Plant Overview Card */}
        <div className="p-6 bg-slate-800/60 border-2 border-accent/20 dark:border-accent-800/50 rounded-xl shadow-sm var-accent-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Factory className="w-5 h-5 text-accent-400 var-accent-text" />
              <h2 className="text-lg font-bold text-white">
                {initialData.plantName}
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Plant OEE
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">
                  {initialData.oee.toFixed(1)}%
                </span>
                <span
                  className={`text-sm font-bold ${initialData.oeeDelta >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                >
                  {initialData.oeeDelta >= 0 ? "â–²" : "â–¼"}
                  {Math.abs(initialData.oeeDelta).toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 bg-slate-800/60 border border-slate-700 rounded-xl shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <h3 className="font-bold text-white">Output</h3>
            </div>
            <p className="text-2xl font-bold text-white">
              {initialData.totalGood.toLocaleString()}{" "}
              <span className="text-sm font-semibold text-slate-500">good</span>
            </p>
            <p className="text-lg font-semibold text-rose-500 mt-1">
              {initialData.totalScrap.toLocaleString()}{" "}
              <span className="text-sm text-rose-400">scrap</span>
            </p>
          </div>

          <div className="p-5 bg-slate-800/60 border border-slate-700 rounded-xl shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <PauseCircle className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-white">Downtime</h3>
            </div>
            <p className="text-2xl font-bold text-white">
              {initialData.totalDowntimeMin}{" "}
              <span className="text-sm font-semibold text-slate-500">
                min total
              </span>
            </p>
            {initialData.topDowntimeReason && (
              <p className="text-sm font-medium text-amber-400 mt-2 bg-amber-50 dark:bg-amber-950/50 p-2 rounded-lg inline-block">
                Top Reason: {initialData.topDowntimeReason}
              </p>
            )}
          </div>

          <div className="p-5 bg-slate-800/60 border border-slate-700 rounded-xl shadow-sm md:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Award className="w-5 h-5 text-blue-500" />
                  <h3 className="font-bold text-white">Machine Performance</h3>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Best
                    </p>
                    <p className="text-lg font-bold text-emerald-400">
                      ðŸ¥‡{" "}
                      {initialData.bestMachine
                        ? `${initialData.bestMachine.name} (${initialData.bestMachine.oee.toFixed(1)}%)`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Worst
                    </p>
                    <p className="text-lg font-bold text-rose-400">
                      âš ï¸{" "}
                      {initialData.worstMachine
                        ? `${initialData.worstMachine.name} (${initialData.worstMachine.oee.toFixed(1)}%)`
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 bg-slate-800/60 border border-slate-700 rounded-xl shadow-sm md:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-slate-500" />
                <h3 className="font-bold text-white">Work Orders</h3>
              </div>
            </div>
            <p className="text-2xl font-bold text-white">
              {initialData.openWorkOrders}{" "}
              <span className="text-sm font-semibold text-slate-500">open</span>
            </p>
          </div>
        </div>

        {initialData.attentionNeeded.length > 0 && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl">
            <h3 className="font-bold text-rose-300 mb-2">Requires Attention</h3>
            <p className="text-sm text-rose-400 font-medium">
              The following machines missed their OEE targets or had &gt; 60m
              downtime:
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {initialData.attentionNeeded.map((name) => (
                <span
                  key={name}
                  className="px-2 py-1 bg-rose-900/50 text-rose-300 font-bold text-xs rounded-md shadow-sm border border-rose-800"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
