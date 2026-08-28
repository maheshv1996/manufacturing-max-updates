"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/designTokens";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  description?: string;
  leftIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, description, leftIcon, className = "", ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-slate-300">{label}</label>
        )}
        {description && (
          <p className="text-xs text-slate-500 mb-1">{description}</p>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full bg-white/5 backdrop-blur-xl border rounded-xl px-3.5 py-2.5 text-sm text-white",
              "placeholder:text-slate-500 transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.15)]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "hover:border-white/20 hover:bg-white/8",
              error
                ? "border-rose-500/60 focus:ring-rose-500/40 focus:border-rose-500/50"
                : "border-white/10 hover:border-white/20",
              leftIcon ? "pl-10" : "",
              className,
            )}
            {...props}
          />
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
Input.displayName = "Input";
