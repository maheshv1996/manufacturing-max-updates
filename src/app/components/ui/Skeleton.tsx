"use client";

import React from "react";
import { cn } from "@/lib/designTokens";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
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
      className={cn(
        "bg-surface-3/60 relative overflow-hidden animate-pulse",
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_1.6s_infinite]" />
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
    <div className="w-full space-y-3 p-4 bg-surface-1 border border-border rounded-3xl">
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
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
    <div className="p-6 rounded-3xl bg-surface-1 border border-border space-y-4">
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
