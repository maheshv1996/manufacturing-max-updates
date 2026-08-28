"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  X,
  Save,
  AlertTriangle,
} from "lucide-react";
import { Button, Select } from "@/app/components/ui";
import { addDays, startOfWeek, format } from "date-fns";

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}
interface Operator {
  id: string;
  name: string;
  employeeNumber: string | null;
}
interface DayCell {
  date: string;
  label: string;
  shifts: {
    shiftId: string;
    shiftName: string;
    rostered: number;
    attended: number;
    shortfall: number;
    underMinimum: boolean;
    minStaffing: number;
    operators: { id: string; name: string; employeeNumber: string | null }[];
  }[];
}

export default function RosterClient() {
  const [weekStart, setWeekStart] = useState(() => {
    const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
    return format(ws, "yyyy-MM-dd");
  });
  const [days, setDays] = useState<DayCell[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [roster, setRoster] = useState<any>(null);
  const [minStaffing, setMinStaffing] = useState(2);
  const [, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // editor state: dayKey+shiftId → list of operator ids
  const [editing, setEditing] = useState<Record<string, string[]>>({});
  const [pickFor, setPickFor] = useState<string | null>(null); // cell key

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/roster?weekStart=${weekStart}`);
      const data = await res.json();
      setDays(data.days || []);
      setShifts(data.shifts || []);
      setOperators(data.operators || []);
      setRoster(data.roster || null);
      setMinStaffing(data.minStaffingPerShift ?? 2);
      // seed editor from published roster
      const map: Record<string, string[]> = {};
      for (const d of data.days || []) {
        for (const s of d.shifts) {
          map[`${d.date}|${s.shiftId}`] = s.operators.map((o: any) => o.id);
        }
      }
      setEditing(map);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const cellKey = (date: string, shiftId: string) => `${date}|${shiftId}`;

  const addOp = (key: string, opId: string) => {
    setEditing((prev) => ({ ...prev, [key]: [...(prev[key] || []), opId] }));
    setPickFor(null);
  };
  const removeOp = (key: string, opId: string) => {
    setEditing((prev) => ({
      ...prev,
      [key]: (prev[key] || []).filter((id) => id !== opId),
    }));
  };

  const publish = async () => {
    const entries: { userId: string; shiftId: string; date: string }[] = [];
    for (const [key, ids] of Object.entries(editing)) {
      const [date, shiftId] = key.split("|");
      for (const userId of ids)
        entries.push({
          userId,
          shiftId,
          date: new Date(date + "T00:00:00").toISOString(),
        });
    }
    setMsg("");
    setBusy(true);
    try {
      const res = await fetch("/api/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish",
          data: {
            weekStart,
            entries,
            notes: "Weekly roster published from builder.",
          },
        }),
      });
      const d = await res.json();
      if (res.ok) {
        setMsg(`Roster published — ${entries.length} entries.`);
        await fetchAll();
      } else {
        setMsg(d.error || "Publish failed");
      }
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  };

  const weekLabel = `${format(new Date(weekStart), "dd MMM")} – ${format(addDays(new Date(weekStart), 6), "dd MMM yyyy")}`;

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-emerald-300 font-semibold">{msg}</p>}

      {/* Week nav + publish */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              setWeekStart(
                format(addDays(new Date(weekStart), -7), "yyyy-MM-dd"),
              )
            }
            className="p-2 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 hover:bg-slate-700"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <p className="font-bold text-white">{weekLabel}</p>
            <p className="text-[11px] text-slate-400">
              {roster
                ? `Published by ${roster.publishedBy} · ${roster.status}`
                : "Not published yet"}{" "}
              · min staffing {minStaffing}/shift
            </p>
          </div>
          <button
            onClick={() =>
              setWeekStart(
                format(addDays(new Date(weekStart), 7), "yyyy-MM-dd"),
              )
            }
            className="p-2 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 hover:bg-slate-700"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <Button onClick={publish} disabled={busy} className="sm:ml-auto">
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}{" "}
          Publish roster
        </Button>
      </div>

      {/* Roster grid */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-indigo-400" />
          <h3 className="font-bold text-white">
            Weekly grid — tap a cell to add operators
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                <th className="px-3 py-3 w-32">Day</th>
                {shifts.map((s) => (
                  <th key={s.id} className="px-3 py-3 min-w-[190px]">
                    {s.name}
                    <span className="block text-[10px] text-slate-500">
                      {s.startTime}–{s.endTime}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr
                  key={d.date}
                  className="border-b border-slate-700/50 align-top"
                >
                  <td className="px-3 py-3 font-semibold text-white whitespace-nowrap">
                    {d.label}
                  </td>
                  {d.shifts.map((s) => {
                    const key = cellKey(d.date, s.shiftId);
                    const assigned = editing[key] || [];
                    const under = assigned.length < minStaffing;
                    return (
                      <td key={s.shiftId} className="px-3 py-3">
                        <div
                          className={`rounded-xl border p-2 ${under ? "border-rose-500/50 bg-rose-500/5" : "border-slate-700/70 bg-slate-900/40"}`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              className={`text-[10px] font-bold ${under ? "text-rose-400" : assigned.length >= minStaffing ? "text-emerald-400" : "text-slate-500"}`}
                            >
                              {assigned.length}/{minStaffing} min
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {s.attended} present · {s.rostered} rostered
                            </span>
                          </div>
                          <div className="space-y-1">
                            {assigned.map((opId) => {
                              const op = operators.find((o) => o.id === opId);
                              return (
                                <div
                                  key={opId}
                                  className="flex items-center justify-between gap-1 rounded-lg bg-slate-800/70 border border-slate-700 px-2 py-1"
                                >
                                  <span className="text-xs text-slate-200 truncate">
                                    {op?.name || "?"}
                                  </span>
                                  <button
                                    onClick={() => removeOp(key, opId)}
                                    className="text-slate-500 hover:text-rose-400"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                            <button
                              onClick={() =>
                                setPickFor(pickFor === key ? null : key)
                              }
                              className="w-full flex items-center justify-center gap-1 rounded-lg border border-dashed border-slate-600 px-2 py-1 text-[11px] text-slate-400 hover:text-white hover:border-slate-500"
                            >
                              <Plus className="w-3 h-3" /> Add
                            </button>
                          </div>
                          {pickFor === key && (
                            <div className="mt-2">
                              <Select
                                value=""
                                onChange={(e) =>
                                  e.target.value && addOp(key, e.target.value)
                                }
                                className="text-xs"
                              >
                                <option value="">Select operator…</option>
                                {operators.map((o) => (
                                  <option
                                    key={o.id}
                                    value={o.id}
                                    disabled={assigned.includes(o.id)}
                                  >
                                    {o.name}
                                    {o.employeeNumber
                                      ? ` (${o.employeeNumber})`
                                      : ""}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Variance */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-5">
        <h3 className="font-bold text-white mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" /> Roster vs
          attendance
        </h3>
        <div className="space-y-2">
          {days.flatMap((d) =>
            d.shifts
              .filter((s) => s.rostered !== s.attended || s.underMinimum)
              .map((s) => (
                <div
                  key={`${d.date}-${s.shiftId}`}
                  className="flex items-center justify-between text-xs rounded-xl bg-slate-900/50 border border-slate-700 px-4 py-2.5"
                >
                  <span className="text-slate-300 font-semibold">
                    {d.label} · {s.shiftName}
                  </span>
                  {s.underMinimum ? (
                    <span className="text-rose-400 font-bold">
                      UNDER MINIMUM — {s.rostered} rostered vs {s.minStaffing}{" "}
                      needed
                    </span>
                  ) : (
                    <span
                      className={
                        s.attended < s.rostered
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }
                    >
                      {s.rostered} rostered vs {s.attended} attended (
                      {s.attended < s.rostered ? "shortfall" : "extra"})
                    </span>
                  )}
                </div>
              )),
          )}
          {days.every((d) =>
            d.shifts.every((s) => !s.underMinimum && s.rostered === s.attended),
          ) && (
            <p className="text-xs text-slate-500">
              No variance in this week. 🎉
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
