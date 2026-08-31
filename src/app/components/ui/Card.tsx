"use client";

import React from "react";
import { cn, glassCard } from "@/lib/designTokens";

export function Card({
  children,
  className = "",
  noPadding = false,
  hover = false,
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  hover?: boolean;
  variant?: "default" | "premium" | "modal";
}) {
  return (
    <div
      className={cn(
        glassCard(variant, hover),
        "group relative rounded-2xl overflow-hidden edge-light",
        className,
      )}
    >
      {/* GPU-cheap glow: an opacity layer instead of animating box-shadow */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        style={{
          boxShadow:
            "0 0 60px rgba(99,102,241,0.14), inset 0 0 30px rgba(255,255,255,0.03)",
        }}
      />
      {noPadding ? (
        children
      ) : (
        <div className="relative p-5 sm:p-6">{children}</div>
      )}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  className = "",
  gradient = false,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  gradient?: boolean;
}) {
  return (
    <div
      className={cn(
        "px-5 py-4 sm:px-6 sm:py-5 border-b border-white/10 flex items-center justify-between gap-4",
        gradient && "bg-gradient-to-r from-white/5 via-transparent to-white/2",
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <span className="p-2 bg-white/5 rounded-xl text-slate-300 shrink-0 backdrop-blur-sm border border-white/10">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="font-semibold text-white tracking-tight">{title}</h3>
          {subtitle && (
            <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardContent({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("p-5 sm:p-6", className)}>{children}</div>;
}

export function CardFooter({
  children,
  className = "",
  divided = true,
}: {
  children: React.ReactNode;
  className?: string;
  divided?: boolean;
}) {
  return (
    <div
      className={cn(
        "px-5 py-4 sm:px-6 sm:py-4 flex items-center gap-3",
        divided && "border-t border-white/10",
        className,
      )}
    >
      {children}
    </div>
  );
}
