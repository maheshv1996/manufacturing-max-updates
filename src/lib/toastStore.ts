import { useState, useEffect } from "react";
import { soundFx } from "./soundFx";

export type Toast = {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
};

let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

export const toast = {
  show: (
    message: string,
    type: "success" | "error" | "info" | "warning" = "info",
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    toasts = [...toasts, { id, message, type }];
    toastListeners.forEach((listener) => listener(toasts));

    // Subtle audio feedback cue
    if (type === "success") {
      soundFx.playSuccess();
    } else if (type === "error" || type === "warning") {
      soundFx.playWarning();
    } else {
      soundFx.playClick();
    }

    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
      toastListeners.forEach((listener) => listener(toasts));
    }, 3000);
  },
  success: (message: string) => toast.show(message, "success"),
  error: (message: string) => toast.show(message, "error"),
  info: (message: string) => toast.show(message, "info"),
  warning: (message: string) => toast.show(message, "warning"),
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
