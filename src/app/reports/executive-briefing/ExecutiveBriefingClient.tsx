"use client";

import { useState, useEffect } from "react";
import { Printer, RefreshCw } from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface MetricItem {
  label: string;
  value: string;
  target: string;
  change: string;
  status: string;
}

interface WaterfallItem {
  stage: string;
  amount: number;
  pct: number;
}

interface DeptScorecard {
  department: string;
  health: string;
  owner: string;
  status: string;
  highlight: string;
}

interface ExecutiveData {
  reportTitle: string;
  reportingPeriod: string;
  generatedAt: string;
  executiveSummary: string;
  keyMetrics: MetricItem[];
  marginWaterfall: WaterfallItem[];
  departmentScorecard: DeptScorecard[];
}

export default function ExecutiveBriefingClient() {
  const [data, setData] = useState<ExecutiveData | null>(null);
  const [_loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/reports/executive-briefing");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load executive briefing:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 print:p-0 print:m-0">
      <div className="print:hidden">
        <PageHeader
          title="Executive Boardroom Monthly Performance Briefing"
          description="Consolidated executive report: Financial margin waterfalls, plant composite OEE, AS9102 aerospace quality yield, and department health scorecards."
        >
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md cursor-pointer transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Board Pack
            </button>
            <button
              onClick={fetchData}
              className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text-2 hover:text-text-1 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </PageHeader>
      </div>

      {data && (
        <div className="space-y-6">
          {/* Executive Summary Card */}
          <div className="bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <span className="text-[10px] font-bold text-accent uppercase tracking-widest font-mono block">
                  CONFIDENTIAL EXECUTIVE BRIEFING
                </span>
                <h2 className="text-xl font-black text-text-1">
                  {data.reportTitle}
                </h2>
              </div>
              <span className="text-xs font-mono text-text-3 font-semibold">
                Period: {data.reportingPeriod}
              </span>
            </div>
            <p className="text-xs text-text-2 leading-relaxed">
              {data.executiveSummary}
            </p>
          </div>

          {/* Key Metric Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {data.keyMetrics.map((m, idx) => (
              <div
                key={idx}
                className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm space-y-1"
              >
                <span className="text-xs font-bold uppercase tracking-wider text-text-3 block">
                  {m.label}
                </span>
                <div className="text-2xl font-black font-mono text-text-1">
                  {m.value}
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono pt-1">
                  <span className="text-text-3">Target: {m.target}</span>
                  <span className="text-emerald-400 font-bold">{m.change}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Contribution Margin Waterfall */}
          <div className="bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-text-1">
                  Plant Contribution Margin Waterfall
                </h3>
                <p className="text-xs text-text-3">
                  Standard vs direct cost absorption breakdown
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                Net Margin: 35.2%
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-border/80 text-text-3 uppercase text-[10px]">
                    <th className="py-2.5 px-3">
                      Cost Component / Absorption Stage
                    </th>
                    <th className="py-2.5 px-3 text-right">Amount (USD)</th>
                    <th className="py-2.5 px-3 text-right">% of Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {data.marginWaterfall.map((stage, idx) => {
                    const isTotal =
                      stage.amount > 0 &&
                      idx === data.marginWaterfall.length - 1;
                    const isPositive = stage.amount > 0;

                    return (
                      <tr
                        key={idx}
                        className={
                          isTotal
                            ? "bg-emerald-500/10 font-bold"
                            : "hover:bg-surface-2/50"
                        }
                      >
                        <td className="py-3 px-3 text-text-1">{stage.stage}</td>
                        <td
                          className={`py-3 px-3 text-right font-black ${
                            isTotal
                              ? "text-emerald-400 text-sm"
                              : isPositive
                                ? "text-text-1"
                                : "text-rose-400"
                          }`}
                        >
                          {stage.amount < 0
                            ? `-$${Math.abs(stage.amount).toLocaleString()}`
                            : `$${stage.amount.toLocaleString()}`}
                        </td>
                        <td
                          className={`py-3 px-3 text-right ${
                            isTotal
                              ? "text-emerald-400"
                              : isPositive
                                ? "text-text-2"
                                : "text-rose-400"
                          }`}
                        >
                          {stage.pct > 0 ? `+${stage.pct}%` : `${stage.pct}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Department Performance Scorecard */}
          <div className="bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-extrabold text-base text-text-1">
              Department Operational Scorecard
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.departmentScorecard.map((dept, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-surface-2 border border-border/70 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text-1 text-xs">
                      {dept.department}
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                      Health: {dept.health}
                    </span>
                  </div>
                  <p className="text-xs text-text-3 leading-relaxed">
                    {dept.highlight}
                  </p>
                  <div className="text-[10px] text-text-3 font-mono">
                    Owner: {dept.owner}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
