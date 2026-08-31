"use client";

import { useState } from "react";
import { computeSpcChart, SpcSubgroup, SpcChartResult } from "@/lib/spcEngine";
import PageHeader from "@/app/components/shared/PageHeader";
import { BarChart3, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from "recharts";

// Realistic 15 Subgroups of CNC Turned Shaft Outer Diameter (Nominal: 25.000 mm, USL: 25.025, LSL: 24.975)
const INITIAL_SUBGROUPS: SpcSubgroup[] = [
  {
    subgroupId: "SG-01",
    timestamp: new Date("2026-08-27T08:00:00Z"),
    values: [25.002, 25.004, 24.998, 25.001, 25.003],
  },
  {
    subgroupId: "SG-02",
    timestamp: new Date("2026-08-27T08:30:00Z"),
    values: [25.005, 25.003, 25.002, 25.004, 25.006],
  },
  {
    subgroupId: "SG-03",
    timestamp: new Date("2026-08-27T09:00:00Z"),
    values: [25.001, 24.999, 25.002, 25.0, 25.003],
  },
  {
    subgroupId: "SG-04",
    timestamp: new Date("2026-08-27T09:30:00Z"),
    values: [25.004, 25.006, 25.005, 25.003, 25.007],
  },
  {
    subgroupId: "SG-05",
    timestamp: new Date("2026-08-27T10:00:00Z"),
    values: [25.006, 25.008, 25.005, 25.007, 25.009],
  },
  {
    subgroupId: "SG-06",
    timestamp: new Date("2026-08-27T10:30:00Z"),
    values: [25.007, 25.009, 25.008, 25.01, 25.008],
  },
  {
    subgroupId: "SG-07",
    timestamp: new Date("2026-08-27T11:00:00Z"),
    values: [25.009, 25.011, 25.01, 25.008, 25.012],
  },
  {
    subgroupId: "SG-08",
    timestamp: new Date("2026-08-27T11:30:00Z"),
    values: [25.01, 25.012, 25.011, 25.013, 25.012],
  },
  {
    subgroupId: "SG-09",
    timestamp: new Date("2026-08-27T12:00:00Z"),
    values: [25.004, 25.002, 25.005, 25.003, 25.004],
  },
  {
    subgroupId: "SG-10",
    timestamp: new Date("2026-08-27T12:30:00Z"),
    values: [25.001, 24.999, 25.002, 25.0, 25.001],
  },
  {
    subgroupId: "SG-11",
    timestamp: new Date("2026-08-27T13:00:00Z"),
    values: [25.003, 25.005, 25.002, 25.004, 25.003],
  },
  {
    subgroupId: "SG-12",
    timestamp: new Date("2026-08-27T13:30:00Z"),
    values: [25.005, 25.007, 25.004, 25.006, 25.005],
  },
  {
    subgroupId: "SG-13",
    timestamp: new Date("2026-08-27T14:00:00Z"),
    values: [25.002, 25.004, 25.001, 25.003, 25.002],
  },
  {
    subgroupId: "SG-14",
    timestamp: new Date("2026-08-27T14:30:00Z"),
    values: [25.0, 24.998, 25.001, 24.999, 25.0],
  },
  {
    subgroupId: "SG-15",
    timestamp: new Date("2026-08-27T15:00:00Z"),
    values: [25.002, 25.004, 25.003, 25.001, 25.003],
  },
];

export default function SpcChartsPageClient() {
  const [usl] = useState<number>(25.025);
  const [lsl] = useState<number>(24.975);

  const spcResult: SpcChartResult | null = computeSpcChart(INITIAL_SUBGROUPS, {
    usl: Number(usl),
    lsl: Number(lsl),
  });

  if (!spcResult) {
    return (
      <div className="p-6 text-red-400">Failed to compute SPC statistics.</div>
    );
  }

  const chartData = spcResult.points.map((p) => ({
    name: p.subgroupId,
    mean: p.mean,
    range: p.range,
    uclXbar: spcResult.uclXbar,
    clXbar: spcResult.clXbar,
    lclXbar: spcResult.lclXbar,
    uclR: spcResult.uclR,
    clR: spcResult.clR,
    lclR: spcResult.lclR,
    violations: p.violations,
  }));

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-1)] p-6 space-y-6">
      <PageHeader
        title="Statistical Process Control (SPC) Metrology Dashboard"
        description="Live X-bar and R control charts, Nelson/Western Electric rules, and automated Cp/Cpk capability index"
        icon={<BarChart3 className="w-5 h-5" />}
        iconTone="cyan"
      />

      {/* Control Limits & Capability Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-xl p-4 shadow">
          <div className="text-xs font-semibold text-blue-400 mb-1">
            PROCESS CAPABILITY (Cpk)
          </div>
          <div className="text-3xl font-bold flex items-baseline gap-2">
            {spcResult.capability?.cpk}
            {spcResult.capability?.isCapable ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                CAPABLE (≥ 1.33)
              </span>
            ) : (
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                NOT CAPABLE
              </span>
            )}
          </div>
          <div className="text-xs text-[var(--text-2)] mt-1">
            Cp: {spcResult.capability?.cp} | PPM:{" "}
            {spcResult.capability?.ppmTotal}
          </div>
        </div>

        <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-xl p-4 shadow">
          <div className="text-xs font-semibold text-cyan-400 mb-1">
            GRAND MEAN (X̄̄)
          </div>
          <div className="text-2xl font-bold">
            {spcResult.grandMeanXbarBar} mm
          </div>
          <div className="text-xs text-[var(--text-2)] mt-1">
            UCL: {spcResult.uclXbar} | LCL: {spcResult.lclXbar}
          </div>
        </div>

        <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-xl p-4 shadow">
          <div className="text-xs font-semibold text-purple-400 mb-1">
            AVERAGE RANGE (R̄)
          </div>
          <div className="text-2xl font-bold">
            {spcResult.averageRangeRbar} mm
          </div>
          <div className="text-xs text-[var(--text-2)] mt-1">
            UCL (Range): {spcResult.uclR} mm
          </div>
        </div>

        <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-xl p-4 shadow">
          <div className="text-xs font-semibold text-amber-400 mb-1">
            ESTIMATED SIGMA (σ̂)
          </div>
          <div className="text-2xl font-bold">
            {spcResult.estimatedSigma} mm
          </div>
          <div className="text-xs text-[var(--text-2)] mt-1">
            {spcResult.subgroupCount} subgroups (n = {spcResult.subgroupSize})
          </div>
        </div>
      </div>

      {/* X-bar Chart */}
      <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-xl p-5 shadow space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-sm text-[var(--text-1)]">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <span>X-bar Chart (Subgroup Averages)</span>
          </div>
          <div className="text-xs text-[var(--text-3)]">
            Nominal: 25.000 mm ± 0.025 mm
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e39" />
              <XAxis dataKey="name" stroke="#8892b0" fontSize={12} />
              <YAxis domain={["auto", "auto"]} stroke="#8892b0" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#141519",
                  borderColor: "#22252c",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#fff", fontWeight: "bold" }}
              />
              <Legend />
              <ReferenceLine
                y={spcResult.uclXbar}
                label="UCL"
                stroke="#ef4444"
                strokeDasharray="3 3"
              />
              <ReferenceLine
                y={spcResult.clXbar}
                label="CL"
                stroke="#10b981"
                strokeDasharray="2 2"
              />
              <ReferenceLine
                y={spcResult.lclXbar}
                label="LCL"
                stroke="#ef4444"
                strokeDasharray="3 3"
              />
              <Line
                type="monotone"
                dataKey="mean"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={{ r: 4, fill: "#38bdf8" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* R Chart (Range) */}
      <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-xl p-5 shadow space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-sm text-[var(--text-1)]">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <span>R Chart (Subgroup Ranges)</span>
          </div>
        </div>

        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e39" />
              <XAxis dataKey="name" stroke="#8892b0" fontSize={12} />
              <YAxis domain={["auto", "auto"]} stroke="#8892b0" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#141519",
                  borderColor: "#22252c",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#fff", fontWeight: "bold" }}
              />
              <Legend />
              <ReferenceLine
                y={spcResult.uclR}
                label="UCL (R)"
                stroke="#f59e0b"
                strokeDasharray="3 3"
              />
              <ReferenceLine
                y={spcResult.clR}
                label="CL (R)"
                stroke="#8b5cf6"
                strokeDasharray="2 2"
              />
              <Line
                type="monotone"
                dataKey="range"
                stroke="#a855f7"
                strokeWidth={2}
                dot={{ r: 4, fill: "#a855f7" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
