"use client";

import { useCallback, useEffect, useState } from "react";
import {
  HandCoins,
  AlertTriangle,
  PhoneCall,
  FileWarning,
  Loader2,
  Mail,
  Printer,
} from "lucide-react";
import { Button, Input, Select } from "@/app/components/ui";

interface Account {
  id: string;
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string | null;
  totalValue: number;
  paidAmount: number;
  outstanding: number;
  days: number;
  bucket: string;
  status: string;
  account: {
    id: string;
    dunningLevel: number;
    lastDunningAt: string | null;
    followUps: { at: string; by: string; note: string }[];
    notes: string | null;
    collector: {
      id: string;
      name: string;
      employeeNumber: string | null;
    } | null;
  } | null;
}
interface Collector {
  id: string;
  name: string;
  employeeNumber: string | null;
  role: { name: string } | null;
}

const BUCKET_STYLE: Record<string, string> = {
  "0-30": "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  "31-60": "bg-amber-500/15 text-amber-300 border-amber-500/40",
  "61-90": "bg-orange-500/15 text-orange-300 border-orange-500/40",
  "90+": "bg-rose-500/15 text-rose-300 border-rose-500/40",
};

export default function CollectionsClient() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [buckets, setBuckets] = useState<any[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [stats, setStats] = useState<any>({});
  const [total, setTotal] = useState(0);
  const [, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [noteFor, setNoteFor] = useState<Account | null>(null);
  const [note, setNote] = useState("");
  const [assignFor, setAssignFor] = useState<Account | null>(null);
  const [collectorId, setCollectorId] = useState("");
  const [assignReason, setAssignReason] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/collections");
      const data = await res.json();
      setAccounts(data.accounts || []);
      setBuckets(data.buckets || []);
      setCollectors(data.collectors || []);
      setStats(data.stats || {});
      setTotal(data.totalOutstanding || 0);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const act = async (action: string, payload: any) => {
    setMsg("");
    setBusy(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data: payload }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(`Done — ${action}`);
        await fetchAll();
      } else {
        setMsg(data.error || "Action failed");
      }
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  };

  const sendDunning = (a: Account) => {
    const next = (a.account?.dunningLevel || 0) + 1;
    const why = window.prompt(
      `Issue L${next} dunning letter to ${a.customerName}? Confirm by typing the letter reference.`,
      `DUN-${a.invoiceNumber}-L${next}`,
    );
    if (why) act("dunning", { id: a.id, level: next });
  };

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-emerald-300 font-semibold">{msg}</p>}

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            label: "Total outstanding",
            value: `₹${total.toLocaleString("en-IN")}`,
            icon: <HandCoins className="h-5 w-5 text-emerald-500" />,
          },
          {
            label: "Accounts",
            value: accounts.length,
            icon: <Mail className="h-5 w-5 text-sky-500" />,
          },
          {
            label: "Unassigned",
            value: stats.unassigned ?? "—",
            icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
            tone: (stats.unassigned || 0) > 0 ? "text-amber-400" : undefined,
          },
          {
            label: "Dunning L1/L2/L3",
            value: `${stats.l1 ?? 0}/${stats.l2 ?? 0}/${stats.l3 ?? 0}`,
            icon: <FileWarning className="h-5 w-5 text-rose-500" />,
          },
          {
            label: "90+ days",
            value: buckets.find((b) => b.key === "90+")?.count ?? 0,
            icon: <AlertTriangle className="h-5 w-5 text-rose-400" />,
            tone:
              (buckets.find((b) => b.key === "90+")?.count || 0) > 0
                ? "text-rose-400"
                : undefined,
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 flex items-center gap-3"
          >
            {k.icon}
            <div>
              <p className={`text-2xl font-black text-white ${k.tone || ""}`}>
                {k.value}
              </p>
              <p className="text-xs text-slate-400">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Aging buckets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {buckets.map((b) => (
          <div
            key={b.key}
            className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4"
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-bold rounded-full border px-2 py-0.5 ${BUCKET_STYLE[b.key]}`}
              >
                {b.label}
              </span>
              <span className="text-xs text-slate-500">{b.count} invoices</span>
            </div>
            <p className="mt-2 text-xl font-black text-white tabular-nums">
              ₹{Math.round(b.outstanding).toLocaleString("en-IN")}
            </p>
          </div>
        ))}
      </div>

      {/* Accounts table */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="font-bold text-white">
            Receivables — assigned collections
          </h3>
          <span className="text-xs text-slate-400">
            select a row to assign / follow up / dunning
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                <th className="px-5 py-3">Invoice</th>
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3 text-right">Outstanding</th>
                <th className="px-3 py-3">Age</th>
                <th className="px-3 py-3">Bucket</th>
                <th className="px-3 py-3">Collector</th>
                <th className="px-3 py-3">Dunning</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => {
                const lvl = a.account?.dunningLevel || 0;
                return (
                  <tr
                    key={a.id}
                    className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="px-5 py-3 font-semibold text-white">
                      {a.invoiceNumber}
                    </td>
                    <td className="px-3 py-3 text-slate-300">
                      {a.customerName}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-slate-200 tabular-nums">
                      ₹{a.outstanding.toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-3 text-slate-300">{a.days}d</td>
                    <td className="px-3 py-3">
                      <span
                        className={`text-[10px] font-bold rounded-full border px-2 py-0.5 ${BUCKET_STYLE[a.bucket] || BUCKET_STYLE["0-30"]}`}
                      >
                        {a.bucket}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-300">
                      {a.account?.collector ? (
                        a.account.collector.name
                      ) : (
                        <span className="text-amber-400/80">unassigned</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {lvl === 0 ? (
                        <span className="text-[10px] text-slate-500">—</span>
                      ) : (
                        <span
                          className={`text-[10px] font-bold rounded-full border px-2 py-0.5 ${lvl >= 3 ? "bg-rose-500/20 text-rose-300 border-rose-500/40" : lvl === 2 ? "bg-orange-500/15 text-orange-300 border-orange-500/40" : "bg-amber-500/15 text-amber-300 border-amber-500/40"}`}
                        >
                          L{lvl}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setAssignFor(a);
                            setCollectorId(a.account?.collector?.id || "");
                            setAssignReason("");
                          }}
                          className="rounded-lg bg-sky-500/15 text-sky-300 border border-sky-500/40 px-2 py-1 text-[11px] font-semibold hover:bg-sky-500/25"
                        >
                          Assign
                        </button>
                        <button
                          onClick={() => {
                            setNoteFor(a);
                            setNote("");
                          }}
                          className="rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 px-2 py-1 text-[11px] font-semibold hover:bg-emerald-500/25"
                        >
                          <PhoneCall className="h-3 w-3 inline mr-0.5" />{" "}
                          Follow-up
                        </button>
                        <button
                          onClick={() => sendDunning(a)}
                          disabled={lvl >= 3}
                          className="rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/40 px-2 py-1 text-[11px] font-semibold hover:bg-rose-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <FileWarning className="h-3 w-3 inline mr-0.5" /> L
                          {lvl + 1}
                        </button>
                        {lvl > 0 && a.account?.id && (
                          <a
                            href={`/reports/dunning/${a.account.id}`}
                            target="_blank"
                            className="rounded-lg bg-white/5 text-slate-300 border border-slate-600 px-2 py-1 text-[11px] font-semibold hover:bg-white/10"
                          >
                            <Printer className="h-3 w-3 inline mr-0.5" /> Letter
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {accounts.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-8 text-center text-sm text-slate-500"
                  >
                    No open receivables — everything is collected. 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Follow-up modal */}
      {noteFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4">
            <h3 className="font-bold text-white">
              Weekly follow-up — {noteFor.invoiceNumber} ({noteFor.customerName}
              )
            </h3>
            <p className="text-xs text-slate-400">
              ₹{noteFor.outstanding.toLocaleString("en-IN")} outstanding ·{" "}
              {noteFor.days}d in bucket {noteFor.bucket}
            </p>
            {(() => {
              const acc = noteFor.account;
              const fups = acc?.followUps || [];
              return fups.length > 0 ? (
                <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-3 space-y-2 max-h-32 overflow-y-auto">
                  {fups.slice(-4).map((f, i) => (
                    <p key={i} className="text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-300">
                        {f.by}
                      </span>{" "}
                      · {new Date(f.at).toLocaleDateString()} — {f.note}
                    </p>
                  ))}
                </div>
              ) : null;
            })()}
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What happened this week — call / mail / promise to pay?"
            />
            <Button
              disabled={busy || !note}
              onClick={() =>
                act("log-followup", { id: noteFor.id, note }).then(() =>
                  setNoteFor(null),
                )
              }
              className="w-full"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PhoneCall className="h-4 w-4" />
              )}{" "}
              Log follow-up
            </Button>
          </div>
        </div>
      )}

      {/* Assign modal */}
      {assignFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4">
            <h3 className="font-bold text-white">
              Assign collector — {assignFor.invoiceNumber}
            </h3>
            <div>
              <label className="text-xs text-slate-400 font-semibold">
                Collector
              </label>
              <Select
                value={collectorId}
                onChange={(e) => setCollectorId(e.target.value)}
                className="mt-1.5"
              >
                <option value="">Select collector…</option>
                {collectors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.employeeNumber ? ` (${c.employeeNumber})` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <Input
              value={assignReason}
              onChange={(e) => setAssignReason(e.target.value)}
              placeholder="Reason (required — manager only)"
            />
            <Button
              disabled={busy || !collectorId || !assignReason}
              onClick={() =>
                act("assign", {
                  id: assignFor.id,
                  collectorId,
                  reason: assignReason,
                }).then(() => setAssignFor(null))
              }
              className="w-full"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <HandCoins className="h-4 w-4" />
              )}{" "}
              Assign
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
