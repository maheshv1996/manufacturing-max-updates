"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { DEPARTMENTS } from "@/lib/departments";
import { cn } from "@/lib/designTokens";

/**
 * TILE-FIRST: every department hub shows its sub-function tiles in a glass
 * grid — gradient squircles, staggered spring entry, hover lift + glow.
 * Derives the department from the current path by default (hub pages), or
 * accepts an explicit deptId (for pages that aren't HubClient-based, e.g. the
 * /projects board).
 */
export default function SubFunctionGrid({
  deptId,
  className,
}: {
  deptId?: string;
  className?: string;
}) {
  const pathname = usePathname();

  const dept = deptId
    ? DEPARTMENTS.find((d) => d.id === deptId)
    : DEPARTMENTS.find(
        (d) => pathname === d.hub || pathname.startsWith(d.hub + "/"),
      );

  if (!dept) return null;

  return (
    <div className={className}>
      {/* breadcrumb chip back to the gateway */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/60 border border-slate-700 px-3 py-1 text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
        >
          Departments
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold text-white bg-slate-800/80 border border-slate-700">
          {dept.short}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {dept.functions.map((f, i) => {
          const FIcon = f.icon;
          return (
            <motion.div
              key={f.href}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: i * 0.035,
                type: "spring",
                stiffness: 280,
                damping: 24,
              }}
            >
              <Link
                href={f.href}
                className="w-full h-full group flex items-center gap-3 rounded-2xl bg-slate-800/60 border border-slate-700 p-3 transition-all duration-300 hover:bg-slate-800/90 hover:border-slate-600 hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-0.5"
              >
                <span
                  className={cn(
                    "shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br text-white shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all",
                    dept.gradient,
                  )}
                >
                  <FIcon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white truncate">
                    {f.name}
                  </span>
                  <span className="block text-[11px] text-slate-400 truncate">
                    {f.desc}
                  </span>
                </span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
