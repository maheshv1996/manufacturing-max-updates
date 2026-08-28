"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "@/lib/toastStore";
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { usePathname } from "next/navigation";

export function ToastContainer() {
  const toasts = useToast();
  const pathname = usePathname();

  // Calm areas - no animations
  const isCalmArea =
    pathname?.startsWith("/operator") || pathname?.startsWith("/reports");

  return (
    <div className="fixed bottom-5 right-5 z-[120] flex flex-col gap-2.5 pointer-events-none max-w-sm w-full">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={
              isCalmArea ? { opacity: 1 } : { opacity: 0, y: 30, scale: 0.9 }
            }
            animate={
              isCalmArea ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              isCalmArea
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.8, transition: { duration: 0.15 } }
            }
            layout={!isCalmArea}
            transition={{ type: "spring", stiffness: 450, damping: 28 }}
            className={`pointer-events-auto flex items-start justify-between gap-3 px-4 py-3.5 rounded-2xl shadow-2xl backdrop-blur-xl border ${
              t.type === "success"
                ? "bg-emerald-950/90 text-emerald-100 border-emerald-500/40 shadow-emerald-950/40"
                : t.type === "error"
                  ? "bg-rose-950/90 text-rose-100 border-rose-500/40 shadow-rose-950/40"
                  : t.type === "warning"
                    ? "bg-amber-950/90 text-amber-100 border-amber-500/40 shadow-amber-950/40"
                    : "bg-slate-900/95 text-slate-100 border-cyan-500/40 shadow-slate-950/40"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {t.type === "success" && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                )}
                {t.type === "error" && (
                  <AlertCircle className="w-5 h-5 text-rose-400" />
                )}
                {t.type === "warning" && (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                )}
                {(!t.type || t.type === "info") && (
                  <Info className="w-5 h-5 text-cyan-400" />
                )}
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-semibold leading-snug block">
                  {t.message}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
