"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/designTokens";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
  compact = false,
}: EmptyStateProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      role="status"
      aria-label={title}
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96 }}
      animate={shouldReduceMotion ? false : { opacity: 1, scale: 1 }}
      transition={shouldReduceMotion ? undefined : { duration: 0.25, ease: "easeOut" }}
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-3xl bg-slate-800/40 border border-white/10 backdrop-blur-xl shadow-sm",
        compact ? "py-6 px-4" : "py-14 px-6",
        className,
      )}
    >
      {icon && (
        <div
          aria-hidden="true"
          className={cn(
            "rounded-2xl bg-slate-800/80 border border-white/10 flex items-center justify-center text-slate-400 mb-4 shadow-md",
            compact ? "size-12 p-2.5" : "size-16 p-3.5",
          )}
        >
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-white mb-1.5 tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-slate-400 mb-5 max-w-md leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </motion.div>
  );
}
