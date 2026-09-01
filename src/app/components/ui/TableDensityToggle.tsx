"use client";

import { Rows, AlignJustify, StretchHorizontal } from "lucide-react";

export type TableDensity = "compact" | "normal" | "touch";

export interface TableDensityToggleProps {
  density: TableDensity;
  onChange: (density: TableDensity) => void;
  className?: string;
}

export function TableDensityToggle({
  density,
  onChange,
  className = "",
}: TableDensityToggleProps) {
  return (
    <div
      className={`inline-flex items-center p-0.5 rounded-xl border border-slate-700 bg-slate-800/80 ${className}`}
      title="Toggle Table Row Density"
    >
      <button
        onClick={() => onChange("compact")}
        className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
          density === "compact"
            ? "bg-blue-600 text-white shadow-xs font-bold"
            : "text-slate-400 hover:text-slate-200"
        }`}
        title="Compact View (Dense Engineering Rows)"
      >
        <Rows className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => onChange("normal")}
        className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
          density === "normal"
            ? "bg-blue-600 text-white shadow-xs font-bold"
            : "text-slate-400 hover:text-slate-200"
        }`}
        title="Normal Desktop View"
      >
        <AlignJustify className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => onChange("touch")}
        className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
          density === "touch"
            ? "bg-blue-600 text-white shadow-xs font-bold"
            : "text-slate-400 hover:text-slate-200"
        }`}
        title="Touch Kiosk View (Rugged Tablet Hit Areas)"
      >
        <StretchHorizontal className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
