"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ListOrdered,
  Loader2,
  GripVertical,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";

interface BoardRow {
  id: string;
  woNumber: string;
  status: string;
  product: string;
  quantity: number;
  customer: string | null;
  priority: number;
  plannedEndDate: string;
  dueRisk: string;
  daysLeft: number;
  readiness: string;
  readyAll: boolean;
  rows: {
    sku: string;
    name: string;
    required: number;
    issued: number;
    stock: number;
    shortBy: number;
    ready: boolean;
  }[];
}

const RISK_META: Record<string, { label: string; cls: string; dot: string }> = {
  CRITICAL: {
    label: "CRITICAL",
    cls: "bg-rose-500/15 text-rose-300 border-rose-500/40",
    dot: "bg-rose-400",
  },
  OVERDUE: {
    label: "OVERDUE",
    cls: "bg-rose-500/15 text-rose-300 border-rose-500/40",
    dot: "bg-rose-400",
  },
  HIGH: {
    label: "HIGH RISK",
    cls: "bg-orange-500/15 text-orange-300 border-orange-500/40",
    dot: "bg-orange-400",
  },
  MEDIUM: {
    label: "DUE SOON",
    cls: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    dot: "bg-amber-400",
  },
  LOW: {
    label: "ON TRACK",
    cls: "bg-slate-500/15 text-slate-300 border-slate-600",
    dot: "bg-slate-400",
  },
};

export default function PpcClient() {
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const dragId = useRef<string | null>(null);
  const overId = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ppc", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setBoard(data.board || []);
        setStats(data.stats || {});
      }
    } catch {
      setMsg("Failed to load board");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onDrop = async (targetId: string) => {
    const from = dragId.current;
    dragId.current = null;
    overId.current = null;
    if (!from || from === targetId) return;
    const next = [...board];
    const i = next.findIndex((r) => r.id === from);
    const j = next.findIndex((r) => r.id === targetId);
    if (i < 0 || j < 0) return;
    const [moved] = next.splice(i, 1);
    next.splice(j, 0, moved);
    setBoard(next);
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/ppc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: next.map((r) => r.id) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Re-sequence failed");
        await load();
        return;
      }
      setMsg("Board re-sequenced — WO_RESEQUENCED audited");
    } catch {
      setMsg("Re-sequence failed");
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
          <div className="text-xs text-slate-400">Open WOs</div>
          <div className="text-2xl font-black text-white mt-1">
            {stats.total ?? 0}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
          <div className="text-xs text-slate-400">Material ready</div>
          <div className="text-2xl font-black text-emerald-300 mt-1">
            {stats.ready ?? 0}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
          <div className="text-xs text-slate-400">Material short</div>
          <div className="text-2xl font-black text-amber-300 mt-1">
            {stats.short ?? 0}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
          <div className="text-xs text-slate-400">
            Due risk (critical/overdue)
          </div>
          <div className="text-2xl font-black text-rose-300 mt-1">
            {stats.critical ?? 0}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-slate-700">
          <ListOrdered className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-bold text-white">
            Priority Queue — drag rows to re-sequence
          </span>
          {busy && (
            <Loader2 className="h-4 w-4 animate-spin text-indigo-400 ml-2" />
          )}
        </div>
        {loading ? (
          <div className="p-10 text-center text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Loading…
          </div>
        ) : board.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            No open work orders — release some from planning.
          </div>
        ) : (
          <div className="divide-y divide-slate-700/40">
            {board.map((r) => {
              const rm = RISK_META[r.dueRisk] || RISK_META.LOW;
              return (
                <div
                  key={r.id}
                  draggable
                  onDragStart={() => {
                    dragId.current = r.id;
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    overId.current = r.id;
                  }}
                  onDrop={() => onDrop(r.id)}
                  className={`flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-700/20 transition-colors cursor-grab active:cursor-grabbing ${overId.current === r.id ? "bg-indigo-500/10" : ""}`}
                >
                  <GripVertical className="h-4 w-4 text-slate-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white font-mono text-sm">
                        {r.woNumber}
                      </span>
                      <span className="text-xs text-slate-400 truncate">
                        {r.product}
                      </span>
                      {r.customer && (
                        <span className="text-[10px] text-slate-500">
                          · {r.customer}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      qty {r.quantity} · due{" "}
                      {new Date(r.plannedEndDate).toLocaleDateString()}
                      {r.daysLeft < 0 ? "" : ` · ${r.daysLeft}d`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${rm.cls}`}
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${rm.dot} mr-1 align-middle`}
                      />
                      {rm.label}
                    </span>
                    {r.readiness === "READY" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
                        <CheckCircle2 className="h-3 w-3" /> MATL READY
                      </span>
                    )}
                    {r.readiness === "SHORT" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40">
                        <AlertTriangle className="h-3 w-3" /> SHORT{" "}
                        {r.rows.filter((x) => !x.ready).length}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-slate-500">
                      #{r.priority}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-500 flex items-center gap-1">
        <Clock className="h-3 w-3" /> Drag a row onto another to re-sequence.
        Priority numbers (lower = higher) are written to the WOs and audited as
        WO_RESEQUENCED.
      </p>
      {msg && (
        <div
          className={`text-sm px-3 py-2 rounded-xl border ${msg.includes("audited") ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" : "text-amber-300 bg-amber-500/10 border-amber-500/30"}`}
        >
          {msg}
        </div>
      )}
    </div>
  );
}
