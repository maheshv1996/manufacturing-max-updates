"use client";

import { useState, useEffect, useRef } from "react";
import { Download, Share, PlusSquare } from "lucide-react";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const iosTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsStandalone(true);
      return;
    }

    // Check for iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      if (iosTimerRef.current) {
        clearTimeout(iosTimerRef.current);
        iosTimerRef.current = null;
      }
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSPrompt(true);
      if (iosTimerRef.current) clearTimeout(iosTimerRef.current);
      iosTimerRef.current = setTimeout(() => {
        setShowIOSPrompt(false);
        iosTimerRef.current = null;
      }, 5000);
    }
  };

  if (isStandalone) return null;
  if (!deferredPrompt && !isIOS) return null;

  return (
    <div className="relative inline-block">
      <button
        onClick={handleInstallClick}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 bg-blue-950/40 hover:bg-blue-950/80 border border-blue-800/60 rounded-lg transition-all cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        Install App
      </button>

      {showIOSPrompt && (
        <div
          role="status"
          aria-live="polite"
          className="absolute right-0 mt-2 w-48 p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 text-xs text-slate-200"
        >
          <p className="mb-2 font-semibold">To install on iOS:</p>
          <ol className="list-decimal pl-4 space-y-1">
            <li className="flex items-center gap-1">
              Tap <Share className="w-3 h-3 inline" /> Share
            </li>
            <li className="flex items-center gap-1">
              Tap <PlusSquare className="w-3 h-3 inline" /> Add to Home Screen
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
