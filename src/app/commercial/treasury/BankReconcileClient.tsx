"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Upload, Unlink, Trash2, Landmark } from "lucide-react";

type Entry = any;
type Tx = any;

function parseAmount(s: string): number {
  const cleaned = String(s || "").replace(/[â‚¹,\s]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? NaN : n;
}

function parseDate(s: string): Date | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const dmY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(s || ""));
  if (dmY) return new Date(Number(dmY[3]), Number(dmY[2]) - 1, Number(dmY[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur = "",
    row: string[] = [],
    inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += ch;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => r.some((c) => c !== ""));
}

function toEntry(
  cells: string[],
): {
  date: string;
  description: string;
  amount: number;
  balanceAfter?: number;
} | null {
  if (cells.length < 3) return null;
  const amount = parseAmount(cells[2]);
  const date = parseDate(cells[0]);
  if (isNaN(amount) || !date) return null;
  const balance = cells[3] !== undefined ? parseAmount(cells[3]) : undefined;
  return {
    date: date.toISOString(),
    description: cells[1],
    amount,
    balanceAfter:
      balance !== undefined && !isNaN(balance) ? balance : undefined,
  };
}

const STATUS_BADGE: Record<string, string> = {
  MATCHED: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  MANUAL: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
  UNMATCHED: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
};

const fmt = (v: number) =>
  Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function BankReconcileClient() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [treasury, setTreasury] = useState<Tx[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    matched: 0,
    unmatched: 0,
    autoMatched: 0,
    manualMatched: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/bank-reconcile");
      if (res.ok) {
        const d = await res.json();
        setEntries(d.entries || []);
        setTreasury(d.treasury || []);
        setSummary(d.summary || {});
      }
    } catch (e) {
      logClientError(e, "BankReconcileClient");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const api = async (action: string, data: any) => {
    setBusy(true);
    try {
      const res = await fetch("/api/bank-reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) alert(d.error || "Action failed");
      else {
        await fetchData();
        if (action === "upload")
          setMsg(
            `Imported ${d.record?.imported || 0} rows â€” ${d.record?.autoMatched || 0} auto-matched.`,
          );
      }
    } catch (e) {
      logClientError(e, "BankReconcileClient");
      alert("Action failed");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result || ""));
      const parsed = rows
        .map(toEntry)
        .filter((r): r is NonNullable<typeof r> => r !== null);
      if (!parsed.length) {
        alert(
          "No valid rows found. Expected CSV: date, description, amount [, balance]",
        );
        return;
      }
      api("upload", { rows: parsed });
    };
    reader.readAsText(file);
  };

  const unmatchedTreasury = treasury.filter(
    (t) => !entries.some((e) => e.matchedTreasuryId === t.id),
  );

  return (
    <div className="space-y-5">
      <div className="bg-slate-800/60 rounded-2xl border border-slate-700 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl border bg-blue-500/10 text-blue-400 border-blue-500/30">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white">
                Bank Statement Reconciliation
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload a bank statement CSV (date, description, amount, optional
                balance). Same-day same-amount rows auto-match the treasury
                ledger; the rest can be matched manually.
              </p>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 shrink-0"
          >
            <Upload className="w-4 h-4" />{" "}
            {busy ? "Processing..." : "Upload Statement (CSV)"}
          </button>
        </div>
        {msg && (
          <div className="text-sm font-semibold text-emerald-400">{msg}</div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total Rows", value: summary.total, color: "text-white" },
            {
              label: "Matched",
              value: summary.matched,
              color: "text-emerald-400",
            },
            {
              label: "Unmatched",
              value: summary.unmatched,
              color: "text-rose-400",
            },
            {
              label: "Auto-Matched",
              value: summary.autoMatched,
              color: "text-blue-400",
            },
            {
              label: "Manual Matches",
              value: summary.manualMatched,
              color: "text-cyan-400",
            },
          ].map((c) => (
            <div
              key={c.label}
              className="p-3 rounded-xl border border-slate-600"
            >
              <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">
                {c.label}
              </div>
              <div className={`text-xl font-black font-mono ${c.color}`}>
                {c.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-800/60 border-b border-slate-700">
              <tr>
                {[
                  "Date",
                  "Description",
                  "Amount",
                  "Status",
                  "Treasury Match",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3.5 font-semibold text-slate-200"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 divide-slate-800">
              {entries.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-slate-400 italic"
                  >
                    No statement rows yet â€” upload a CSV to begin.
                  </td>
                </tr>
              )}
              {entries.map((e) => (
                <tr
                  key={e.id}
                  className="hover:bg-slate-800/90/20 transition-colors"
                >
                  <td className="px-5 py-3 text-slate-600 text-slate-300">
                    {new Date(e.date).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-slate-300 max-w-[260px] truncate">
                    {e.description}
                  </td>
                  <td
                    className={`px-5 py-3 font-mono font-bold ${e.amount >= 0 ? "text-emerald-400" : "text-rose-500"}`}
                  >
                    {e.amount >= 0 ? "+" : "âˆ’"}
                    {fmt(Math.abs(e.amount))}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${STATUS_BADGE[e.matchStatus] || STATUS_BADGE.UNMATCHED}`}
                    >
                      {e.matchStatus}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {e.matchedTreasury ? (
                      <div className="text-xs">
                        <div className="font-bold text-white">
                          {e.matchedTreasury.reference || "â€”"}
                        </div>
                        <div className="text-slate-400">
                          {e.matchedTreasury.category || e.matchedTreasury.type}{" "}
                          Â· {fmt(Math.abs(e.matchedTreasury.amount))}
                        </div>
                      </div>
                    ) : (
                      <select
                        value=""
                        onChange={(ev) => {
                          if (ev.target.value)
                            api("match", {
                              entryId: e.id,
                              treasuryId: ev.target.value,
                            });
                        }}
                        className="w-52 bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white"
                      >
                        <option value="">Select treasury txâ€¦</option>
                        {unmatchedTreasury.map((t) => (
                          <option key={t.id} value={t.id}>
                            {new Date(t.date).toLocaleDateString()} Â·{" "}
                            {t.reference || t.category || t.type} Â·{" "}
                            {fmt(Math.abs(t.amount))}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      {e.matchedTreasuryId && (
                        <button
                          onClick={() => api("unmatch", { entryId: e.id })}
                          className="px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-400 rounded-lg text-xs font-bold border border-amber-200 dark:border-amber-800"
                        >
                          <Unlink className="w-3.5 h-3.5 inline mr-1" />
                          Unmatch
                        </button>
                      )}
                      <button
                        onClick={() => api("deleteEntry", { entryId: e.id })}
                        className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-400 rounded-lg text-xs font-bold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
