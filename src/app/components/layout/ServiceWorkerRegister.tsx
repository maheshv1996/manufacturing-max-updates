"use client";


import { logClientError } from "@/lib/clientLogger";
import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      typeof window !== "undefined" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {
          // registration handled; failures surface via console.error below
        })
        .catch((error) => {
          logClientError("Service Worker registration failed:", error, "ServiceWorkerRegister");
        });
    }
  }, []);

  return null;
}
