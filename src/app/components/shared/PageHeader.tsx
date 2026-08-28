"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/designTokens";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  iconTone?: string;
  children?: React.ReactNode;
  badge?: { label: string; tone: string };
  action?: {
    label: string;
    href: string;
    icon: React.ReactNode;
    primary?: boolean;
  };
  cinematic?: boolean;
}

export default function PageHeader({
  title,
  description,
  icon,
  iconTone = "blue",
  children,
  badge,
  action,
  cinematic = false,
}: PageHeaderProps) {
  const iconColorMap: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    slate: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  };

  const iconBgMap: Record<string, string> = {
    blue: "from-blue-500/12 to-blue-500/4",
    emerald: "from-emerald-500/12 to-emerald-500/4",
    amber: "from-amber-500/12 to-amber-500/4",
    rose: "from-rose-500/12 to-rose-500/4",
    purple: "from-purple-500/12 to-purple-500/4",
    cyan: "from-cyan-500/12 to-cyan-500/4",
    indigo: "from-indigo-500/12 to-indigo-500/4",
    slate: "from-slate-500/12 to-slate-500/4",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 sm:mb-10"
    >
      <div className="flex items-start gap-4">
        {icon && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotate: -12 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 280,
              damping: 18,
              delay: 0.15,
            }}
            className={cn(
              "p-3 sm:p-4 rounded-2xl border shadow-sm flex-shrink-0 backdrop-blur-xl",
              "bg-gradient-to-br",
              iconBgMap[iconTone] || iconBgMap.blue,
              iconColorMap[iconTone] || iconColorMap.blue,
              "border-white/10",
            )}
          >
            {icon}
          </motion.div>
        )}
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.4,
                delay: 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={cn(
                "font-black tracking-tight",
                cinematic
                  ? "text-4xl sm:text-5xl lg:text-6xl bg-gradient-to-r from-white via-slate-200 to-blue-300 bg-clip-text text-transparent"
                  : "text-3xl sm:text-4xl text-white",
              )}
            >
              {title}
            </motion.h1>
            {badge && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                  delay: 0.2,
                }}
                className={cn(
                  "text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 backdrop-blur-sm",
                  {
                    live: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                    warn: "bg-amber-500/10 text-amber-400 border-amber-500/30",
                    danger: "bg-rose-500/10 text-rose-400 border-rose-500/30",
                    info: "bg-sky-500/10 text-sky-400 border-sky-500/30",
                    new: "bg-blue-500/10 text-blue-400 border-blue-500/30",
                  }[badge.tone] ||
                    "bg-blue-500/10 text-blue-400 border-blue-500/30",
                )}
              >
                {badge.label}
              </motion.span>
            )}
          </div>
          {description && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: 0.2,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="text-slate-400 text-base sm:text-lg mt-2 leading-relaxed max-w-2xl"
            >
              {description}
            </motion.p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap mt-4 sm:mt-0">
        {children && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="flex items-center gap-3"
          >
            {children}
          </motion.div>
        )}

        {action && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              href={action.href}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl font-medium text-sm",
                "transition-all duration-200 hover:-translate-y-0.5",
                action.primary
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/15 hover:from-blue-400 hover:to-blue-500 hover:shadow-xl hover:shadow-blue-500/22"
                  : "bg-white/5 backdrop-blur-xl text-slate-300 border border-white/10 hover:bg-white/10 hover:border-white/20 hover:text-white hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)]",
              )}
            >
              {action.icon}
              {action.label}
            </Link>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
