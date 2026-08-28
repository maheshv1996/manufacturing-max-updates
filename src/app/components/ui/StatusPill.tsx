"use client";

import React from "react";
import { motion } from "framer-motion";
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
  | "active";

interface StatusPillProps {
  variant: StatusVariant;
  label: string;
  icon?: React.ReactNode;
  className?: string;
  dot?: boolean;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
}

const variantMap: Record<StatusVariant, string> = {
  success: "ok",
  warning: "warn",
  danger: "danger",
  info: "info",
  neutral: "neutral",
  live: "live",
  partial: "partial",
  planned: "planned",
  running: "running",
  completed: "completed",
  active: "active",
};

const gradientMap: Record<string, string> = {
  ok: "from-emerald-500/12 to-emerald-500/4",
  warn: "from-amber-500/12 to-amber-500/4",
  danger: "from-rose-500/12 to-rose-500/4",
  info: "from-sky-500/12 to-sky-500/4",
  live: "from-emerald-500/12 to-emerald-500/4",
  partial: "from-amber-500/12 to-amber-500/4",
  planned: "from-slate-500/12 to-slate-500/4",
  draft: "from-blue-500/12 to-blue-500/4",
  active: "from-emerald-500/12 to-emerald-500/4",
  in_progress: "from-blue-500/12 to-blue-500/4",
  completed: "from-emerald-500/12 to-emerald-500/4",
  on_hold: "from-amber-500/12 to-amber-500/4",
  running: "from-cyan-500/12 to-cyan-500/4",
  warning: "from-amber-500/12 to-amber-500/4",
  critical: "from-rose-500/12 to-rose-500/4",
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
  const tone = variantMap[variant];
  const gradient = gradientMap[tone] || gradientMap.neutral;

  return (
    <motion.span
      initial={animated ? { opacity: 0, scale: 0.9 } : false}
      animate={animated ? { opacity: 1, scale: 1 } : false}
      transition={
        animated ? { type: "spring", stiffness: 300, damping: 20 } : undefined
      }
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold rounded-full border backdrop-blur-xl",
        "bg-gradient-to-br",
        gradient,
        "border-white/10",
        size === "sm" && "px-2.5 py-0.5 text-[11px]",
        size === "md" && "px-3 py-1 text-xs",
        size === "lg" && "px-4 py-1.5 text-sm",
        className,
      )}
    >
      {dot && (
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-current opacity-80"
          animate={animated ? { opacity: [0.8, 1, 0.8] } : undefined}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {icon && <span className="w-3.5 h-3.5 shrink-0">{icon}</span>}
      {label}
    </motion.span>
  );
}
