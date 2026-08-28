"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import UpdateDialog, { type UpdateInfo } from "./UpdateDialog";

type Status = { kind: "ok" | "offline" | "error"; text: string } | null;

const CHECK_TTL = 5 * 60 * 1000; // offer a fresh check after 5 min

/**
 * Bottom-of-rail "Check for Updates" button (64px sidebar). Silent check on
 * mount; amber dot while an update is available; clicking opens the shared
 * UpdateDialog (release notes + Download & Install) or flashes a short status.
 */
export default function SidebarUpdateButton() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkedAt = useRef(0);

  const flash = useCallback((s: Status) => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setStatus(s);
    statusTimer.current = setTimeout(() => setStatus(null), 3000);
  }, []);

  const check = useCallback(
    async (silent = false) => {
      setChecking(true);
      try {
        const res = await fetch("/api/update/check", { cache: "no-store" });
        const data: UpdateInfo = await res.json();
        checkedAt.current = Date.now();
        setInfo(data);
        if (data.updateAvailable) {
          setOpen(true);
        } else if (silent) {
          // nothing — dot/status only on demand
        } else if (data.offline) {
          flash({ kind: "offline", text: "Offline — update feed unreachable" });
        } else {
          flash({ kind: "ok", text: `Up to date (v${data.current ?? ""})` });
        }
      } catch {
        if (!silent) flash({ kind: "error", text: "Update check failed" });
      } finally {
        setChecking(false);
      }
    },
    [flash],
  );

  useEffect(() => {
    check(true);
    return () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
    };
  }, [check]);

  const onClick = () => {
    if (checking) return;
    if (info?.updateAvailable) {
      setOpen(true);
      return;
    }
    const fresh = Date.now() - checkedAt.current < CHECK_TTL;
    if (!fresh || !info) {
      check(false);
    } else if (info.offline) {
      flash({ kind: "offline", text: "Offline — update feed unreachable" });
    } else if (info.error && info.source === "launcher") {
      flash({ kind: "error", text: "Update service unreachable" });
    } else {
      flash({ kind: "ok", text: `Up to date (v${info.current ?? ""})` });
    }
  };

  return (
    <div className="relative flex items-center justify-center">
      {status && (
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap z-30 px-2 py-1 rounded-lg bg-surface-2 border border-border text-[10px] font-medium text-text-2 shadow-lg">
          {status.text}
        </div>
      )}
      <button
        onClick={onClick}
        title="Check for Updates"
        aria-label="Check for Updates"
        className="relative flex items-center justify-center h-11 w-11 rounded-xl bg-surface-2 border border-border text-text-2 hover:text-text-1 hover:bg-surface-3 transition-colors outline-none"
      >
        {checking ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <RefreshCw className="h-5 w-5" />
        )}
        {info?.updateAvailable && !open && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
        )}
      </button>
      <UpdateDialog info={info} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
