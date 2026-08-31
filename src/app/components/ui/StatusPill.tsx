"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/designTokens";

export type StatusVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "live"
  | "partial"
  | "planned"
  | "running"
  | "completed"
  | "active"
  | "in_progress"
  | "draft"
  | "on_hold"
  | "critical";

interface StatusPillProps {
  variant: StatusVariant;
  label: string;
  icon?: React.ReactNode;
  className?: string;
  dot?: boolean;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
}

const gradientMap: Record<StatusVariant, string> = {
  success: "from-emerald-500/15 to-emerald-500/5 text-emerald-400 border-emerald-500/30",
  active: "from-emerald-500/15 to-emerald-500/5 text-emerald-400 border-emerald-500/30",
  live: "from-emerald-500/15 to-emerald-500/5 text-emerald-400 border-emerald-500/30",
  completed: "from-emerald-500/15 to-emerald-500/5 text-emerald-400 border-emerald-500/30",
  warning: "from-amber-500/15 to-amber-500/5 text-amber-400 border-amber-500/30",
  partial: "from-amber-500/15 to-amber-500/5 text-amber-400 border-amber-500/30",
  on_hold: "from-amber-500/15 to-amber-500/5 text-amber-400 border-amber-500/30",
  danger: "from-rose-500/15 to-rose-500/5 text-rose-400 border-rose-500/30",
  critical: "from-rose-500/15 to-rose-500/5 text-rose-400 border-rose-500/30",
  info: "from-sky-500/15 to-sky-500/5 text-sky-400 border-sky-500/30",
  in_progress: "from-blue-500/15 to-blue-500/5 text-blue-400 border-blue-500/30",
  draft: "from-blue-500/15 to-blue-500/5 text-blue-400 border-blue-500/30",
  running: "from-cyan-500/15 to-cyan-500/5 text-cyan-400 border-cyan-500/30",
  planned: "from-slate-500/15 to-slate-500/5 text-slate-400 border-slate-500/30",
  neutral: "from-slate-500/15 to-slate-500/5 text-slate-400 border-slate-500/30",
};

const dotColorMap: Record<StatusVariant, string> = {
  success: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
  active: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
  live: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
  completed: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
  warning: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]",
  partial: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]",
  on_hold: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]",
  danger: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]",
  critical: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]",
  info: "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]",
  in_progress: "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]",
  draft: "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]",
  running: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]",
  planned: "bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.6)]",
  neutral: "bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.6)]",
};

export function StatusPill({
  variant,
  label,
  icon,
  className = "",
  dot = false,
  size = "sm",
  animated = false,
}: StatusPillProps) {
  const shouldReduceMotion = useReducedMotion();
  const isMotionAllowed = animated && !shouldReduceMotion;
  const styleCls = gradientMap[variant] || gradientMap.neutral;
  const dotCls = dotColorMap[variant] || dotColorMap.neutral;

  return (
    <motion.span
      initial={isMotionAllowed ? { opacity: 0, scale: 0.95 } : false}
      animate={isMotionAllowed ? { opacity: 1, scale: 1 } : false}
      transition={
        isMotionAllowed ? { type: "spring", stiffness: 300, damping: 20 } : undefined
      }
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold rounded-full border backdrop-blur-xl select-none",
        "bg-gradient-to-br",
        styleCls,
        size === "sm" && "px-2.5 py-0.5 text-xs",
        size === "md" && "px-3 py-1 text-xs",
        size === "lg" && "px-4 py-1.5 text-sm",
        className,
      )}
    >
      {dot && (
        <motion.span
          aria-hidden="true"
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotCls)}
          animate={isMotionAllowed ? { opacity: [0.6, 1, 0.6] } : undefined}
          transition={
            isMotionAllowed
              ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
              : undefined
          }
        />
      )}
      {icon && <span aria-hidden="true" className="w-3.5 h-3.5 shrink-0">{icon}</span>}
      <span>{label}</span>
    </motion.span>
  );
}
