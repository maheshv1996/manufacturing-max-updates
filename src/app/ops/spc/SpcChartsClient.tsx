"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type {
  CapabilityStats,
  HistogramBin,
  XBarChartData,
  RChartData,
  PChartPoint,
} from "@/lib/spcData";

// ── Capability Cards ──────────────────────────────────────────────────────────

export function CapabilityCards({ cap }: { cap: CapabilityStats }) {
  const verdictColor =
    cap.verdict === "Capable"
      ? "bg-emerald-900/60 border-emerald-700 text-emerald-300"
      : cap.verdict === "Marginal"
        ? "bg-amber-900/60 border-amber-700 text-amber-300"
        : "bg-rose-900/60 border-rose-700 text-rose-300";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
      {[
        { label: "Mean (x̄)", value: cap.mean.toFixed(4), unit: "mm" },
        { label: "Std Dev (σ)", value: cap.sigma.toFixed(5), unit: "mm" },
        { label: "Cp", value: cap.cp.toFixed(3), unit: "" },
        { label: "Cpk", value: cap.cpk.toFixed(3), unit: "" },
      ].map((item) => (
        <div
          key={item.label}
          className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center"
        >
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
            {item.label}
          </p>
          <p className="text-3xl font-black text-white">
            {item.value}
            {item.unit && (
              <span className="text-base font-normal text-slate-400 ml-1">
                {item.unit}
              </span>
            )}
          </p>
        </div>
      ))}

      <div
        className={`col-span-2 md:col-span-4 border rounded-2xl px-6 py-4 flex items-center justify-between flex-wrap gap-4 ${verdictColor}`}
      >
        <div>
          <p className="text-xs uppercase tracking-wider opacity-70 mb-0.5">
            Process Verdict
          </p>
          <p className="text-2xl font-black">{cap.verdict}</p>
        </div>
        <div className="text-sm opacity-80 space-y-0.5">
          <p>
            LSL: {cap.lsl} mm · Target: {cap.target} mm · USL: {cap.usl} mm
          </p>
          <p>n = {cap.n} measurements · Cpk ≥ 1.33 → Capable</p>
        </div>
      </div>
    </div>
  );
}

// ── Histogram ─────────────────────────────────────────────────────────────────

