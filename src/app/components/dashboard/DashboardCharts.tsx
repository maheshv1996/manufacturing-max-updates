"use client";

import { useState, useEffect } from "react";
import { LineChart as LineChartIcon, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import { Machine, OeeTrendRow, DowntimeCategoryRow } from "@/lib/data";

const MACHINE_COLORS: Record<string, string> = {
  "CNC-01": "#3b82f6", // Vibrant Blue
  "IMM-02": "#10b981", // Emerald Green
  "ROB-03": "#a855f7", // Purple
};

const CATEGORY_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#64748b",
];

interface Props {
  machines: Machine[];
  oeeTrends: OeeTrendRow[];
  downtimeByCategory: DowntimeCategoryRow[];
  visibleSections: any;
}

export default function DashboardCharts({
  machines,
  oeeTrends,
  downtimeByCategory,
  visibleSections,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. 7-DAY OEE TREND LINE CHART */}
      {visibleSections?.oeeTrend !== false && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between border-b border-slate-700 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <LineChartIcon className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold text-white">7-Day OEE Trend</h2>
            </div>
            <span className="text-xs text-slate-400">OEE % per machine</span>
          </div>

          <div className="h-72 w-full">
            {mounted && oeeTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={oeeTrends}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                  />
                  <YAxis
                    domain={[60, 100]}
                    unit="%"
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "0.75rem",
                      color: "#f8fafc",
                      fontSize: "12px",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                    }}
                    formatter={(val: any) => [`${val}%`, "OEE"]}
                  />
                  <Legend
                    wrapperStyle={{
                      paddingTop: "12px",
                      fontSize: "12px",
                    }}
                  />
                  {machines.map((m) => (
                    <Line
                      key={m.code}
                      type="monotone"
                      dataKey={m.code}
                      name={m.code}
                      stroke={MACHINE_COLORS[m.code] || "#3b82f6"}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                Loading chart...
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* 2. DOWNTIME BY CATEGORY BAR CHART */}
      {visibleSections?.downtimePareto !== false && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
          className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between border-b border-slate-700 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white">
                Downtime by Category
              </h2>
            </div>
            <span className="text-xs text-slate-400">Total Hours Logged</span>
          </div>

          <div className="h-72 w-full">
            {mounted && downtimeByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={downtimeByCategory}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="category"
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                    interval={0}
                  />
                  <YAxis
                    unit="h"
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "0.75rem",
                      color: "#f8fafc",
                      fontSize: "12px",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                    }}
                    formatter={(val: any) => [`${val} hrs`, "Downtime"]}
                  />
                  <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                    {downtimeByCategory.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          CATEGORY_COLORS[index % CATEGORY_COLORS.length] ||
                          "#3b82f6"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                Loading chart...
              </div>
            )}
          </div>
        </motion.div>
      )}
    </section>
  );
}
