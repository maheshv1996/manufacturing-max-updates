"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarRange,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Factory,
  Timer,
  Plus,
  Loader2,
  X,
} from "lucide-react";
import { Button, Input, Select } from "@/app/components/ui";

interface Week {
  weekKey: string;
  weekStart: string;
  label: string;
  orderCount: number;
  orderQty: number;
  requiredHours: number;
  baseAvailableHours: number;
  windowHours: number;
  availableHours: number;
  loadPct: number;
  gapHours: number;
  decisionCount: number;
}
interface Decision {
  id: string;
  decisionNumber: string;
  weekStart: string;
  decisionType: string;
  requiredHours: number;
  notes: string | null;
  status: string;
  outcome: { type: string; refId: string; label: string }[];
  createdByName: string;
}
interface Window {
  id: string;
  title: string;
  windowType: string;
  from: string;
  to: string;
  hours: number | null;
  reason: string | null;
  machine: { name: string; code: string };
}

const TYPE_STYLE: Record<string, string> = {
  OVERTIME: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  OUTSOURCE: "bg-violet-500/15 text-violet-300 border-violet-500/40",
  EXTRA_SHIFT: "bg-sky-500/15 text-sky-300 border-sky-500/40",
};
const TYPE_LABEL: Record<string, string> = {
  OVERTIME: "Overtime",
  OUTSOURCE: "Outsource",
  EXTRA_SHIFT: "Extra shift",
};

