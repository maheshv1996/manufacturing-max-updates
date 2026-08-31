"use client";

import React, { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/designTokens";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  description?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      id,
      label,
      error,
      description,
      className = "",
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const selectId = id || generatedId;
    const errorId = error ? `${selectId}-error` : undefined;
    const descriptionId = description ? `${selectId}-desc` : undefined;

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-slate-200 select-none"
          >
            {label}
          </label>
        )}
        {description && (
          <p id={descriptionId} className="text-xs text-slate-400 mb-0.5">
            {description}
          </p>
        )}
        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={
              [errorId, descriptionId].filter(Boolean).join(" ") || undefined
            }
            className={cn(
              "w-full appearance-none bg-slate-900/60 backdrop-blur-xl border rounded-xl px-3.5 py-2.5 pr-10 text-sm text-white",
              "transition-colors duration-150 motion-reduce:transition-none cursor-pointer",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.2)]",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
              "hover:border-white/20 hover:bg-slate-900/80",
              "[&>option]:bg-slate-900 [&>option]:text-white",
              error
                ? "border-rose-500/80 focus:ring-rose-500 focus:border-rose-500 focus:shadow-[0_0_0_4px_rgba(244,63,94,0.2)]"
                : "border-white/10 hover:border-white/20",
              className,
            )}
            {...props}
          >
            {children}
          </select>
          <div
            aria-hidden="true"
            className="absolute right-3.5 pointer-events-none text-slate-400 shrink-0 flex items-center justify-center"
          >
            <ChevronDown className="size-4" />
          </div>
        </div>
        {error && (
          <span
            id={errorId}
            role="alert"
            className="text-xs text-rose-400 mt-0.5 font-medium flex items-center gap-1"
          >
            {error}
          </span>
        )}
      </div>
    );
  },
);
Select.displayName = "Select";
