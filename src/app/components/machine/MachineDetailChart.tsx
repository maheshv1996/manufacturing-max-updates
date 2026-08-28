"use client";

import { useState, useEffect } from "react";
import { LineChart as LineChartIcon } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { OEEEntry } from "@/lib/data";

interface Props {
  oeeEntries: OEEEntry[];
  machineCode: string;
}

export default function MachineDetailChart({ oeeEntries, machineCode }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const chartData = oeeEntries.map((e) => ({
    date: new Date(e.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    oee: Number((e.oee * 100).toFixed(1)),
    availability: Number((e.availability * 100).toFixed(1)),
    performance: Number((e.performance * 100).toFixed(1)),
    quality: Number((e.quality * 100).toFixed(1)),
  }));

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-700 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <LineChartIcon className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold text-white">7-Day OEE Trend</h2>
        </div>
        <span className="text-xs text-slate-400">
          Historical Daily Performance ({machineCode})
        </span>
      </div>

      <div className="h-72 w-full">
        {mounted && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
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
              <Line
                type="monotone"
                dataKey="oee"
                name="OEE"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-slate-400">
            Loading trend chart...
          </div>
        )}
      </div>
    </div>
  );
}
