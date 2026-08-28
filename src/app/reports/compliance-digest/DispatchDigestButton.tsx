"use client";

import { useState } from "react";
import { Send, CheckCircle2 } from "lucide-react";

export default function DispatchDigestButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>("");

  const dispatch = async () => {
    setBusy(true);
    setResult("");
    try {
      const res = await fetch("/api/compliance/digest/send", {
        method: "POST",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) alert(d.error || "Dispatch failed");
      else setResult(d.message || "Digest dispatched.");
    } catch (e) {
      console.error(e);
      alert("Dispatch failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-3.5 h-3.5" /> {result}
        </span>
      )}
      <button
        onClick={dispatch}
        disabled={busy}
        className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-200 bg-slate-800/60 border border-slate-700 rounded-xl hover:bg-slate-800/90 transition-colors shadow-sm no-print"
        title="Records a dispatch to the owner role (connect an email gateway to actually email)"
      >
        <Send className="w-4 h-4" />
        <span className="hidden sm:inline">
          {busy ? "Dispatching..." : "Dispatch to Owner"}
        </span>
      </button>
    </div>
  );
}
