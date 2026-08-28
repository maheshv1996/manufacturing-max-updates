"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Wrench,
  Loader2,
  RefreshCcw,
  Trash2,
  Send,
  RotateCcw,
} from "lucide-react";
import { Button, Select, Input } from "@/app/components/ui";

interface Tool {
  id: string;
  code: string;
  name: string | null;
  kind: string;
  ratedLifeUnits: number;
  usedUnits: number;
  regrinds: number;
  maxRegrinds: number;
  lifeStatus: string;
  effective: string;
  machine?: { name: string } | null;
  life: { pct: number; regrindsLeft: number; exhausted: boolean };
}
interface Log {
  id: string;
  toolId: string;
  action: string;
  woNumber: string | null;
  costRupees: number;
  actor: string;
  note: string | null;
  at: string;
  tool: { code: string };
}
interface OpenWo {
  id: string;
  woNumber: string;
  product: { name: string };
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  AVAILABLE: {
    label: "AVAILABLE",
    cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  },
  IN_USE: {
    label: "IN USE",
    cls: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  },
  NEEDS_REGRIND: {
    label: "NEEDS REGRIND",
    cls: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  },
  SCRAPPED: {
    label: "SCRAPPED",
    cls: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  },
};

export default function ToolRoomClient() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [openWos, setOpenWos] = useState<OpenWo[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [issueFor, setIssueFor] = useState<Tool | null>(null);
  const [issueWo, setIssueWo] = useState("");
  const [issueCost, setIssueCost] = useState("");
  const [noteFor, setNoteFor] = useState<Tool | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tool-life", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setTools(data.tools || []);
        setLogs(data.logs || []);
        setOpenWos(data.openWos || []);
        setStats(data.stats || {});
      }
    } catch {
      setMsg("Failed to load tool room");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (action: string, toolId: string, extra: any = {}) => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/tool-life", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, toolId, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Action failed");
        return;
      }
      await load();
      if (action === "issue") {
        setIssueFor(null);
        setIssueWo("");
        setIssueCost("");
      }
      if (action === "regrind" || action === "scrap") {
        setNoteFor(null);
        setNote("");
      }
    } catch {
      setMsg("Action failed");
    } finally {
      setBusy(false);
    }
  };

  const issue = async () => {
    if (!issueFor || !issueWo) {
      setMsg("Select the WO to issue the tool to");
      return;
    }
    const wo = openWos.find((w) => w.id === issueWo);
    await act("issue", issueFor.id, {
      woNumber: wo?.woNumber,
      woId: wo?.id,
      costRupees: issueCost || 0,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          ["total", "Tools", "text-white"],
          ["available", "Available", "text-emerald-300"],
          ["inUse", "In use", "text-sky-300"],
          ["needsRegrind", "Need regrind", "text-amber-300"],
          ["scrapped", "Scrapped", "text-rose-300"],
        ].map(([k, label, cls]) => (
          <div
            key={k}
            className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4"
          >
            <div className="text-xs text-slate-400">{label}</div>
            <div className={`text-2xl font-black mt-1 ${cls}`}>
              {stats[k] ?? 0}
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="p-10 text-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Loading tool room…
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {tools.map((t) => {
            const sm = STATUS_META[t.effective] || STATUS_META.AVAILABLE;
            return (
              <div
                key={t.id}
                className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">
                        {t.code}
                      </span>
                      <span className="text-xs text-slate-400">
                        {t.name || t.kind}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {t.machine?.name ? `at ${t.machine.name}` : t.kind}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${sm.cls}`}
                  >
                    {sm.label}
                  </span>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>
                      LIFE {t.usedUnits}/{t.ratedLifeUnits}
                    </span>
                    <span>
                      regrinds {t.regrinds}/{t.maxRegrinds}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-700/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${t.effective === "SCRAPPED" ? "bg-rose-500" : t.life.exhausted ? "bg-amber-400" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(100, t.life.pct)}%` }}
                    />
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {t.effective !== "SCRAPPED" && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setIssueFor(t);
                        setIssueWo("");
                        setIssueCost("");
                      }}
                    >
                      <Send className="h-3.5 w-3.5 mr-1" /> Issue
                    </Button>
                  )}
                  {t.effective === "NEEDS_REGRIND" &&
                    t.regrinds < t.maxRegrinds && (
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => act("regrind", t.id)}
                      >
                        <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Regrind
                      </Button>
                    )}
                  {t.effective !== "SCRAPPED" && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setNoteFor(t);
                        setNote("");
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Scrap
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      act("record-use", t.id, {
                        units: Math.min(50, t.ratedLifeUnits / 10),
                      })
                    }
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> +10% use
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-slate-700">
          <Wrench className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-bold text-white">Life Log</span>
        </div>
        <div className="divide-y divide-slate-700/40 max-h-72 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No activity yet.
            </div>
          ) : (
            logs.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-700/20 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-mono font-bold text-white">
                    {l.tool.code}
                  </span>
                  <span className="ml-2 text-slate-300">
                    {l.action.replace(/_/g, " ")}
                  </span>
                  {l.woNumber && (
                    <span className="ml-2 text-xs text-slate-500 font-mono">
                      → {l.woNumber}
                    </span>
                  )}
                  {l.costRupees > 0 && (
                    <span className="ml-2 text-xs text-amber-300">
                      ₹{l.costRupees}
                    </span>
                  )}
                  {l.note && (
                    <span className="ml-2 text-xs text-slate-500">
                      {l.note}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500 shrink-0">
                  {l.actor} · {new Date(l.at).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {issueFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setIssueFor(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-slate-800 border border-slate-700 p-5 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-white">
              Issue {issueFor.code} to Work Order
            </h3>
            <div>
              <label className="text-xs text-slate-400">Work order *</label>
              <Select
                value={issueWo}
                onChange={(e) => setIssueWo(e.target.value)}
              >
                <option value="">Select open WO…</option>
                {openWos.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.woNumber} — {w.product.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-400">
                Tooling cost ₹ (posts to job costing)
              </label>
              <Input
                type="number"
                min="0"
                value={issueCost}
                onChange={(e) => setIssueCost(e.target.value)}
                placeholder="e.g. 850"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setIssueFor(null)}>
                Cancel
              </Button>
              <Button onClick={issue} disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Issue Tool"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {noteFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setNoteFor(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-slate-800 border border-slate-700 p-5 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-white">
              {noteFor.effective === "NEEDS_REGRIND"
                ? `Regrind ${noteFor.code}`
                : `Scrap ${noteFor.code}`}
            </h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              placeholder="Reason / note (audit trail)…"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setNoteFor(null)}>
                Cancel
              </Button>
              <Button
                variant={
                  noteFor.effective === "NEEDS_REGRIND" ? "success" : "danger"
                }
                onClick={() =>
                  act(
                    noteFor.effective === "NEEDS_REGRIND" ? "regrind" : "scrap",
                    noteFor.id,
                    { note },
                  )
                }
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : noteFor.effective === "NEEDS_REGRIND" ? (
                  "Regrind"
                ) : (
                  "Scrap"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {msg && (
        <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
          {msg}
        </div>
      )}
    </div>
  );
}
