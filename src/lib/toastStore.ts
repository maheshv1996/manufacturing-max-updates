import { useState, useEffect } from "react";
import { soundFx } from "./soundFx";

export type Toast = {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
};

const MAX_TOASTS = 5;
let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

function notifyListeners() {
  toastListeners.forEach((listener) => listener(toasts));
}

export const toast = {
  show: (
    message: string,
    type: "success" | "error" | "info" | "warning" = "info",
    durationMs?: number,
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { id, message, type };

    // Limit maximum concurrent toasts to prevent UI pileup
    toasts = [...toasts, newToast].slice(-MAX_TOASTS);
    notifyListeners();

    // Subtle audio feedback cue
    if (type === "success") {
      soundFx.playSuccess();
    } else if (type === "error" || type === "warning") {
      soundFx.playWarning();
    } else {
      soundFx.playClick();
    }

    const duration = durationMs ?? (type === "error" || type === "warning" ? 5000 : 3500);

    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
      notifyListeners();
    }, duration);
  },
  dismiss: (id: string) => {
    toasts = toasts.filter((t) => t.id !== id);
    notifyListeners();
  },
  success: (message: string, durationMs?: number) => toast.show(message, "success", durationMs),
  error: (message: string, durationMs?: number) => toast.show(message, "error", durationMs),
  info: (message: string, durationMs?: number) => toast.show(message, "info", durationMs),
  warning: (message: string, durationMs?: number) => toast.show(message, "warning", durationMs),
};

export function useToast() {
  const [currentToasts, setCurrentToasts] = useState<Toast[]>(toasts);

  useEffect(() => {
    const listener = (newToasts: Toast[]) => setCurrentToasts([...newToasts]);
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  return currentToasts;
}
