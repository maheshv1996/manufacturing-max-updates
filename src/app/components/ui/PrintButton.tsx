"use client";

import { Printer } from "lucide-react";
import { soundFx } from "@/lib/soundFx";

interface PrintButtonProps {
  label?: string;
  className?: string;
  size?: "sm" | "md";
}

export function PrintButton({
  label = "Print Report",
  className = "",
  size = "sm",
}: PrintButtonProps) {
  const handlePrint = () => {
    soundFx.playClick();
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      aria-label={label}
      className={`no-print inline-flex items-center gap-2 rounded-xl font-semibold border border-white/10 bg-slate-900/60 hover:bg-slate-800 text-slate-200 hover:text-white backdrop-blur-xl transition-colors cursor-pointer shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
      } ${className}`}
    >
      <Printer className="size-3.5 text-cyan-400 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

export default PrintButton;
