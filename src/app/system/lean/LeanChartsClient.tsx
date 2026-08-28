"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import {
  ParetoItem,
  ControlChartPoint,
  FpyTrendPoint,
  DowntimeCategoryPoint,
} from "@/lib/leanData";

interface Props {
  downtimeParetoData: ParetoItem[];
  defectParetoData: ParetoItem[];
  controlChartData: ControlChartPoint[];
  fpyTrendData: FpyTrendPoint[];
  downtimeCategoryData: DowntimeCategoryPoint[];
}

function CustomControlChartDot(props: any) {
  const { cx, cy, payload } = props;
  if (payload && payload.isOutlier) {
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={8}
          fill="#ef4444"
          stroke="#ffffff"
          strokeWidth={2}
        />
        <circle
          cx={cx}
          cy={cy}
          r={12}
          fill="none"
          stroke="#ef4444"
          strokeWidth={1.5}
          className="animate-ping"
        />
      </g>
    );
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill="#3b82f6"
      stroke="#ffffff"
      strokeWidth={1.5}
    />
  );
}

export default function LeanChartsClient({
  downtimeParetoData,
  defectParetoData,
  controlChartData,
  fpyTrendData,
  downtimeCategoryData,
}: Props) {
  const meanVal = controlChartData[0]?.mean || 80;
  const uclVal = controlChartData[0]?.ucl || 95;
  const lclVal = controlChartData[0]?.lcl || 65;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-2">
      {/* 1. DOWNTIME PARETO CHART */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-3xl p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-lg font-bold text-white">
            Downtime Pareto Analysis (80/20 Rule)
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            The vital few downtime reasons causing 80%+ of machine availability
            losses.
          </p>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={downtimeParetoData}
              margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#334155"
                opacity={0.3}
              />
              <XAxis
                dataKey="code"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={{ stroke: "#475569" }}
              />
              <YAxis
                yAxisId="left"
                orientation="left"
                stroke="#3b82f6"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                unit="m"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#f59e0b"
                domain={[0, 100]}
                unit="%"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#334155",
                  borderRadius: "12px",
                  color: "#fff",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
              <Bar
                yAxisId="left"
                dataKey="value"
                name="Downtime (Mins)"
                fill="#3b82f6"
                radius={[6, 6, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulativePct"
                name="Cumulative %"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={{ fill: "#f59e0b", r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. DEFECT PARETO CHART */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-3xl p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-lg font-bold text-white">
            Defect Pareto Analysis (Quality Losses)
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Top quality defect codes prioritizing root cause problem solving.
          </p>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={defectParetoData}
              margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#334155"
                opacity={0.3}
              />
              <XAxis
                dataKey="code"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={{ stroke: "#475569" }}
              />
              <YAxis
                yAxisId="left"
                orientation="left"
                stroke="#f43f5e"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                unit=" pcs"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#10b981"
                domain={[0, 100]}
                unit="%"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#334155",
                  borderRadius: "12px",
                  color: "#fff",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
              <Bar
                yAxisId="left"
                dataKey="value"
                name="Failed Qty"
                fill="#f43f5e"
                radius={[6, 6, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulativePct"
                name="Cumulative %"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: "#10b981", r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. OEE CONTROL CHART (I-CHART) */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">
              OEE Control Chart (Individuals I-Chart)
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Statistical Process Control (SPC) chart monitoring daily process
              stability and special cause variation.
            </p>
          </div>
          <span className="px-2.5 py-1 text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-400 border border-rose-200 dark:border-rose-800 rounded-lg">
            Red = Out of Control
          </span>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={controlChartData}
              margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#334155"
                opacity={0.3}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={{ stroke: "#475569" }}
              />
              <YAxis
                domain={[50, 100]}
                unit="%"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#334155",
                  borderRadius: "12px",
                  color: "#fff",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
              <ReferenceLine
                y={uclVal}
                label={{
                  value: `UCL (${uclVal}%)`,
                  fill: "#ef4444",
                  fontSize: 11,
                  position: "top",
                }}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeWidth={2}
              />
              <ReferenceLine
                y={meanVal}
                label={{
                  value: `CL (${meanVal}%)`,
                  fill: "#10b981",
                  fontSize: 11,
                  position: "top",
                }}
                stroke="#10b981"
                strokeWidth={2}
              />
              <ReferenceLine
                y={lclVal}
                label={{
                  value: `LCL (${lclVal}%)`,
                  fill: "#ef4444",
                  fontSize: 11,
                  position: "bottom",
                }}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="oee"
                name="Daily OEE %"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={<CustomControlChartDot />}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. FIRST PASS YIELD TREND */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-3xl p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-lg font-bold text-white">
            First Pass Yield (FPY) Trend
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Daily ratio of first-pass defect-free production units delivered to
            customer specification.
          </p>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={fpyTrendData}
              margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
            >
              <defs>
                <linearGradient id="fpyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#334155"
                opacity={0.3}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={{ stroke: "#475569" }}
              />
              <YAxis
                domain={[80, 100]}
                unit="%"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#334155",
                  borderRadius: "12px",
                  color: "#fff",
                }}
              />
              <Area
                type="monotone"
                dataKey="fpyPct"
                name="First Pass Yield %"
                stroke="#10b981"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#fpyGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. DOWNTIME BY CATEGORY DONUT CHART */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-3xl p-6 shadow-sm space-y-4 lg:col-span-2">
        <div>
          <h3 className="text-lg font-bold text-white">
            Downtime Loss Breakdown by Category
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Distribution of logged downtime by primary loss category across all
            machine centers.
          </p>
        </div>

        <div className="h-72 w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={downtimeCategoryData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={100}
                paddingAngle={4}
                dataKey="value"
                nameKey="name"
                label={({
                  name,
                  percent,
                }: {
                  name?: string;
                  percent?: number;
                }) => `${name || ""} (${((percent || 0) * 100).toFixed(0)}%)`}
              >
                {downtimeCategoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#334155",
                  borderRadius: "12px",
                  color: "#fff",
                }}
                formatter={(val: any) => [`${val || 0} mins`, "Downtime"]}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
