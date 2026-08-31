"use client";

import React from "react";
import { cn } from "@/lib/designTokens";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: "rectangular" | "circular" | "rounded";
}

export function Skeleton({
  className = "",
  variant = "rounded",
  ...props
}: SkeletonProps) {
  const variantStyles = {
    rectangular: "rounded-none",
    circular: "rounded-full",
    rounded: "rounded-2xl",
  };

  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-slate-800/60 relative overflow-hidden motion-safe:animate-pulse motion-reduce:animate-none border border-white/5",
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent motion-safe:animate-[shimmer_1.6s_infinite] motion-reduce:hidden" />
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div
      role="status"
      aria-label="Loading table data"
      className="w-full space-y-3 p-4 bg-slate-800/40 border border-white/10 rounded-3xl backdrop-blur-xl"
    >
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 py-2">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn(
                  "h-4",
                  c === 0
                    ? "w-1/4"
                    : c === cols - 1
                      ? "w-16 ml-auto"
                      : "flex-1",
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading card content"
      className="p-6 rounded-3xl bg-slate-800/40 border border-white/10 space-y-4 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-6 w-12" variant="circular" />
      </div>
      <Skeleton className="h-10 w-3/4" />
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}
