"use client";

import { useState, useEffect } from "react";
import { subscribeToastMessages, ToastMessage } from "@/lib/offlineSync";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";

export default function OfflineToastNotifier() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToastMessages((newToast) => {
      setToasts((prev) => [newToast, ...prev].slice(0, 5)); // Keep max 5

      // Auto dismiss after 6 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, 6000);
    });

    return () => unsubscribe();
  }, []);

  const handleDismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === "SUCCESS";
        const isConflict = toast.type === "CONFLICT";
        const isError = toast.type === "ERROR";

        const bgClass = isConflict
          ? "bg-rose-950 border-rose-500/50 text-rose-100"
          : isSuccess
            ? "bg-slate-900 border-emerald-500/50 text-emerald-100"
            : isError
              ? "bg-rose-950 border-rose-600 text-rose-100"
              : "bg-slate-900 border-blue-500/50 text-blue-100";

        const Icon = isConflict
          ? AlertTriangle
          : isSuccess
            ? CheckCircle2
            : isError
              ? XCircle
              : Info;

        const iconColor = isConflict
          ? "text-rose-400"
          : isSuccess
            ? "text-emerald-400"
            : isError
              ? "text-rose-500"
              : "text-blue-400";

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl border-2 shadow-2xl backdrop-blur-md transition-all animate-bounce-short flex items-start gap-3 ${bgClass}`}
          >
            <Icon className={`w-6 h-6 shrink-0 ${iconColor} mt-0.5`} />
            <div className="flex-1 space-y-0.5">
              <h4 className="font-extrabold text-sm tracking-tight flex items-center justify-between">
                {toast.title}
              </h4>
              <p className="text-xs opacity-90 leading-snug font-medium">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => handleDismiss(toast.id)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
