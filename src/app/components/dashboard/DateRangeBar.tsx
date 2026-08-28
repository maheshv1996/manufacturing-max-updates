"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";
import { useState } from "react";

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "Monthly" },
  { value: "90d", label: "Quarterly" },
  { value: "180d", label: "Half-Yearly" },
  { value: "365d", label: "Yearly" },
];

export default function DateRangeBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentRange =
    searchParams.get("range") || (searchParams.has("from") ? "custom" : "30d");
  const [isCustom, setIsCustom] = useState(currentRange === "custom");
  const [customFrom, setCustomFrom] = useState(searchParams.get("from") || "");
  const [customTo, setCustomTo] = useState(searchParams.get("to") || "");

  const handlePresetClick = (value: string) => {
    setIsCustom(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", value);
    params.delete("from");
    params.delete("to");
    router.push(`?${params.toString()}`);
  };

  const handleCustomApply = () => {
    if (!customFrom || !customTo) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", customFrom);
    params.set("to", customTo);
    params.delete("range");
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-800/60 border border-slate-700 p-3 rounded-xl shadow-sm">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-400 rounded-lg">
          <Calendar className="w-4 h-4" />
        </div>
        <span className="text-sm font-semibold text-slate-300">
          Analysis Period
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => handlePresetClick(preset.value)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              !isCustom && currentRange === preset.value
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "bg-slate-800/60 text-slate-400 hover:bg-slate-200 hover:bg-slate-700"
            }`}
          >
            {preset.label}
          </button>
        ))}

        <button
          onClick={() => setIsCustom(true)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            isCustom
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-slate-800/60 text-slate-400 hover:bg-slate-200 hover:bg-slate-700"
          }`}
        >
          Custom
        </button>

        {isCustom && (
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-600">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="text-xs px-2 py-1.5 bg-slate-800/60 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="text-xs px-2 py-1.5 bg-slate-800/60 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleCustomApply}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-md shadow-sm transition-colors"
            >
              Apply
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
