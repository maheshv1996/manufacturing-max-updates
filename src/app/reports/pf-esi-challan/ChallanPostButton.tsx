"use client";

import { useState, useEffect } from "react";
import { Landmark, CheckCircle2 } from "lucide-react";

export default function ChallanPostButton({
  month,
  challanNo,
  amount,
}: {
  month: string;
  challanNo: string;
  amount: number;
}) {
  const [posted, setPosted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/register/treasuryTransactions")
      .then((r) => r.json())
      .then((d) => {
        const rows = d.rows || [];
        if (rows.some((r: any) => r.reference === challanNo)) setPosted(true);
      })
      .catch(() => {});
  }, [challanNo]);

  const post = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/register/treasuryTransactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          data: {
            date: new Date().toISOString().slice(0, 10),
            type: "OUTFLOW",
            account: "Main",
            amount,
            reference: challanNo,
            category: "Statutory",
            notes: `PF/ESI challan ${month} auto-posted from challan generator`,
          },
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) alert(d.error || "Post failed");
      else setPosted(true);
    } catch (e) {
      console.error(e);
      alert("Post failed");
    } finally {
      setBusy(false);
    }
  };

  if (posted) {
    return (
      <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-400 text-sm font-bold rounded-xl border border-emerald-200 dark:border-emerald-800">
        <CheckCircle2 className="w-4 h-4" /> Posted to Treasury
      </span>
    );
  }

  return (
    <button
      onClick={post}
      disabled={busy}
      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
      title="Creates an OUTFLOW Statutory transaction in the treasury ledger"
    >
      <Landmark className="w-4 h-4" />{" "}
      {busy ? "Posting..." : "Post to Treasury Ledger"}
    </button>
  );
}
