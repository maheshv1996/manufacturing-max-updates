"use client";

import React from "react";
import { cn } from "@/lib/designTokens";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "success"
  | "outline"
  | "glass"
  | "gradient";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = cn(
    "inline-flex items-center justify-center font-medium rounded-xl",
    "transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]",
  );

  const variants = {
    primary: cn(
      "bg-gradient-to-r from-blue-500 to-blue-600 text-white",
      "shadow-lg shadow-blue-500/15",
      "hover:from-blue-400 hover:to-blue-500 hover:shadow-xl hover:shadow-blue-500/22",
      "active:from-blue-600 active:to-blue-700 active:shadow-md",
    ),
    secondary: cn(
      "bg-white/5 backdrop-blur-xl text-slate-300 border border-white/10",
      "hover:bg-white/10 hover:border-white/20 hover:text-white hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)]",
      "active:bg-white/15 active:border-white/30",
    ),
    outline: cn(
      "bg-transparent text-slate-300 border border-slate-600",
      "hover:bg-white/5 hover:border-slate-500 hover:text-white hover:shadow-[0_4px_16px_rgba(0,0,0,0.2)]",
      "active:bg-white/10",
    ),
    ghost: cn(
      "bg-transparent text-slate-400",
      "hover:bg-white/5 hover:text-white",
      "active:bg-white/10",
    ),
    danger: cn(
      "bg-gradient-to-r from-rose-500 to-rose-600 text-white",
      "shadow-lg shadow-rose-500/15",
      "hover:from-rose-400 hover:to-rose-500 hover:shadow-xl hover:shadow-rose-500/22",
      "active:from-rose-600 active:to-rose-700",
    ),
    success: cn(
      "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white",
      "shadow-lg shadow-emerald-500/15",
      "hover:from-emerald-400 hover:to-emerald-500 hover:shadow-xl hover:shadow-emerald-500/22",
      "active:from-emerald-600 active:to-emerald-700",
    ),
    glass: cn(
      "bg-white/5 backdrop-blur-2xl text-slate-300 border border-white/10",
      "hover:bg-white/10 hover:border-white/20 hover:text-white hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
      "active:bg-white/15 active:border-white/30",
    ),
    gradient: cn(
      "bg-gradient-to-r from-purple-500 via-purple-600 to-indigo-600 text-white",
      "shadow-lg shadow-purple-500/15",
      "hover:from-purple-400 hover:via-purple-500 hover:to-indigo-500 hover:shadow-xl hover:shadow-purple-500/22",
      "active:from-purple-600 active:via-purple-700 active:to-indigo-700",
    ),
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2.5 text-sm gap-2",
    lg: "px-6 py-3.5 text-base gap-2.5",
    icon: "p-2.5",
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
      {children}
    </button>
  );
}
