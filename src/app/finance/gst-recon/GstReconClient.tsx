"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  Upload,
  FileSpreadsheet,
  SearchCheck,
  CheckCircle2,
  XCircle,
  PhoneCall,
  FolderOpen,
} from "lucide-react";

const STATUS_STYLE: Record<string, string> = {
  MATCHED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  AMOUNT_DIFF: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  NOT_IN_REGISTER: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  MISSING_FROM_CSV: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  RESOLVED: "bg-sky-500/15 text-sky-300 border-sky-500/40",
};

interface Run {
  id: string;
  period: string;
  label: string | null;
  rows: any[];
  stats: {
    matched: number;
    amountDiff: number;
    notInRegister: number;
    missingFromCsv: number;
    total: number;
    registerTotal: number;
    csvTotal: number;
  };
  followUps: { at: string; by: string; note: string }[];
  status: string;
  uploadedBy: string;
  createdAt: string;
}

const HEADER_ALIASES: Record<string, string> = {
  "gstin of supplier": "gstin",
  gstin: "gstin",
  "supplier gstin": "gstin",
  "trade/legal name of supplier": "supplierName",
  "legal name of supplier": "supplierName",
  "supplier name": "supplierName",
  supplier: "supplierName",
  "invoice no.": "invoiceNumber",
  "invoice no": "invoiceNumber",
  "invoice date": "invoiceDate",
  date: "invoiceDate",
  "invoice value": "total",
  total: "total",
  "taxable value": "taxable",
  taxable: "taxable",
  igst: "tax",
  cgst: "tax",
  sgst: "tax",
  "tax amount": "tax",
  tax: "tax",
};

function parseCsv(text: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const lines = text.split(/\r?\n/);
  let headers: string[] = [];
  lines.forEach((raw, i) => {
    if (!raw.trim()) return;
    const fields: string[] = [];
    let cur = "";
    let inQ = false;
    for (let ci = 0; ci < raw.length; ci++) {
      const ch = raw[ci];
      if (ch === '"') {
        if (inQ && raw[ci + 1] === '"') {
          cur += '"';
          ci++;
        } else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        fields.push(cur);
        cur = "";
      } else cur += ch;
    }
    fields.push(cur);
    if (i === 0) {
      headers = fields.map((h) => h.trim().toLowerCase());
      return;
    }
    const row: Record<string, string> = {};
    headers.forEach((h, hi) => {
      const key = HEADER_ALIASES[h];
      if (key) row[key] = (fields[hi] || "").trim();
    });
    rows.push(row);
  });
  return rows;
}

function normalizeDate(s: string): string {
  if (!s) return "";
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s;
}

const MONTHS = Array.from({ length: 24 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - i);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return {
    value: `${y}-${m}`,
    label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
  };
});

