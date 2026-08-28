"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/designTokens";

interface EmptyStateProps {
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
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-3xl bg-surface-1 border border-border/80 p-8 shadow-sm",
        compact ? "py-8 px-4" : "py-16 px-6",
        className,
      )}
    >
      {icon && (
        <div className="w-16 h-16 rounded-3xl bg-surface-2 border border-border/80 flex items-center justify-center text-text-3 mb-4 shadow-md">
          {icon}
        </div>
      )}
      <h3 className="text-base font-extrabold text-text-1 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-text-3 mb-5 max-w-md leading-relaxed">
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </motion.div>
  );
}