export function HistogramChart({
  data,
  lsl,
  usl,
  target,
}: {
  data: HistogramBin[];
  lsl: number;
  usl: number;
  target: number;
}) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
      <h2 className="text-lg font-bold text-white mb-1">
        Measurement Distribution
      </h2>
      <p className="text-sm text-slate-400 mb-5">
        Bell shape indicates a stable process; bars beyond LSL/USL are defects.
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ left: 0, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="midpoint"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickFormatter={(v) => v.toFixed(3)}
          />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: "#1e293b",
              border: "1px solid #475569",
              borderRadius: 8,
            }}
            formatter={(v) => [String(v), "Count"]}
            labelFormatter={(l) => `≈ ${Number(l).toFixed(3)} mm`}
          />
          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <ReferenceLine
            x={lsl}
            stroke="#f87171"
            strokeDasharray="4 4"
            label={{
              value: "LSL",
              fill: "#f87171",
              fontSize: 10,
              position: "top",
            }}
          />
          <ReferenceLine
            x={usl}
            stroke="#f87171"
            strokeDasharray="4 4"
            label={{
              value: "USL",
              fill: "#f87171",
              fontSize: 10,
              position: "top",
            }}
          />
          <ReferenceLine
            x={target}
            stroke="#34d399"
            strokeDasharray="4 4"
            label={{
              value: "Target",
              fill: "#34d399",
              fontSize: 10,
              position: "top",
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── X-bar Chart ───────────────────────────────────────────────────────────────

export function XBarChart({ data }: { data: XBarChartData[] }) {
  const plotData = data.map((d) => ({
    ...d,
    dot: d.outOfControl ? d.xbar : null,
    normal: d.outOfControl ? null : d.xbar,
  }));

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
      <h2 className="text-lg font-bold text-white mb-1">X-bar Chart</h2>
      <p className="text-sm text-slate-400 mb-5">
        Each point is the average of a subgroup of 5. Red points are
        out-of-control signals.
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={plotData} margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="index"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            label={{
              value: "Subgroup",
              fill: "#64748b",
              fontSize: 11,
              position: "insideBottom",
              offset: -2,
            }}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickFormatter={(v) => v.toFixed(3)}
          />
          <Tooltip
            contentStyle={{
              background: "#1e293b",
              border: "1px solid #475569",
              borderRadius: 8,
            }}
            formatter={(v) => [typeof v === "number" ? v.toFixed(5) : "—", ""]}
          />
          <ReferenceLine
            y={data[0]?.cl}
            stroke="#34d399"
            strokeWidth={1.5}
            label={{
              value: `CL=${data[0]?.cl?.toFixed(4)}`,
              fill: "#34d399",
              fontSize: 10,
              position: "right",
            }}
          />
          <ReferenceLine
            y={data[0]?.ucl}
            stroke="#f87171"
            strokeDasharray="5 3"
            label={{
              value: `UCL=${data[0]?.ucl?.toFixed(4)}`,
              fill: "#f87171",
              fontSize: 10,
              position: "right",
            }}
          />
          <ReferenceLine
            y={data[0]?.lcl}
            stroke="#f87171"
            strokeDasharray="5 3"
            label={{
              value: `LCL=${data[0]?.lcl?.toFixed(4)}`,
              fill: "#f87171",
              fontSize: 10,
              position: "right",
            }}
          />
          <Line
            type="monotone"
            dataKey="normal"
            stroke="#60a5fa"
            dot={{ r: 3, fill: "#60a5fa" }}
            connectNulls={false}
            name="X-bar (OK)"
          />
          <Line
            type="monotone"
            dataKey="dot"
            stroke="#f87171"
            dot={{ r: 5, fill: "#f87171" }}
            connectNulls={false}
            name="Out of control"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── R Chart ───────────────────────────────────────────────────────────────────

export function RangeChart({ data }: { data: RChartData[] }) {
  const plotData = data.map((d) => ({
    ...d,
    dot: d.outOfControl ? d.range : null,
    normal: d.outOfControl ? null : d.range,
  }));

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
      <h2 className="text-lg font-bold text-white mb-1">R Chart (Range)</h2>
      <p className="text-sm text-slate-400 mb-5">
        Range measures within-subgroup spread; a rising R-chart signals
        increasing variation.
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={plotData} margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="index" tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <YAxis
            domain={[0, "auto"]}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickFormatter={(v) => v.toFixed(3)}
          />
          <Tooltip
            contentStyle={{
              background: "#1e293b",
              border: "1px solid #475569",
              borderRadius: 8,
            }}
            formatter={(v) => [typeof v === "number" ? v.toFixed(5) : "—", ""]}
          />
          <ReferenceLine
            y={data[0]?.cl}
            stroke="#34d399"
            strokeWidth={1.5}
            label={{
              value: `R̄=${data[0]?.cl?.toFixed(4)}`,
              fill: "#34d399",
              fontSize: 10,
              position: "right",
            }}
          />
          <ReferenceLine
            y={data[0]?.ucl}
            stroke="#f87171"
            strokeDasharray="5 3"
            label={{
              value: `UCL=${data[0]?.ucl?.toFixed(4)}`,
              fill: "#f87171",
              fontSize: 10,
              position: "right",
            }}
          />
          <Line
            type="monotone"
            dataKey="normal"
            stroke="#a78bfa"
            dot={{ r: 3, fill: "#a78bfa" }}
            connectNulls={false}
            name="Range (OK)"
          />
          <Line
            type="monotone"
            dataKey="dot"
            stroke="#f87171"
            dot={{ r: 5, fill: "#f87171" }}
            connectNulls={false}
            name="Out of control"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── P Chart ───────────────────────────────────────────────────────────────────

export function PChart({ data }: { data: PChartPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-1">
          P Chart (Fraction Defective)
        </h2>
        <p className="text-slate-500 text-sm mt-4">
          No daily production data available for P chart.
        </p>
      </div>
    );
  }

  const plotData = data.map((d) => ({
    ...d,
    dot: d.outOfControl ? d.p : null,
    normal: d.outOfControl ? null : d.p,
  }));

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
      <h2 className="text-lg font-bold text-white mb-1">
        P Chart — Daily Fraction Defective
      </h2>
      <p className="text-sm text-slate-400 mb-5">
        Proportion of scrapped parts each day. Control limits vary by daily
        sample size (n).
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={plotData} margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickFormatter={(v) => v.slice(5)}
          />
          <YAxis
            tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: "#1e293b",
              border: "1px solid #475569",
              borderRadius: 8,
            }}
            formatter={(v, name) => [
              typeof v === "number" ? `${(v * 100).toFixed(2)}%` : "—",
              String(name),
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
          <Line
            type="monotone"
            dataKey="ucl"
            stroke="#f87171"
            strokeDasharray="5 3"
            dot={false}
            name="UCL"
          />
          <Line
            type="monotone"
            dataKey="lcl"
            stroke="#f87171"
            strokeDasharray="5 3"
            dot={false}
            name="LCL"
          />
          <Line
            type="monotone"
            dataKey="pBar"
            stroke="#34d399"
            strokeWidth={1.5}
            dot={false}
            name="p̄ (center)"
          />
          <Line
            type="monotone"
            dataKey="normal"
            stroke="#60a5fa"
            dot={{ r: 3, fill: "#60a5fa" }}
            connectNulls={false}
            name="Daily p (OK)"
          />
          <Line
            type="monotone"
            dataKey="dot"
            stroke="#f87171"
            dot={{ r: 5, fill: "#f87171" }}
            connectNulls={false}
            name="Out of control"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
