import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  MapPin,
} from "lucide-react";
import { motion } from "framer-motion";
import { AnimatedCounter } from "@/app/components/ui/AnimatedCounter";

function getStatusBadge(
  oeeValue: number,
  thresholds: { good: number; warning: number },
) {
  const pct = Number(oeeValue.toFixed(1));
  if (pct >= thresholds.good) {
    return {
      label: `Good (≥${thresholds.good}%)`,
      colorClass:
        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 text-emerald-300 dark:border-emerald-800",
      dotClass: "bg-emerald-500",
      icon: CheckCircle2,
    };
  } else if (pct >= thresholds.warning) {
    return {
      label: `Warning (${thresholds.warning}–${thresholds.good - 1}%)`,
      colorClass:
        "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 text-amber-300 dark:border-amber-800",
      dotClass: "bg-amber-500",
      icon: AlertTriangle,
    };
  } else {
    return {
      label: `Critical (<${thresholds.warning}%)`,
      colorClass:
        "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 text-rose-300 dark:border-rose-800",
      dotClass: "bg-rose-500",
      icon: AlertTriangle,
    };
  }
}

export default function DashboardMachineCards({
  machines,
}: {
  machines: any[];
}) {
  return (
    <section className="space-y-4 mb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-400" />
          Machine Status & OEE Performance
        </h2>
        <span className="text-xs text-slate-400">
          Click any machine card for full detail history
        </span>
      </div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.1 } },
        }}
      >
        {machines.map((machine) => {
          const oeeVal = machine.metrics?.oee || 0;
          const oeePct = oeeVal.toFixed(1);
          const thresholds = {
            good: machine.oeeGoodThreshold ?? 85,
            warning: machine.oeeWarningThreshold ?? 70,
          };
          const status = getStatusBadge(oeeVal, thresholds);

          const locationText = machine.line
            ? `${machine.line.name}`
            : "Production Line";

          const activeWo = machine.activeWorkOrder;

          return (
            <Link
              key={machine.id}
              href={`/system/machines/${machine.id}`}
              className="block group"
            >
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.5, ease: "easeOut" },
                  },
                }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className={`border rounded-2xl p-6 shadow-sm group-hover:shadow-[0_8px_30px_rgba(59,130,246,0.12)] transition-all flex flex-col justify-between cursor-pointer h-full ${
                  machine.iotEnabled && machine.currentState === "FAULT"
                    ? "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/50 group-hover:border-rose-500/50"
                    : machine.iotEnabled && machine.currentState === "RUNNING"
                      ? "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200/50 dark:border-emerald-800/30 group-hover:border-emerald-500/50"
                      : machine.iotEnabled && machine.currentState === "IDLE"
                        ? "bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-800/30 group-hover:border-amber-500/50"
                        : "bg-slate-800/60 border-slate-700 group-hover:border-blue-500/50"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                          {machine.name}
                        </h3>
                        <span className="px-2 py-0.5 text-xs font-mono font-semibold bg-slate-800/60 text-slate-600 text-slate-300 rounded border border-slate-600">
                          {machine.code}
                        </span>
                        {machine.iotEnabled && (
                          <span className="px-2 py-0.5 text-xs font-black bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded flex items-center gap-1 uppercase">
                            <Activity className="w-3 h-3" /> IoT
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {locationText}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {machine.iotEnabled && (
                        <span
                          className={`inline-flex items-center px-2 py-1 text-xs font-bold border rounded uppercase ${
                            machine.currentState === "RUNNING"
                              ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 text-emerald-400 dark:border-emerald-800"
                              : machine.currentState === "FAULT"
                                ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/30 text-rose-400 dark:border-rose-800 animate-pulse"
                                : machine.currentState === "IDLE"
                                  ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/30 text-amber-400 dark:border-amber-800"
                                  : "bg-slate-100 text-slate-500 border-slate-200 bg-slate-800/60 text-slate-400 border-slate-600"
                          }`}
                        >
                          {machine.currentState || "OFF"}
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border rounded-full shrink-0 ${status.colorClass}`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${status.dotClass} ${
                            machine.currentState === "RUNNING"
                              ? "animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                              : ""
                          }`}
                        />
                        {status.label}
                      </span>
                    </div>
                  </div>

                  {activeWo && (
                    <div className="mb-4 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 text-xs">
                      <span className="font-bold text-blue-300">
                        Active WO: {activeWo.woNumber}
                      </span>
                      {activeWo.product && (
                        <p className="text-slate-400 text-[11px] truncate">
                          {activeWo.product.name}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="my-3 p-4 rounded-xl bg-slate-800/60 border border-slate-700">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Current OEE
                      </span>
                      <span className="text-xs font-medium text-slate-400">
                        Live
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-white">
                        <AnimatedCounter
                          to={Number(oeePct)}
                          formatter={(v) => v.toFixed(1)}
                        />
                        %
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Target: {(machine.oeeTarget ?? 85).toFixed(1)}%
                      </span>
                    </div>

                    <div className="w-full bg-slate-700/40 h-2.5 rounded-full mt-3 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{
                          width: `${Math.min(Number(oeePct), 100)}%`,
                        }}
                        viewport={{ once: true }}
                        transition={{
                          duration: 1.5,
                          ease: "easeOut",
                          delay: 0.2,
                        }}
                        className={`h-full rounded-full ${
                          Number(oeePct) >= thresholds.good
                            ? "bg-emerald-500"
                            : Number(oeePct) >= thresholds.warning
                              ? "bg-amber-500"
                              : "bg-rose-500"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-700/80 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    {(machine.downtimeLogs || []).length} Downtime Events
                  </span>
                  <span className="font-semibold text-blue-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    View Details <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </motion.div>
            </Link>
          );
        })}
      </motion.div>
    </section>
  );
}
