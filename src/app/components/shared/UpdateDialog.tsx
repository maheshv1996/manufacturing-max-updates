"use client";

import { useEffect, useRef, useState } from "react";
import { Download, X, ShieldAlert, CheckCircle2 } from "lucide-react";

export interface UpdateInfo {
  offline?: boolean;
  updateAvailable?: boolean;
  current?: string;
  latest?: string;
  notes?: string;
  sizeMb?: number;
  source?: string;
  error?: string;
}

interface Progress {
  phase: string;
  pct?: number;
  received?: number;
  total?: number;
  error?: string;
}

/**
 * Shared "Update available" modal: release notes + Download & Install with
 * live launcher progress polling. Used by the /system/health UpdateCard and
 * the sidebar check-for-updates button.
 */
export default function UpdateDialog({
  info,
  open,
  currentVersion,
  onClose,
}: {
  info: UpdateInfo | null;
  open: boolean;
  currentVersion?: string;
  onClose: () => void;
}) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [applying, setApplying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current);
    },
    [],
  );

  // Reset modal state on close (a re-check after a failure starts clean).
  useEffect(() => {
    if (!open) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setProgress(null);
      setApplying(false);
    }
  }, [open]);

  const startInstall = async () => {
    setApplying(true);
    setProgress({ phase: "starting" });
    try {
      const res = await fetch("/api/update/apply", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setProgress({ phase: "error", error: data.error || "Apply failed" });
        setApplying(false);
        return;
      }
      // Poll launcher progress.
      pollRef.current = setInterval(async () => {
        try {
          const pr = await fetch("/api/update/progress", { cache: "no-store" });
          const p = await pr.json();
          setProgress(p);
          if (p.phase === "applying" || p.phase === "error") {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            setApplying(false);
          }
        } catch {
          // server may be mid-restart — treat as applying
          setProgress({ phase: "applying" });
        }
      }, 600);
    } catch {
      setProgress({ phase: "error", error: "UNREACHABLE" });
      setApplying(false);
    }
  };

  if (!open || !info?.updateAvailable) return null;

  const isDesktop = info.source === "launcher";
  const phase = progress?.phase;
  const pct = progress?.pct || 0;
  const installed = info.current ?? currentVersion ?? "";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-1 rounded-card border border-border shadow-modal max-w-md w-full overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-text-1 flex items-center gap-2">
            <Download className="h-5 w-5 text-sky-500" /> Update available
          </h3>
          <button
            onClick={onClose}
            className="text-text-3 hover:text-text-1 p-1 rounded-control hover:bg-surface-3"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-text-1">
            <span className="font-bold text-sky-500">v{info.latest}</span> is
            available
            {installed && (
              <span className="text-text-3"> (current v{installed})</span>
            )}
          </p>
          {info.sizeMb ? (
            <p className="text-xs text-text-3 mt-0.5">
              {info.sizeMb} MB download
            </p>
          ) : null}
          {info.notes && (
            <div className="mt-3 p-3 bg-surface-2 border border-border rounded-lg text-xs text-text-2 leading-relaxed whitespace-pre-line max-h-28 overflow-y-auto">
              {info.notes}
            </div>
          )}

          {progress && (phase === "downloading" || phase === "verifying") && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-text-2 mb-1">
                <span>
                  {phase === "verifying"
                    ? "Verifying checksum…"
                    : "Downloading installer…"}
                </span>
                <span className="font-mono">{Math.round(pct)}%</span>
              </div>
              <div className="h-2 bg-surface-2 border border-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
          {phase === "applying" && (
            <p className="mt-4 flex items-center gap-2 text-sm text-emerald-500 font-medium">
              <CheckCircle2 className="h-4 w-4" /> Installer launched — the app
              will close, install, and reopen.
            </p>
          )}
          {phase === "error" && (
            <p className="mt-4 flex items-center gap-2 text-sm text-rose-500 bg-rose-500/10 border border-rose-500/40 rounded-lg px-3 py-2 font-semibold">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              {progress?.error === "CHECKSUM_MISMATCH"
                ? "SECURITY ALERT: download failed checksum verification. Aborted — the file was deleted. Try again or use Update from File."
                : `Update failed: ${progress?.error || "UNKNOWN"}. No changes were made.`}
            </p>
          )}
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          {!isDesktop && (
            <p className="text-xs text-text-3 mr-auto self-center">
              Install requires the desktop edition.
            </p>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium text-text-2 hover:text-text-1 hover:bg-surface-3 rounded-lg"
          >
            Later
          </button>
          {isDesktop && !applying && phase !== "applying" && (
            <button
              onClick={startInstall}
              disabled={phase === "downloading" || phase === "verifying"}
              className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-semibold bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Download & Install
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
