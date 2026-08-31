"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useToast, toast } from "@/lib/toastStore";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { usePathname } from "next/navigation";

export function ToastContainer() {
  const toasts = useToast();
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();

  // Calm areas - minimal animations
  const isCalmArea =
    shouldReduceMotion ||
    pathname?.startsWith("/operator") ||
    pathname?.startsWith("/reports") ||
    pathname?.startsWith("/terminal");

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:right-5 sm:bottom-5 z-[120] flex flex-col gap-2.5 pointer-events-none max-w-sm w-auto sm:w-full"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            role={t.type === "error" ? "alert" : "status"}
            initial={
              isCalmArea
                ? { opacity: 0 }
                : { opacity: 0, y: 20, scale: 0.96 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              isCalmArea
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.9, transition: { duration: 0.15 } }
            }
            layout={!isCalmArea}
            transition={{
              type: "spring",
              stiffness: 320,
              damping: 26,
            }}
            className={`pointer-events-auto flex items-start justify-between gap-3 px-4 py-3.5 rounded-2xl shadow-2xl backdrop-blur-xl border ${
              t.type === "success"
                ? "bg-emerald-950/95 text-emerald-100 border-emerald-500/40 shadow-emerald-950/40"
                : t.type === "error"
                  ? "bg-rose-950/95 text-rose-100 border-rose-500/40 shadow-rose-950/40"
                  : t.type === "warning"
                    ? "bg-amber-950/95 text-amber-100 border-amber-500/40 shadow-amber-950/40"
                    : "bg-slate-900/95 text-slate-100 border-cyan-500/40 shadow-slate-950/40"
            }`}
          >
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="mt-0.5 shrink-0" aria-hidden="true">
                {t.type === "success" && (
                  <CheckCircle2 className="size-5 text-emerald-400" />
                )}
                {t.type === "error" && (
                  <AlertCircle className="size-5 text-rose-400" />
                )}
                {t.type === "warning" && (
                  <AlertTriangle className="size-5 text-amber-400" />
                )}
                {(!t.type || t.type === "info") && (
                  <Info className="size-5 text-cyan-400" />
                )}
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="text-xs font-semibold leading-snug block break-words">
                  {t.message}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="p-1 -mr-1 -mt-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
