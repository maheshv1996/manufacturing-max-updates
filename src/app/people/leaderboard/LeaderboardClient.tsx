"use client";

import PageHeader from "@/app/components/shared/PageHeader";

import {useState } from "react";
import { LeaderboardData, LeaderboardEntry } from "@/lib/leaderboardData";
import { Trophy, Medal, ArrowUp, ArrowDown,
  Users
} from "lucide-react";

type Tab = "shifts" | "machines" | "operators" | "plants";

export default function LeaderboardClient({ data }: { data: LeaderboardData }) {
  const [activeTab, setActiveTab] = useState<Tab>("shifts");

  const renderDelta = (delta?: number) => {
    if (delta === undefined || delta === 0) return null;
    const isUp = delta > 0;
    return (
      <span
        className={`inline-flex items-center text-xs font-bold ${isUp ? "text-emerald-500" : "text-rose-500"}`}
      >
        {isUp ? (
          <ArrowUp className="w-3 h-3 mr-0.5" />
        ) : (
          <ArrowDown className="w-3 h-3 mr-0.5" />
        )}
        {Math.abs(delta).toFixed(1)}
      </span>
    );
  };

  const getEntries = (): LeaderboardEntry[] => {
    if (activeTab === "shifts") return data.shifts;
    if (activeTab === "machines") return data.machines;
    if (activeTab === "plants") return data.plants;
    return data.operators;
  };

  const entries = getEntries();
  const top3 = entries.slice(0, 3);

  const getMedalColor = (rank: number) => {
    if (rank === 1)
      return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
    if (rank === 2) return "text-slate-400 bg-slate-400/10 border-slate-400/20";
    if (rank === 3) return "text-amber-600 bg-amber-600/10 border-amber-600/20";
    return "";
  };

  const isOperator = activeTab === "operators";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Leaderboard"
        description="Roster, attendance, leave and workforce operations."
        icon={<Users className="w-6 h-6" />}
        iconTone="violet"
      />

      {/* Tabs */}
      <div className="flex border-b border-slate-700 overflow-x-auto">
        {(["shifts", "machines", "operators", "plants"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === tab
                ? "border-accent-500 text-accent-400"
                : "border-transparent text-slate-500 hover:text-slate-700 text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Podium */}
      {top3.length > 0 && (
        <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-8 min-h-[250px]">
          {/* 2nd Place */}
          {top3[1] && (
            <div className="w-full md:w-1/3 max-w-[250px] bg-slate-800/60 border border-slate-700 rounded-t-xl p-6 text-center transform translate-y-4 shadow-lg">
              <div
                className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center border-2 mb-4 ${getMedalColor(2)}`}
              >
                <Medal className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white truncate">
                {top3[1].name}
              </h3>
              <div className="mt-2 text-2xl font-black text-slate-300">
                {isOperator
                  ? top3[1].score?.toFixed(0)
                  : `${top3[1].oee?.toFixed(1)}%`}
              </div>
              <div className="mt-1 flex justify-center">
                {renderDelta(
                  isOperator ? top3[1].scoreDelta : top3[1].oeeDelta,
                )}
              </div>
            </div>
          )}

          {/* 1st Place */}
          {top3[0] && (
            <div className="w-full md:w-1/3 max-w-[280px] bg-slate-800/60 border-2 border-yellow-400/50 rounded-t-xl p-8 text-center shadow-xl relative z-10">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center border-2 shadow-lg bg-slate-800/60 ${getMedalColor(1)}`}
                >
                  <Trophy className="w-7 h-7" />
                </div>
              </div>
              <h3 className="font-bold text-xl text-white mt-4 truncate">
                {top3[0].name}
              </h3>
              <p className="text-xs text-yellow-400 font-bold uppercase tracking-wider mb-2">
                Champion
              </p>
              <div className="text-4xl font-black text-white">
                {isOperator
                  ? top3[0].score?.toFixed(0)
                  : `${top3[0].oee?.toFixed(1)}%`}
              </div>
              <div className="mt-2 flex justify-center">
                {renderDelta(
                  isOperator ? top3[0].scoreDelta : top3[0].oeeDelta,
                )}
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {top3[2] && (
            <div className="w-full md:w-1/3 max-w-[250px] bg-slate-800/60 border border-slate-700 rounded-t-xl p-6 text-center transform translate-y-8 shadow-lg">
              <div
                className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center border-2 mb-4 ${getMedalColor(3)}`}
              >
                <Medal className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white truncate">
                {top3[2].name}
              </h3>
              <div className="mt-2 text-2xl font-black text-slate-300">
                {isOperator
                  ? top3[2].score?.toFixed(0)
                  : `${top3[2].oee?.toFixed(1)}%`}
              </div>
              <div className="mt-1 flex justify-center">
                {renderDelta(
                  isOperator ? top3[2].scoreDelta : top3[2].oeeDelta,
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/60 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                <th className="p-4 w-20 text-center">Rank</th>
                <th className="p-4">Name</th>
                <th className="p-4 text-right">
                  {isOperator ? "Score" : "Avg OEE"}
                </th>
                <th className="p-4 text-right">Output</th>
                <th className="p-4 text-right">Scrap %</th>
                {!isOperator && (
                  <th className="p-4 text-right">Downtime (hrs)</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="hover:bg-slate-800/90/25 transition-colors"
                >
                  <td className="p-4 text-center">
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                        entry.rank <= 3
                          ? "bg-slate-800/60 text-white"
                          : "text-slate-400"
                      }`}
                    >
                      {entry.rank}
                    </span>
                  </td>
                  <td className="p-4 font-medium text-white">{entry.name}</td>
                  <td className="p-4 text-right">
                    <div className="font-bold text-white flex items-center justify-end gap-2">
                      {isOperator
                        ? entry.score?.toFixed(0)
                        : `${entry.oee?.toFixed(1)}%`}
                      {renderDelta(
                        isOperator ? entry.scoreDelta : entry.oeeDelta,
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-right text-slate-600 text-slate-300">
                    {entry.totalOutput.toLocaleString()}
                  </td>
                  <td className="p-4 text-right text-slate-600 text-slate-300">
                    {entry.scrapPct.toFixed(1)}%
                  </td>
                  {!isOperator && (
                    <td className="p-4 text-right text-slate-600 text-slate-300">
                      {entry.downtimeHours?.toFixed(1)}
                    </td>
                  )}
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No data available for the selected period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
