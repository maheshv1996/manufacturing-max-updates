"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  UserCircle,
  Clock,
  AlarmClock,
  UserX,
  Timer,
  CalendarDays,
} from "lucide-react";

const FLAG_STYLE: Record<string, string> = {
  PRESENT: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  LATE: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  EARLY: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  ABSENT: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  LEAVE: "bg-sky-500/20 text-sky-300 border-sky-500/40",
};
const FLAG_LABEL: Record<string, string> = {
  PRESENT: "P",
  LATE: "L",
  EARLY: "E",
  ABSENT: "A",
  LEAVE: "V",
};

function todayMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function TimeOfficeClient() {
  const [month, setMonth] = useState(todayMonth());
  const [rows, setRows] = useState<any[]>([]);
  const [grand, setGrand] = useState({
    late: 0,
    early: 0,
    absent: 0,
    present: 0,
  });
  const [otRegister, setOtRegister] = useState<any[]>([]);
  const [otTotals, setOtTotals] = useState({
    approvedCount: 0,
    approvedHours: 0,
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const fetchData = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/time-office?month=${m}`);
      const d = await res.json();
      if (!res.ok) {
        setToast(d.error || "Failed to load");
        return;
      }
      setRows(d.rows || []);
      setGrand(d.grand || { late: 0, early: 0, absent: 0, present: 0 });
      setOtRegister(d.otRegister || []);
      setOtTotals(d.otTotals || { approvedCount: 0, approvedHours: 0 });
    } catch {
      setToast("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(month);
  }, [month, fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  const kpis = [
    {
      label: "Present",
      value: grand.present,
      icon: UserCircle,
      color: "text-emerald-300",
    },
    {
      label: "Late arrivals",
      value: grand.late,
      icon: AlarmClock,
      color: "text-amber-300",
    },
    {
      label: "Early departures",
      value: grand.early,
      icon: Timer,
      color: "text-orange-300",
    },
    {
      label: "Absent (no clock-in)",
      value: grand.absent,
      icon: UserX,
      color: "text-rose-300",
    },
    {
      label: "OT hours (approved only)",
      value: otTotals.approvedHours.toFixed(1),
      icon: Clock,
      color: "text-indigo-300",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-300 font-semibold">
            <Clock className="w-4 h-4" /> M20 — Time office flags
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Time Office — Late / Early / Absent
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Per-shift flags derived from clock-in vs shift start (+ grace) and
            clock-out vs shift end. Sundays and approved leave are excluded.
          </p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-xl bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4"
          >
            <div
              className={`text-2xl font-bold text-white flex items-center gap-2`}
            >
              <k.icon className={`w-5 h-5 ${k.color}`} />
              {k.value}
            </div>
            <div className="text-xs text-slate-400 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-500/40" /> P present
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-500/40" /> L late
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-orange-500/40" /> E early out
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-rose-500/40" /> A absent
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-sky-500/40" /> V leave
        </span>
      </div>

      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
              <th className="p-3">Employee</th>
              <th className="p-3">P</th>
              <th className="p-3">Late</th>
              <th className="p-3">Early</th>
              <th className="p-3">Absent</th>
              <th className="p-3">Day flags (date → flag)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  No attendance / roster / OT activity for this month.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.userId}
                className="border-b border-slate-700/40 last:border-0"
              >
                <td className="p-3">
                  <div className="font-medium text-white">{r.name}</div>
                  <div className="text-xs text-slate-400">
                    {r.employeeNumber || "—"}
                  </div>
                </td>
                <td className="p-3 text-emerald-300 font-semibold">
                  {r.counts.present}
                </td>
                <td className="p-3 text-amber-300 font-semibold">
                  {r.counts.late}
                </td>
                <td className="p-3 text-orange-300 font-semibold">
                  {r.counts.early}
                </td>
                <td className="p-3 text-rose-300 font-semibold">
                  {r.counts.absent}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {r.days.map((d: any, i: number) => (
                      <span
                        key={i}
                        title={`${d.date} · ${d.flag}${d.minutes ? ` (${d.minutes}m)` : ""}`}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${FLAG_STYLE[d.flag] || "bg-slate-700/40 text-slate-300"}`}
                      >
                        {FLAG_LABEL[d.flag] || d.flag}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 overflow-x-auto">
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-indigo-300" /> Overtime
            Register — APPROVED only
          </h2>
          <span className="text-xs text-slate-400">
            {otTotals.approvedCount} approvals ·{" "}
            {otTotals.approvedHours.toFixed(1)}h
          </span>
        </div>
        <table className="w-full text-sm mt-2">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
              <th className="p-3">Date</th>
              <th className="p-3">Employee</th>
              <th className="p-3">Hours</th>
              <th className="p-3">Approved by</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {otRegister.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-400">
                  No approved overtime this month — PENDING and REJECTED
                  requests never enter the register.
                </td>
              </tr>
            )}
            {otRegister.map((o) => (
              <tr
                key={o.id}
                className="border-b border-slate-700/40 last:border-0"
              >
                <td className="p-3 text-slate-300">
                  {new Date(o.date).toLocaleDateString()}
                </td>
                <td className="p-3 text-white">
                  {o.userName}{" "}
                  <span className="text-xs text-slate-400">
                    {o.employeeNumber || ""}
                  </span>
                </td>
                <td className="p-3 font-semibold text-white">{o.hours}h</td>
                <td className="p-3 text-slate-300">
                  {o.approvedByName || "—"}
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    APPROVED
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 rounded-xl bg-slate-800 border border-slate-600 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
