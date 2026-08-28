"use client";

import { useCallback, useState } from "react";
import { Download, RefreshCw, Loader2 } from "lucide-react";
import UpdateDialog, { type UpdateInfo } from "./UpdateDialog";

export default function UpdateCard({
  currentVersion,
}: {
  currentVersion: string;
}) {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/update/check", { cache: "no-store" });
      const data = await res.json();
      setInfo(data);
      if (data?.updateAvailable) setShowModal(true);
    } catch {
      setInfo({ offline: true });
    } finally {
      setChecking(false);
    }
  }, []);

  return (
    <div className="bg-surface-1 rounded-card border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-1 flex items-center gap-2">
            <Download className="h-4 w-4 text-sky-500" /> Online Update Channel
          </h3>
          <p className="text-xs text-text-3 mt-0.5">
            Installed: <span className="font-mono">v{currentVersion}</span>
            {info?.latest && info.latest !== currentVersion && (
              <>
                {" "}
                · Latest:{" "}
                <span className="font-mono text-sky-500">v{info.latest}</span>
              </>
            )}
          </p>
        </div>
        <button
          onClick={check}
          disabled={checking}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-sm font-medium text-text-1 hover:bg-surface-3 disabled:opacity-50 transition-colors"
        >
          {checking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Check for Updates
        </button>
      </div>

      {info?.offline && !info.updateAvailable && (
        <p className="mt-3 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          Offline — use <span className="font-semibold">Update from File</span>{" "}
          (pendrive flow) in the launcher tray.
        </p>
      )}
      {info?.error && info.source === "launcher" && (
        <p className="mt-3 text-xs text-rose-500 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
          Update service unreachable ({info.error}) — is the launcher running?
        </p>
      )}

      <UpdateDialog
        info={info}
        open={showModal}
        currentVersion={currentVersion}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
}
