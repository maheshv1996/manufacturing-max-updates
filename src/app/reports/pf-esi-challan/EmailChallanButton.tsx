"use client";

import { useState } from "react";
import { Mail, CheckCircle2 } from "lucide-react";

export default function EmailChallanButton({ month }: { month: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>("");

  const email = async () => {
    setBusy(true);
    setResult("");
    try {
      const res = await fetch("/api/treasury/email-challan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) alert(d.error || "Email failed");
      else setResult(d.message || "Done.");
    } catch (e) {
      console.error(e);
      alert("Email failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {result && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-200 dark:border-emerald-800 max-w-[260px]">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />{" "}
          <span className="truncate">{result}</span>
        </span>
      )}
      <button
        onClick={email}
        disabled={busy}
        className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
        title="Emails the challan summary to the owner role"
      >
        <Mail className="w-4 h-4" /> {busy ? "Emailing..." : "Email Challan"}
      </button>
    </div>
  );
}
