"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
} from "lucide-react";

interface MaintenanceStats {
  openJobs: number;
  overduePM: number;
  warnTools: number;
  replaceTools: number;
  hasReplace: boolean;
}

export default function MaintenanceCard() {
  const [stats, setStats] = useState<MaintenanceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/maintenance/stats")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) return null;

  const hasAlert =
    stats.openJobs > 0 || stats.overduePM > 0 || stats.replaceTools > 0;

  return (
    <Link href="/system/maintenance" className="block group mb-6">
      <div
        className={`p-4 rounded-xl shadow-sm border flex items-center justify-between transition-all group-hover:shadow-md ${
          stats.hasReplace
            ? "bg-red-50/80 dark:bg-red-950/30 border-red-300 dark:border-red-800"
            : stats.overduePM > 0
              ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800"
              : "bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/40"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl shadow-sm ${
              stats.hasReplace
                ? "bg-red-600 text-white"
                : stats.overduePM > 0
                  ? "bg-amber-500 text-white"
                  : "bg-orange-500 text-white"
            }`}
          >
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-0.5">
              Maintenance Status
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {stats.openJobs > 0 && (
                <span className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-orange-500" />
                  {stats.openJobs} open job{stats.openJobs !== 1 ? "s" : ""}
                </span>
              )}
              {stats.overduePM > 0 && (
                <span className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  {stats.overduePM} PM overdue
                </span>
              )}
              {stats.replaceTools > 0 && (
                <span className="text-sm font-bold text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  {stats.replaceTools} tool{stats.replaceTools !== 1 ? "s" : ""}{" "}
                  need replacing
                </span>
              )}
              {stats.warnTools > 0 && stats.replaceTools === 0 && (
                <span className="text-sm font-medium text-amber-400">
                  {stats.warnTools} tool{stats.warnTools !== 1 ? "s" : ""} near
                  end-of-life
                </span>
              )}
              {!hasAlert && (
                <span className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  All clear
                </span>
              )}
            </div>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform flex-shrink-0" />
      </div>
    </Link>
  );
}
