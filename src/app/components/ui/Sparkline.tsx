"use client";

import { useId } from "react";

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  tone?: "blue" | "emerald" | "amber" | "rose" | "cyan" | "purple";
  showArea?: boolean;
  strokeWidth?: number;
  className?: string;
}

const TONE_COLORS: Record<string, { stroke: string; fill: string }> = {
  blue: { stroke: "#3b82f6", fill: "rgba(59, 130, 246, 0.2)" },
  emerald: { stroke: "#10b981", fill: "rgba(16, 185, 129, 0.2)" },
  amber: { stroke: "#f59e0b", fill: "rgba(245, 158, 11, 0.2)" },
  rose: { stroke: "#ef4444", fill: "rgba(239, 68, 68, 0.2)" },
  cyan: { stroke: "#06b6d4", fill: "rgba(6, 182, 212, 0.2)" },
  purple: { stroke: "#a855f7", fill: "rgba(168, 85, 247, 0.2)" },
};

export function Sparkline({
  data = [],
  width = 96,
  height = 28,
  tone = "blue",
  showArea = true,
  strokeWidth = 2,
  className = "",
}: SparklineProps) {
  const gradientId = useId();

  if (!data || data.length < 2) {
    return (
      <div
        style={{ width, height }}
        className={`inline-flex items-center justify-center text-[10px] font-mono text-slate-500 bg-slate-800/30 rounded ${className}`}
      >
        --
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max === min ? 1 : max - min;
  const padding = 2;
  const usableHeight = height - padding * 2;
  const usableWidth = width - padding * 2;

  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1)) * usableWidth;
    const y = padding + usableHeight - ((val - min) / range) * usableHeight;
    return { x, y };
  });

  const pathD = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, "");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
  const toneCfg = TONE_COLORS[tone] || TONE_COLORS.blue;

  return (
    <svg
      width={width}
      height={height}
      className={`overflow-visible inline-block ${className}`}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={toneCfg.stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={toneCfg.stroke} stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {showArea && (
        <path d={areaD} fill={`url(#${gradientId})`} />
      )}

      <path
        d={pathD}
        fill="none"
        stroke={toneCfg.stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={2.5}
        fill={toneCfg.stroke}
        className="animate-pulse"
      />
    </svg>
  );
}