export default function SopClient() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [windows, setWindows] = useState<Window[]>([]);
  const [machines, setMachines] = useState<
    { id: string; name: string; code: string }[]
  >([]);
  const [dailyAvailableHours, setDailyAvailableHours] = useState(16);
  const [, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // decision modal
  const [decideFor, setDecideFor] = useState<Week | null>(null);
  const [decType, setDecType] = useState("OVERTIME");
  const [decHours, setDecHours] = useState("4");
  const [decMachine, setDecMachine] = useState("");
  const [decNotes, setDecNotes] = useState("");

  // window modal
  const [windowOpen, setWindowOpen] = useState(false);
  const [winMachine, setWinMachine] = useState("");
  const [winTitle, setWinTitle] = useState("");
  const [winFrom, setWinFrom] = useState("");
  const [winTo, setWinTo] = useState("");
  const [winHours, setWinHours] = useState("");
  const [winReason, setWinReason] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/sop?weeks=8");
      const data = await res.json();
      setWeeks(data.weeks || []);
      setDecisions(data.decisions || []);
      setWindows(data.windows || []);
      setMachines(data.machines || []);
      setDailyAvailableHours(data.dailyAvailableHours ?? 16);
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
      const res = await fetch("/api/sop", {
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

  const submitDecision = () => {
    if (!decideFor) return;
    const payload: any = {
      weekStart: decideFor.weekStart,
      decisionType: decType,
      requiredHours: decHours,
      notes: decNotes || undefined,
    };
    if (decType === "OUTSOURCE") payload.machineId = decMachine;
    act("decision", payload).then(() => setDecideFor(null));
  };

  const thisWeek = weeks[0];
  const thisWeekGap = thisWeek?.gapHours ?? 0;

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-emerald-300 font-semibold">{msg}</p>}

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            label: "This week load",
            value: thisWeek ? `${thisWeek.loadPct}%` : "—",
            icon: <CalendarRange className="h-5 w-5 text-sky-500" />,
          },
          {
            label: "This week gap",
            value: thisWeekGap ? `${thisWeekGap}h` : "0h",
            icon: <AlertTriangle className="h-5 w-5 text-rose-500" />,
            tone: thisWeekGap > 0 ? "text-rose-400" : "text-emerald-400",
          },
          {
            label: "Decisions recorded",
            value: decisions.length,
            icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
          },
          {
            label: "Capacity windows",
            value: windows.length,
            icon: <Clock className="h-5 w-5 text-amber-500" />,
          },
          {
            label: "Machines (capacity)",
            value: machines.length,
            icon: <Factory className="h-5 w-5 text-violet-500" />,
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

      {/* Weekly plan */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="font-bold text-white">
            Order book vs capacity — next 8 weeks
          </h3>
          <button
            onClick={() => {
              setWinFrom("");
              setWinTo("");
              setWinTitle("");
              setWinMachine("");
              setWindowOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500/15 text-sky-300 border border-sky-500/40 px-3 py-1.5 text-xs font-semibold hover:bg-sky-500/25 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Book maintenance window
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                <th className="px-5 py-3">Week</th>
                <th className="px-3 py-3 text-right">Orders</th>
                <th className="px-3 py-3 text-right">Qty</th>
                <th className="px-3 py-3 text-right">Required h</th>
                <th className="px-3 py-3 text-right">Available h</th>
                <th className="px-3 py-3">Load</th>
                <th className="px-3 py-3 text-right">Gap</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => {
                const over = w.loadPct > 100;
                return (
                  <tr
                    key={w.weekKey}
                    className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="px-5 py-3 font-semibold text-white">
                      {w.label}
                      {w.decisionCount > 0 && (
                        <span className="ml-2 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/40 px-2 py-0.5 text-[10px] font-bold">
                          {w.decisionCount} decision
                          {w.decisionCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300">
                      {w.orderCount}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300">
                      {w.orderQty.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300">
                      {w.requiredHours}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300">
                      {w.availableHours}
                      {w.windowHours > 0 && (
                        <span className="block text-[10px] text-amber-400">
                          −{w.windowHours}h windows
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${over ? "bg-rose-500" : w.loadPct > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(100, w.loadPct)}%` }}
                          />
                        </div>
                        <span
                          className={`text-xs font-bold ${over ? "text-rose-400" : "text-slate-300"}`}
                        >
                          {w.loadPct}%
                        </span>
                      </div>
                    </td>
                    <td
                      className={`px-3 py-3 text-right font-bold ${w.gapHours > 0 ? "text-rose-400" : "text-emerald-400"}`}
                    >
                      {w.gapHours > 0 ? `+${w.gapHours}h` : "OK"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => {
                          setDecideFor(w);
                          setDecType("OVERTIME");
                          setDecHours(String(Math.max(1, w.gapHours)));
                          setDecNotes("");
                          setDecMachine("");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/25 transition-colors"
                      >
                        <Timer className="h-3.5 w-3.5" /> Decision
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-[11px] text-slate-500">
          Capacity = {machines.length} active machine(s) × {dailyAvailableHours}{" "}
          h/day × 5 days − booked windows. Required h = qty × cycle time +
          setup.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Decisions */}
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-5">
          <h3 className="font-bold text-white mb-4">
            Recorded decisions → auto-actions
          </h3>
          <div className="space-y-3">
            {decisions.length === 0 && (
              <p className="text-sm text-slate-500">
                No decisions yet — record one from the weekly plan.
              </p>
            )}
            {decisions.map((d) => (
              <div
                key={d.id}
                className="rounded-xl bg-slate-900/60 border border-slate-700 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-bold rounded-full border px-2 py-0.5 ${TYPE_STYLE[d.decisionType] || TYPE_STYLE.OVERTIME}`}
                  >
                    {TYPE_LABEL[d.decisionType] || d.decisionType}
                  </span>
                  <span className="text-xs text-slate-400">
                    {d.decisionNumber} ·{" "}
                    {new Date(d.weekStart).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300 font-semibold">
                  {d.requiredHours}h · by {d.createdByName}
                </p>
                {d.notes && (
                  <p className="mt-1 text-xs text-slate-400">{d.notes}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {d.outcome.map((o, i) => (
                    <span
                      key={i}
                      className={`text-[10px] font-bold rounded-full border px-2 py-0.5 ${o.type === "OT_REQUEST" ? "bg-amber-500/15 text-amber-300 border-amber-500/40" : "bg-violet-500/15 text-violet-300 border-violet-500/40"}`}
                    >
                      {o.type === "OT_REQUEST" ? "OT" : "WIN"} · {o.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Windows */}
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-5">
          <h3 className="font-bold text-white mb-4">
            Reserved machine windows
          </h3>
          <div className="space-y-3">
            {windows.length === 0 && (
              <p className="text-sm text-slate-500">
                No windows — outsource decisions and maintenance bookings appear
                here.
              </p>
            )}
            {windows.map((w) => (
              <div
                key={w.id}
                className="rounded-xl bg-slate-900/60 border border-slate-700 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-bold rounded-full border px-2 py-0.5 ${w.windowType === "OUTSOURCE" ? "bg-violet-500/15 text-violet-300 border-violet-500/40" : "bg-amber-500/15 text-amber-300 border-amber-500/40"}`}
                  >
                    {w.windowType === "OUTSOURCE" ? "OUTSOURCE" : "MAINTENANCE"}
                  </span>
                  <span className="text-xs text-slate-400">
                    {w.machine.name}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-200 font-semibold">
                  {w.title}
                </p>
                <p className="text-xs text-slate-400">
                  {new Date(w.from).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  →{" "}
                  {new Date(w.to).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {w.hours ? ` · ${w.hours}h` : ""}
                </p>
                {w.reason && (
                  <p className="mt-1 text-xs text-slate-500">{w.reason}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Decision modal */}
      {decideFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">
                Capacity decision — week of {decideFor.label}
              </h3>
              <button
                onClick={() => setDecideFor(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">
                Decision type
              </label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {["OVERTIME", "OUTSOURCE", "EXTRA_SHIFT"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setDecType(t)}
                    className={`rounded-xl border px-2 py-2 text-xs font-bold transition-colors ${decType === t ? TYPE_STYLE[t] : "border-slate-700 text-slate-400 hover:border-slate-600"}`}
                  >
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">
                Hours (
                {decType === "EXTRA_SHIFT"
                  ? "split across operators"
                  : "required"}
                )
              </label>
              <Input
                type="number"
                value={decHours}
                onChange={(e) => setDecHours(e.target.value)}
                className="mt-1.5"
              />
            </div>
            {decType === "OUTSOURCE" && (
              <div>
                <label className="text-xs text-slate-400 font-semibold">
                  Machine to reserve (work returns for finishing ops)
                </label>
                <Select
                  value={decMachine}
                  onChange={(e) => setDecMachine(e.target.value)}
                  className="mt-1.5"
                >
                  <option value="">Select machine…</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.code})
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div>
              <label className="text-xs text-slate-400 font-semibold">
                Notes
              </label>
              <Input
                value={decNotes}
                onChange={(e) => setDecNotes(e.target.value)}
                placeholder="Optional context"
                className="mt-1.5"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                onClick={submitDecision}
                disabled={busy}
                className="flex-1"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}{" "}
                Record decision
              </Button>
              <Button variant="ghost" onClick={() => setDecideFor(null)}>
                Cancel
              </Button>
            </div>
            <p className="text-[11px] text-slate-500">
              Overtime / extra shift → auto HR overtime request (PENDING).
              Outsource → reserved machine window. Audited as SOP_DECISION.
            </p>
          </div>
        </div>
      )}

      {/* Maintenance window modal */}
      {windowOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">Book maintenance window</h3>
              <button
                onClick={() => setWindowOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">
                Machine
              </label>
              <Select
                value={winMachine}
                onChange={(e) => setWinMachine(e.target.value)}
                className="mt-1.5"
              >
                <option value="">Select machine…</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.code})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">
                Title
              </label>
              <Input
                value={winTitle}
                onChange={(e) => setWinTitle(e.target.value)}
                placeholder="e.g. PM window — spindle check"
                className="mt-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold">
                  From
                </label>
                <Input
                  type="datetime-local"
                  value={winFrom}
                  onChange={(e) => setWinFrom(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold">
                  To
                </label>
                <Input
                  type="datetime-local"
                  value={winTo}
                  onChange={(e) => setWinTo(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">
                Hours (for capacity math)
              </label>
              <Input
                type="number"
                value={winHours}
                onChange={(e) => setWinHours(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">
                Reason
              </label>
              <Input
                value={winReason}
                onChange={(e) => setWinReason(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <Button
              disabled={busy || !winMachine || !winTitle || !winFrom || !winTo}
              onClick={() =>
                act("window", {
                  machineId: winMachine,
                  title: winTitle,
                  from: winFrom,
                  to: winTo,
                  hours: winHours,
                  reason: winReason,
                }).then(() => setWindowOpen(false))
              }
              className="w-full"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}{" "}
              Book window
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
