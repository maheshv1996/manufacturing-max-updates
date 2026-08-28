"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "./Card";
import { cn } from "@/lib/designTokens";

interface KpiCardProps {
  title: string;
  value: React.ReactNode;
  trend?: {
    value: number | string;
    label: string;
    isPositive?: boolean;
    isNeutral?: boolean;
  };
  icon?: React.ReactNode;
  className?: string;
  tone?: string;
  premium?: boolean;
}

const toneMap: Record<string, { text: string; bg: string; gradient: string }> =
  {
    blue: {
      text: "text-blue-400",
      bg: "bg-blue-500/10",
      gradient: "from-blue-500/12 to-blue-500/4",
    },
    emerald: {
      text: "text-emerald-400",
      bg: "bg-emerald-500/10",
      gradient: "from-emerald-500/12 to-emerald-500/4",
    },
    amber: {
      text: "text-amber-400",
      bg: "bg-amber-500/10",
      gradient: "from-amber-500/12 to-amber-500/4",
    },
    rose: {
      text: "text-rose-400",
      bg: "bg-rose-500/10",
      gradient: "from-rose-500/12 to-rose-500/4",
    },
    purple: {
      text: "text-purple-400",
      bg: "bg-purple-500/10",
      gradient: "from-purple-500/12 to-purple-500/4",
    },
    cyan: {
      text: "text-cyan-400",
      bg: "bg-cyan-500/10",
      gradient: "from-cyan-500/12 to-cyan-500/4",
    },
    slate: {
      text: "text-slate-300",
      bg: "bg-slate-500/10",
      gradient: "from-slate-500/12 to-slate-500/4",
    },
  };

export function KpiCard({
  title,
  value,
  trend,
  icon,
  className = "",
  tone = "blue",
  premium = true,
}: KpiCardProps) {
  const t = toneMap[tone] || toneMap.blue;

  return (
    <Card
      variant={premium ? "premium" : "default"}
      hover
      className={cn("relative overflow-hidden", className)}
    >
      {premium && (
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      )}
      <CardContent className="relative">
        <div className="flex justify-between items-start mb-2 gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {title}
          </h3>
          {icon && (
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={cn(
                "p-2.5 rounded-xl shrink-0 backdrop-blur-sm border border-white/10",
                "bg-gradient-to-br",
                t.gradient,
                t.text,
              )}
            >
              {icon}
            </motion.div>
          )}
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className={cn(
              "text-3xl sm:text-4xl font-black tabular-nums",
              t.text,
            )}
          >
            {value}
          </motion.div>
          {trend && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className={cn(
                "text-xs font-semibold flex items-center gap-1",
                trend.isNeutral
                  ? "text-slate-400"
                  : trend.isPositive
                    ? "text-emerald-400"
                    : "text-rose-400",
              )}
            >
              {trend.isNeutral ? null : trend.isPositive ? "↑" : "↓"}
              {trend.value}
              <span className="text-slate-500 ml-0.5 font-normal">
                {trend.label}
              </span>
            </motion.div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
