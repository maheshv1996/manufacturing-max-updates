"use client";

import PageHeader from "@/app/components/shared/PageHeader";

import {useCallback, useEffect, useState } from "react";
import {
  BellRing,
  PhoneCall,
  XCircle,
  Loader2,
  TrendingDown,
  Trophy,
  Filter,
  FileText
} from "lucide-react";
import { Button, Input, Select } from "@/app/components/ui";
import { WIN_LOSS_REASONS } from "@/lib/winLoss";

interface IdleQuote {
  id: string;
  quoteNumber: string;
  customerName: string;
  status: string;
  quotedPrice: number;
  createdAt: string;
  daysIdle: number;
}

const REASONS = WIN_LOSS_REASONS;

export default function FollowUpsClient() {
  const [idle, setIdle] = useState<IdleQuote[]>([]);
  const [lostByReason, setLostByReason] = useState<
    { reason: string; count: number; value: number }[]
  >([]);
  const [lostTotal, setLostTotal] = useState(0);
  const [recent, setRecent] = useState<any[]>([]);
  const [funnel, setFunnel] = useState<any>(null);
  const [, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [noteFor, setNoteFor] = useState<IdleQuote | null>(null);
  const [note, setNote] = useState("");
  const [lostFor, setLostFor] = useState<IdleQuote | null>(null);
  const [lostReason, setLostReason] = useState("PRICE");
  const [lostNote, setLostNote] = useState("");
  const [wonFor, setWonFor] = useState<IdleQuote | null>(null);
  const [wonReason, setWonReason] = useState("PRICE");
  const [wonNote, setWonNote] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/follow-ups");
      const data = await res.json();
      setIdle(data.idle || []);
      setLostByReason(data.lostByReason || []);
      setLostTotal(data.lostTotal || 0);
      setRecent(data.recentFollowUps || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
    try {
      const res = await fetch("/api/enquiry-funnel");
      const data = await res.json();
      setFunnel(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const act = async (action: string, payload: any) => {
    setMsg("");
    setBusy(true);
    try {
      const res = await fetch("/api/follow-ups", {
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

  const maxCount = Math.max(1, ...lostByReason.map((r) => r.count));

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-emerald-300 font-semibold">{msg}</p>}

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Idle > 7 days",
            value: idle.length,
            icon: <BellRing className="h-5 w-5 text-amber-500" />,
            tone: idle.length > 0 ? "text-amber-400" : "text-emerald-400",
          },
          {
            label: "Lost enquiries",
            value: lostTotal,
            icon: <XCircle className="h-5 w-5 text-rose-500" />,
          },
          {
            label: "Lost value ₹",
            value: lostByReason
              .reduce((s, r) => s + r.value, 0)
              .toLocaleString(),
            icon: <TrendingDown className="h-5 w-5 text-rose-400" />,
          },
          {
            label: "Follow-ups logged",
            value: recent.length,
            icon: <PhoneCall className="h-5 w-5 text-sky-500" />,
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

      {/* M14 — compact enquiry funnel */}
      {funnel && (
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Filter className="h-4 w-4 text-indigo-400" /> Enquiry funnel
            </h3>
            <span className="rounded-full border border-indigo-500/40 bg-indigo-500/15 text-indigo-300 px-3 py-1 text-xs font-bold">
              Win rate: {funnel.totals?.winRate}%
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {funnel.stages?.map((s: any, i: number) => {
              const maxCount = Math.max(
                1,
                ...(funnel.stages || []).map((x: any) => x.count),
              );
              return (
                <div key={s.stage} className="relative">
      <PageHeader
        title="Follow Ups"
        description="Quotes, orders, receivables and commercial desk operations."
        icon={<FileText className="w-6 h-6" />}
        iconTone="amber"
      />

                  <div className="rounded-xl bg-slate-900/70 border border-slate-700 p-3 h-full">
                    <p
                      className={`text-lg font-black ${s.stage === "LOST" ? "text-rose-400" : s.stage === "WON" || s.stage === "CONVERTED" ? "text-emerald-400" : "text-slate-300"}`}
                    >
                      {s.count}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold">
                      {s.stage}
                    </p>
                    <div className="mt-2 h-1 rounded-full bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${s.stage === "LOST" ? "bg-rose-500" : s.stage === "WON" || s.stage === "CONVERTED" ? "bg-emerald-500" : "bg-blue-500"}`}
                        style={{ width: `${(s.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                  {i < funnel.stages.length - 1 && (
                    <span className="absolute -right-2 top-1/2 -translate-y-1/2 text-slate-600 z-10 text-xs">
                      →
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500 mt-3">
            ₹{funnel.totals?.wonValue?.toLocaleString()} won of ₹
            {funnel.totals?.decidedValue?.toLocaleString()} decided ·{" "}
            {funnel.idle?.length || 0} idle ≥ 7d · {funnel.stale?.length || 0}{" "}
            stale &gt; 30d ·{" "}
            <a
              href="/commercial/enquiry-funnel"
              className="text-indigo-400 hover:underline font-semibold"
            >
              full funnel →
            </a>
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Idle enquiries */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-800/60 border border-slate-700 p-5">
          <h3 className="font-bold text-white mb-4">
            Enquiries idle ≥ 7 days — follow up now
          </h3>
          <div className="space-y-3">
            {idle.length === 0 && (
              <p className="text-sm text-slate-500">
                Nothing idle — every enquiry has been touched in the last week.
                🎉
              </p>
            )}
            {idle.map((q) => (
              <div
                key={q.id}
                className="rounded-xl bg-slate-900/60 border border-slate-700 p-4"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-sm font-bold text-white">
                      {q.customerName}
                    </p>
                    <p className="text-xs text-slate-400">
                      {q.quoteNumber} · {q.status} · ₹
                      {q.quotedPrice.toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${q.daysIdle >= 14 ? "bg-rose-500/20 text-rose-300 border-rose-500/40" : "bg-amber-500/15 text-amber-300 border-amber-500/40"}`}
                  >
                    {q.daysIdle}d idle
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      setNoteFor(q);
                      setNote("");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/15 text-sky-300 border border-sky-500/40 px-3 py-1.5 text-xs font-semibold hover:bg-sky-500/25 transition-colors"
                  >
                    <PhoneCall className="h-3.5 w-3.5" /> Log follow-up
                  </button>
                  <button
                    onClick={() => {
                      setWonFor(q);
                      setWonReason("PRICE");
                      setWonNote("");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/25 transition-colors"
                  >
                    <Trophy className="h-3.5 w-3.5" /> Mark won
                  </button>
                  <button
                    onClick={() => {
                      setLostFor(q);
                      setLostReason("PRICE");
                      setLostNote("");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/40 px-3 py-1.5 text-xs font-semibold hover:bg-rose-500/25 transition-colors"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Mark lost
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Analytics + activity */}
        <div className="space-y-6">
          <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-5">
            <h3 className="font-bold text-white mb-4">Lost-reason analytics</h3>
            <div className="space-y-3">
              {lostByReason.length === 0 && (
                <p className="text-sm text-slate-500">
                  No lost enquiries recorded yet.
                </p>
              )}
              {lostByReason.map((r) => (
                <div key={r.reason}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-300">
                      {r.reason}
                    </span>
                    <span className="text-slate-400">
                      {r.count} · ₹{r.value.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-rose-500"
                      style={{ width: `${(r.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              {lostTotal > 0 && (
                <p className="text-[11px] text-slate-500 mt-3">
                  Top reason:{" "}
                  {lostByReason.sort((a, b) => b.count - a.count)[0]?.reason} —
                  review pricing or delivery commitments.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-5">
            <h3 className="font-bold text-white mb-4">
              Recent follow-up activity
            </h3>
            <div className="space-y-2">
              {recent.length === 0 && (
                <p className="text-sm text-slate-500">
                  No follow-ups logged yet.
                </p>
              )}
              {recent.slice(0, 8).map((f, i) => (
                <div
                  key={i}
                  className="text-xs border-b border-slate-700/50 pb-2"
                >
                  <p className="text-slate-300">
                    <span className="font-bold text-white">{f.by}</span> ·{" "}
                    {f.quoteNumber} · {f.customerName}
                  </p>
                  <p className="text-slate-500 mt-0.5">{f.note}</p>
                  <p className="text-[10px] text-slate-600">
                    {new Date(f.at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Log follow-up modal */}
      {noteFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4">
            <h3 className="font-bold text-white">
              Log follow-up — {noteFor.customerName}
            </h3>
            <p className="text-xs text-slate-400">
              {noteFor.quoteNumber} · idle {noteFor.daysIdle}d
            </p>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What happened on this call / email?"
            />
            <Button
              disabled={busy || !note}
              onClick={() =>
                act("log", { id: noteFor.id, note }).then(() =>
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
              Log & reset cadence
            </Button>
          </div>
        </div>
      )}

      {/* Mark won modal */}
      {wonFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4">
            <h3 className="font-bold text-white">
              Mark won — {wonFor.customerName}
            </h3>
            <div>
              <label className="text-xs text-slate-400 font-semibold">
                Won because of
              </label>
              <Select
                value={wonReason}
                onChange={(e) => setWonReason(e.target.value)}
                className="mt-1.5"
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>
            <Input
              value={wonNote}
              onChange={(e) => setWonNote(e.target.value)}
              placeholder="Optional note"
            />
            <Button
              disabled={busy}
              onClick={() =>
                act("mark-won", {
                  id: wonFor.id,
                  wonReason,
                  note: wonNote,
                }).then(() => setWonFor(null))
              }
              className="w-full"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trophy className="h-4 w-4" />
              )}{" "}
              Mark won
            </Button>
          </div>
        </div>
      )}

      {/* Mark lost modal */}
      {lostFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4">
            <h3 className="font-bold text-white">
              Mark lost — {lostFor.customerName}
            </h3>
            <div>
              <label className="text-xs text-slate-400 font-semibold">
                Lost reason
              </label>
              <Select
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                className="mt-1.5"
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>
            <Input
              value={lostNote}
              onChange={(e) => setLostNote(e.target.value)}
              placeholder="Optional note"
            />
            <Button
              disabled={busy}
              variant="danger"
              onClick={() =>
                act("mark-lost", {
                  id: lostFor.id,
                  lostReason,
                  note: lostNote,
                }).then(() => setLostFor(null))
              }
              className="w-full"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}{" "}
              Mark lost
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