export default function GstReconClient() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState(MONTHS[0].value);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [resolveFor, setResolveFor] = useState<{
    runId: string;
    index: number;
  } | null>(null);
  const [resolveNote, setResolveNote] = useState("");

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/gst-recon");
      if (!res.ok) throw new Error("failed");
      setRuns(await res.json().then((d) => d.runs || []));
    } catch (e: any) {
      setMsg(e.message || "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const onFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      setRows(parseCsv(String(e.target?.result || "")));
      setMsg(
        `Parsed ${rows.length} rows from ${file.name} — upload to reconcile.`,
      );
    };
    reader.readAsText(file);
  };

  const upload = async () => {
    setMsg("");
    if (rows.length === 0) {
      setMsg("Choose a CSV first");
      return;
    }
    setBusy(true);
    try {
      const payload = rows.map((r) => ({
        gstin: r.gstin || "",
        supplierName: r.supplierName || "",
        invoiceNumber: r.invoiceNumber || "",
        invoiceDate: normalizeDate(r.invoiceDate || ""),
        taxable: Number(r.taxable || 0),
        tax: Number(r.tax || 0),
        total: Number(r.total || 0),
      }));
      const res = await fetch("/api/gst-recon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-run",
          period,
          label: fileName,
          rows: payload,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const s = data.run.stats;
        setMsg(
          `${period}: ${s.matched} matched · ${s.amountDiff} amount diff · ${s.notInRegister} not in register · ${s.missingFromCsv} missing from CSV`,
        );
        setRows([]);
        setFileName("");
        if (fileRef.current) fileRef.current.value = "";
        setExpanded(data.run.id);
        await fetchRuns();
      } else setMsg(data.error || "Upload failed");
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  };

  const post = async (runId: string, action: string, extra: any = {}) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/gst-recon/${runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(
          `${action === "add-followup" ? "Follow-up logged" : action === "resolve-row" ? "Row resolved" : "Run closed"}`,
        );
        setNote("");
        setResolveFor(null);
        setResolveNote("");
        await fetchRuns();
      } else setMsg(data.error || "Action failed");
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const csv = [
      "GSTIN of supplier,Trade/Legal name of supplier,Invoice no.,Invoice date,Taxable value,IGST,CGST,SGST,Invoice value",
      "27AAACT1234F1Z5,Acme Traders Pvt Ltd,INV-2026-0011,01/07/2026,90000,16200,0,0,106200",
      "27AAADR5987K1Z2,SteelCorp India,INV-2026-0142,14/07/2026,45000,0,4050,4050,53100",
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "gstr-2b-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-emerald-300 font-semibold">{msg}</p>}

      {/* Upload card */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Upload className="h-4 w-4 text-emerald-400" /> Reconcile a GSTR-2B
            CSV against the purchase register
          </h3>
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-300 hover:text-sky-200 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Download template
          </button>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-slate-900/80 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            className="text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-slate-600 transition-colors"
          />
          {fileName && (
            <span className="text-xs text-slate-400 font-mono">
              {fileName} · {rows.length} rows parsed
            </span>
          )}
          <button
            onClick={upload}
            disabled={busy || rows.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-bold px-4 py-2 shadow-md transition-all disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SearchCheck className="h-4 w-4" />
            )}{" "}
            Reconcile
          </button>
        </div>
        <p className="text-[11px] text-slate-500 mt-3">
          Matches by <b>GSTIN + invoice number</b> (tolerance ₹5): MATCHED ·
          AMOUNT_DIFF (register amount disagrees) · NOT_IN_REGISTER (CSV only) ·
          MISSING_FROM_CSV (register invoices in the month absent from the 2B —
          reverse scan). Mismatches land in the follow-up list.
        </p>
      </div>

      {/* Runs */}
      {loading && (
        <p className="text-center text-slate-500 py-6">
          <Loader2 className="h-5 w-5 animate-spin inline" /> Loading runs…
        </p>
      )}
      {!loading && runs.length === 0 && (
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-8 text-center text-slate-500">
          No reconciliation runs yet. Export your GSTR-2B to CSV and upload it
          above.
        </div>
      )}

      {runs.map((run) => {
        const followers = run.rows.filter(
          (r) => r.status !== "MATCHED" && r.status !== "RESOLVED",
        );
        const isOpen = expanded === run.id;
        return (
          <div
            key={run.id}
            className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden"
          >
            <button
              onClick={() => setExpanded(isOpen ? null : run.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-700/30 transition-colors text-left"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <FolderOpen className="h-4 w-4 text-emerald-400" />
                <div>
                  <p className="font-bold text-white">
                    {run.period} · {run.label || "2B upload"}
                    <span
                      className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${run.status === "CLOSED" ? "bg-slate-500/15 text-slate-300 border-slate-500/40" : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"}`}
                    >
                      {run.status}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    by {run.uploadedBy} ·{" "}
                    {new Date(run.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-1.5 text-[10px] font-extrabold">
                <span className="rounded-full border border-emerald-500/40 text-emerald-300 px-2 py-0.5 bg-emerald-500/10">
                  {run.stats.matched} ✓
                </span>
                {run.stats.amountDiff > 0 && (
                  <span className="rounded-full border border-amber-500/40 text-amber-300 px-2 py-0.5 bg-amber-500/10">
                    {run.stats.amountDiff} Δ
                  </span>
                )}
                {run.stats.notInRegister > 0 && (
                  <span className="rounded-full border border-rose-500/40 text-rose-300 px-2 py-0.5 bg-rose-500/10">
                    {run.stats.notInRegister} ✗
                  </span>
                )}
                {run.stats.missingFromCsv > 0 && (
                  <span className="rounded-full border border-orange-500/40 text-orange-300 px-2 py-0.5 bg-orange-500/10">
                    {run.stats.missingFromCsv} ⇐
                  </span>
                )}
                {followers.length > 0 && (
                  <span className="rounded-full border border-sky-500/40 text-sky-300 px-2 py-0.5 bg-sky-500/10 animate-pulse">
                    {followers.length} to follow up
                  </span>
                )}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-slate-700">
                <div className="px-5 py-3 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-xl bg-slate-900/60 border border-slate-700 p-3">
                    <p className="text-slate-500">CSV value</p>
                    <p className="font-mono font-bold text-white">
                      {fmt(run.stats.csvTotal)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-900/60 border border-slate-700 p-3">
                    <p className="text-slate-500">Register value</p>
                    <p className="font-mono font-bold text-white">
                      {fmt(run.stats.registerTotal)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-900/60 border border-slate-700 p-3">
                    <p className="text-slate-500">Matched</p>
                    <p className="font-mono font-bold text-emerald-300">
                      {run.stats.matched}/{run.stats.total}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-900/60 border border-slate-700 p-3">
                    <p className="text-slate-500">Follow-ups</p>
                    <p className="font-mono font-bold text-sky-300">
                      {run.followUps.length}
                    </p>
                  </div>
                </div>

                {/* Follow-up list — the mismatches */}
                <div className="px-5 pb-2">
                  <h4 className="text-xs font-bold text-slate-300 mb-2">
                    Mismatch follow-up list
                  </h4>
                  {followers.length === 0 && run.stats.matched > 0 && (
                    <p className="text-xs text-emerald-400 mb-3">
                      Clean — everything matched. 🎉
                    </p>
                  )}
                  <div className="space-y-2">
                    {run.rows.map((r) => {
                      if (r.status === "MATCHED" || r.status === "RESOLVED")
                        return null;
                      return (
                        <div
                          key={`${r.idx}-${r.invoiceNumber}`}
                          className="rounded-xl bg-slate-900/60 border border-slate-700 p-3 flex items-start justify-between gap-3 flex-wrap"
                        >
                          <div className="min-w-[240px]">
                            <p className="text-sm font-bold text-white">
                              {r.supplierName || r.gstin}
                            </p>
                            <p className="text-xs font-mono text-slate-400">
                              {r.gstin} · {r.invoiceNumber} ·{" "}
                              {r.invoiceDate || "?"}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              Net {fmt(r.taxable)} · Tax {fmt(r.tax)} · Total{" "}
                              <span className="font-bold">{fmt(r.total)}</span>
                              {r.diff ? (
                                <span className="text-amber-300 font-bold">
                                  {" "}
                                  · diff {fmt(r.diff)}
                                </span>
                              ) : null}
                            </p>
                            {r.note && (
                              <p className="text-[11px] text-slate-500 mt-1">
                                {r.note}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${STATUS_STYLE[r.status] || STATUS_STYLE.NOT_IN_REGISTER}`}
                            >
                              {r.status}
                            </span>
                            <button
                              onClick={() =>
                                setResolveFor({ runId: run.id, index: r.idx })
                              }
                              className="px-2.5 py-1 bg-sky-500/15 text-sky-300 border border-sky-500/40 rounded-lg text-[11px] font-bold hover:bg-sky-500/25 transition-colors"
                            >
                              Resolve
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {run.rows.filter((r) => r.status === "RESOLVED").length >
                      0 && (
                      <div className="pt-1">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                          Resolved
                        </p>
                        {run.rows
                          .filter((r) => r.status === "RESOLVED")
                          .map((r) => (
                            <div
                              key={`res-${r.idx}`}
                              className="rounded-xl bg-sky-950/20 border border-sky-500/30 p-2 text-xs flex justify-between gap-3 flex-wrap"
                            >
                              <span className="text-slate-300 font-mono">
                                {r.invoiceNumber} · {r.supplierName || r.gstin}
                              </span>
                              <span className="text-slate-500">
                                {r.note?.replace(/.*Resolved:\s*/, "→ ") ||
                                  "resolved"}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Run follow-ups */}
                <div className="px-5 pb-4 pt-2 border-t border-slate-700 mt-2">
                  <div className="flex items-center gap-2">
                    <PhoneCall className="h-3.5 w-3.5 text-sky-400" />
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Log a follow-up — e.g. called supplier for corrected invoice, waiting on re-issue"
                      className="flex-1 bg-slate-900/80 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button
                      onClick={() =>
                        note.trim() && post(run.id, "add-followup", { note })
                      }
                      disabled={busy || !note.trim()}
                      className="px-3 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-lg transition-colors"
                    >
                      Log
                    </button>
                    {run.status === "OPEN" && (
                      <button
                        onClick={() => post(run.id, "close")}
                        disabled={busy || followers.length > 0}
                        title={
                          followers.length > 0
                            ? "Resolve outstanding mismatches first"
                            : "Close this reconciliation period"
                        }
                        className="px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-lg transition-colors"
                      >
                        Close period
                      </button>
                    )}
                  </div>
                  {run.followUps.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {run.followUps.map((f, i) => (
                        <p
                          key={i}
                          className="text-xs text-slate-400 border-l-2 border-sky-500/50 pl-2"
                        >
                          <span className="font-bold text-white">{f.by}</span> ·{" "}
                          {f.note}
                          <span className="text-[10px] text-slate-600">
                            {" "}
                            · {new Date(f.at).toLocaleString()}
                          </span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Resolve modal */}
      {resolveFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-sky-400" /> Resolve mismatch
            </h3>
            <p className="text-xs text-slate-400">
              Record how this was closed — e.g. corrected invoice received,
              claim filed, or credited.
            </p>
            <textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="Resolution note *"
              className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm h-20 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setResolveFor(null)}
                className="px-4 py-2 text-sm font-bold text-slate-400 hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  resolveNote.trim() &&
                  post(resolveFor.runId, "resolve-row", {
                    index: resolveFor.index,
                    note: resolveNote,
                  })
                }
                disabled={busy || !resolveNote.trim()}
                className="px-4 py-2 text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-xl shadow-sm transition-all"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin inline" />
                ) : (
                  <XCircle className="h-4 w-4 inline" />
                )}{" "}
                Mark resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
