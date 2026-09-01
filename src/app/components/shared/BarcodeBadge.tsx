"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export interface BarcodeBadgeProps {
  value: string;
  label?: string;
  showText?: boolean;
  height?: number;
  className?: string;
}

/**
 * Deterministic lightweight Code-128 style visual SVG barcode bar generator.
 * Produces crisp, vector scalable industrial bar patterns without external heavy libraries.
 */
function generateBars(input: string): boolean[] {
  const bars: boolean[] = [true, false, true]; // Start pattern
  for (let i = 0; i < input.length; i++) {
    const charCode = input.charCodeAt(i);
    for (let b = 0; b < 6; b++) {
      bars.push(((charCode >> b) & 1) === 1);
    }
    bars.push(false); // inter-character space
  }
  bars.push(true, true, false, true); // Stop pattern
  return bars;
}

export default function BarcodeBadge({
  value,
  label,
  showText = true,
  height = 36,
  className = "",
}: BarcodeBadgeProps) {
  const [copied, setCopied] = useState(false);

  if (!value) return null;

  const bars = generateBars(value);
  const barWidth = 2;
  const totalWidth = bars.length * barWidth;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div
      onClick={handleCopy}
      className={`inline-flex flex-col items-center p-2 rounded-xl border border-slate-700 bg-surface-2 hover:border-accent/60 transition-all cursor-pointer group select-none ${className}`}
      title={`Click to copy: ${value}`}
    >
      {label && (
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
          {label}
        </span>
      )}

      <svg
        width={totalWidth}
        height={height}
        className="text-white fill-current"
        viewBox={`0 0 ${totalWidth} ${height}`}
      >
        {bars.map((isBar, idx) =>
          isBar ? (
            <rect
              key={idx}
              x={idx * barWidth}
              y={0}
              width={barWidth - 0.3}
              height={height}
              className="fill-current text-slate-100 dark:text-white print:text-black"
            />
          ) : null
        )}
      </svg>

      {showText && (
        <div className="flex items-center gap-1.5 mt-1 font-mono text-xs font-bold text-slate-300 group-hover:text-accent transition-colors">
          <span>{value}</span>
          {copied ? (
            <Check className="w-3 h-3 text-emerald-400" />
          ) : (
            <Copy className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      )}
    </div>
  );
}
