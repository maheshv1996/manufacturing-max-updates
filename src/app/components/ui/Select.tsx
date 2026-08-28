"use client";

import React, { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/designTokens";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className = "", children, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-slate-300">{label}</label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              "w-full appearance-none bg-white/5 backdrop-blur-xl border rounded-xl px-3.5 py-2.5 pr-10 text-sm text-white",
              "transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.15)]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "hover:border-white/20 hover:bg-white/8",
              error
                ? "border-rose-500/60 focus:ring-rose-500/40 focus:border-rose-500/50"
                : "border-white/10 hover:border-white/20",
              className,
            )}
            {...props}
          >
            {children}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {error && (
          <span className="text-xs text-rose-400 mt-1 font-medium">
            {error}
          </span>
        )}
      </div>
    );
  },
);
Select.displayName = "Select";
