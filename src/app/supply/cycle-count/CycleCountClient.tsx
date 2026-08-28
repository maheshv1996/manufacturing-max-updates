"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Boxes,
  Play,
  CheckCircle2,
  AlertTriangle,
  BadgeCheck,
} from "lucide-react";
import { Button, Input, Select } from "@/app/components/ui";

interface Line {
  id: string;
  rawMaterialId: string;
  systemQty: number;
  countedQty: number | null;
  variance: number | null;
  variancePct: number | null;
  status: string;
  rawMaterial: { sku: string; name: string; unit: string };
}
interface Session {
  id: string;
  sessionNumber: string;
  name: string;
  abcClass: string;
  status: string;
  approvedBy: string | null;
  approvalNote: string | null;
  lines: Line[];
}
interface Material {
  id: string;
  sku: string;
  name: string;
  currentStock: number;
  unit: string;
}

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  COUNTING: "bg-indigo-500/15 text-indigo-300 border-indigo-500/40",
  PENDING_APPROVAL: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  ADJUSTED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  CLOSED: "bg-slate-500/15 text-slate-300 border-slate-500/40",
};

export default function CycleCountClient() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [thresholds, setThresholds] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [abcClass, setAbcClass] = useState("A");
  const [values, setValues] = useState<Record<string, Record<string, string>>>(
    {},
  );
  const [approvalNote, setApprovalNote] = useState<Record<string, string>>({});

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/cycle-count");
      const data = await res.json();
      setSessions(data.sessions || []);
      setMaterials(data.materials || []);
      setThresholds(data.stats?.threshold || {});
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
    setBusy(action + ":" + (payload.sessionId || payload.id || ""));
    try {
      const res = await fetch("/api/cycle-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data: payload }),
      });
      const data = await res.json();
      setMsg(res.ok ? "Done" : data.error || "Action failed");
      if (res.ok) await fetchAll();
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(null);
    }
  };

  const stats = {
    counting: sessions.filter(
      (s) => s.status === "COUNTING" || s.status === "OPEN",
    ).length,
    pending: sessions.filter((s) => s.status === "PENDING_APPROVAL").length,
    adjusted: sessions.filter((s) => s.status === "ADJUSTED").length,
  };

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-emerald-300 font-semibold">{msg}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Active counts",
            value: stats.counting,
            icon: <Boxes className="h-5 w-5 text-indigo-500" />,
          },
          {
            label: "Pending finance approval",
            value: stats.pending,
            icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
            tone: stats.pending ? "text-amber-500" : undefined,
          },
          {
            label: "Stock adjusted",
            value: stats.adjusted,
            icon: <BadgeCheck className="h-5 w-5 text-emerald-500" />,
          },
          {
            label: "Materials on file",
            value: materials.length,
            icon: <Boxes className="h-5 w-5 text-sky-500" />,
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

      <section className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-bold text-white">Start a count:</span>
        <Select
          value={abcClass}
          onChange={(e) => setAbcClass(e.target.value)}
          className="w-44"
        >
          <option value="A">A-class (0.5% tol, 15d)</option>
          <option value="B">B-class (1% tol, 45d)</option>
          <option value="C">C-class (2% tol, 90d)</option>
        </Select>
        <Button
          onClick={() => act("start", { abcClass })}
          disabled={busy !== null}
        >
          <Play className="w-4 h-4" /> Start {abcClass}-class count
        </Button>
        <span className="text-xs text-slate-500">
          Thresholds: A &gt;0.5% · B &gt;1% · C &gt;2% variance → Finance
          approval
        </span>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-white">Count Sessions</h3>
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-slate-400 rounded-2xl bg-slate-800/40 border border-slate-800 p-4">
            No count sessions yet — start an ABC-class count above.
          </p>
        ) : (
          sessions.map((s) => (
            <details
              key={s.id}
              className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4"
              open={s.status === "COUNTING" || s.status === "PENDING_APPROVAL"}
            >
              <summary className="cursor-pointer flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white">
                    {s.sessionNumber}
                  </span>
                  <span className="text-sm text-slate-300">{s.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full border text-xs font-bold ${s.abcClass === "A" ? "bg-rose-500/15 text-rose-300 border-rose-500/40" : s.abcClass === "B" ? "bg-amber-500/15 text-amber-300 border-amber-500/40" : "bg-sky-500/15 text-sky-300 border-sky-500/40"}`}
                  >
                    {s.abcClass}-class
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full border text-xs font-bold ${STATUS_STYLE[s.status]}`}
                >
                  {s.status}
                </span>
              </summary>

              <div className="mt-3 space-y-2">
                {s.status === "COUNTING" && (
                  <div className="space-y-2">
                    {s.lines.map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/60 border border-slate-800 px-3 py-2 flex-wrap"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-white font-medium">
                            {l.rawMaterial.name}
                          </p>
                          <p className="text-xs text-slate-400 font-mono">
                            {l.rawMaterial.sku} · system {l.systemQty}{" "}
                            {l.rawMaterial.unit}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="Counted qty"
                            value={values[s.id]?.[l.id] || ""}
                            onChange={(e) =>
                              setValues((m) => ({
                                ...m,
                                [s.id]: {
                                  ...(m[s.id] || {}),
                                  [l.id]: e.target.value,
                                },
                              }))
                            }
                            className="w-36"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              act("record", {
                                sessionId: s.id,
                                values: s.lines.map((x) => ({
                                  lineId: x.id,
                                  countedQty:
                                    values[s.id]?.[x.id] ?? x.countedQty,
                                })),
                              })
                            }
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      onClick={() => act("submit", { sessionId: s.id })}
                      disabled={busy !== null}
                    >
                      <CheckCircle2 className="w-4 h-4" /> Submit counts for
                      evaluation
                    </Button>
                  </div>
                )}

                {s.status === "PENDING_APPROVAL" && (
                  <div className="space-y-3">
                    <p className="text-xs text-amber-300 font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" /> Variance above
                      threshold — Finance approval required
                    </p>
                    {s.lines
                      .filter(
                        (l) =>
                          l.countedQty !== null && l.countedQty !== l.systemQty,
                      )
                      .map((l) => (
                        <div
                          key={l.id}
                          className="flex items-center justify-between rounded-xl bg-slate-900/60 border border-amber-500/30 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm text-white font-medium">
                              {l.rawMaterial.name}
                            </p>
                            <p className="text-xs text-slate-400 font-mono">
                              {l.rawMaterial.sku} · {l.systemQty} →{" "}
                              {l.countedQty} {l.rawMaterial.unit}
                            </p>
                          </div>
                          <span
                            className={`text-sm font-black ${(l.variancePct || 0) > (thresholds[s.abcClass] || 1) ? "text-rose-300" : "text-emerald-300"}`}
                          >
                            {(l.variance || 0) >= 0 ? "+" : ""}
                            {l.variance} (
                            {Math.round((l.variancePct || 0) * 100) / 100}%)
                          </span>
                        </div>
                      ))}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        placeholder="Approval note (audit trail)…"
                        value={approvalNote[s.id] || ""}
                        onChange={(e) =>
                          setApprovalNote((m) => ({
                            ...m,
                            [s.id]: e.target.value,
                          }))
                        }
                        className="flex-1 min-w-52"
                      />
                      <Button
                        onClick={() =>
                          act("approve", {
                            id: s.id,
                            reason: approvalNote[s.id] || "Approved.",
                          })
                        }
                        disabled={busy !== null}
                      >
                        <BadgeCheck className="w-4 h-4" /> Approve & adjust
                        stock
                      </Button>
                      <Button
                        onClick={() =>
                          act("reject", {
                            id: s.id,
                            reason: approvalNote[s.id] || "Rejected.",
                          })
                        }
                        disabled={busy !== null}
                        variant="outline"
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                )}

                {s.status !== "COUNTING" && s.status !== "PENDING_APPROVAL" && (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {s.lines
                      .filter(
                        (l) =>
                          l.countedQty !== null && l.countedQty !== l.systemQty,
                      )
                      .map((l) => (
                        <div
                          key={l.id}
                          className="rounded-xl bg-slate-900/60 border border-slate-800 px-3 py-2 flex items-center justify-between"
                        >
                          <p className="text-sm text-slate-300">
                            {l.rawMaterial.name}
                          </p>
                          <span className="text-xs font-mono text-slate-400">
                            {l.systemQty} → {l.countedQty} (
                            {(l.variance || 0) >= 0 ? "+" : ""}
                            {l.variance ?? 0})
                          </span>
                        </div>
                      ))}
                    {s.approvedBy && (
                      <p className="text-xs text-slate-500">
                        Decided by {s.approvedBy}
                        {s.approvalNote ? ` — ${s.approvalNote}` : ""}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </details>
          ))
        )}
      </section>
    </div>
  );
}
