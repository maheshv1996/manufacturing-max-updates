"use client";

import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Timer,
} from "lucide-react";

import SourceRecordEditModal from "@/app/components/modals/SourceRecordEditModal";
import OverrideBadgeModal from "@/app/components/modals/OverrideBadgeModal";

export default function AttendanceClient() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7),
  );
  const [otData, setOtData] = useState<any>(null);
  const [otLoading, setOtLoading] = useState<boolean>(false);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [approving, setApproving] = useState<string | null>(null);

  const handleApproveReject = async (
    id: string,
    status: "APPROVED" | "REJECTED",
  ) => {
    setApproving(id);
    try {
      const res = await fetch(`/api/leaves/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: "" }),
      });
      if (res.ok) {
        fetchAttendanceData(selectedOperatorId, selectedMonth);
      }
    } catch (e) {
      logClientError(e, "AttendanceClient");
    } finally {
      setApproving(null);
    }
  };

  const fetchOverrides = () => {
    fetch("/api/overrides?entityType=OPERATOR_EFFICIENCY")
      .then((r) => r.json())
      .then((d) => setOverrides(d.overrides || []))
      .catch((err) => logClientError(err, "AttendanceClient"));
  };

  const fetchAttendanceData = async (opId: string, monthStr: string) => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/attendance?operatorId=${opId}&month=${monthStr}`,
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.operators && json.operators.length > 0 && !opId) {
          setSelectedOperatorId(json.operators[0].id);
        }
      }
    } catch (err) {
      logClientError(err, "AttendanceClient");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData(selectedOperatorId, selectedMonth);
    fetchOverrides();
  }, [selectedOperatorId, selectedMonth]);

  // Fetch OT data for the selected month
  useEffect(() => {
    const fetchOT = async () => {
      setOtLoading(true);
      try {
        const res = await fetch(`/api/overtime?month=${selectedMonth}`);
        if (res.ok) {
          const json = await res.json();
          setOtData(json);
        }
      } catch (err) {
        logClientError("OT fetch error:", err, "AttendanceClient");
      } finally {
        setOtLoading(false);
      }
    };
    fetchOT();
  }, [selectedMonth]);

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const todayBoard = data?.todayBoard || [];
  const pendingLeaves = data?.pendingLeaves || [];
  const activeLeavesToday = data?.activeLeavesToday || [];
  const leaveBalances = data?.leaveBalances;
  const operators = data?.operators || [];
  const monthlyRegister = data?.monthlyRegister || [];
  const totals = data?.monthlyTotals || {
    presentDays: 0,
    lateCount: 0,
    totalHours: 0,
  };

  return (
    <div className="space-y-10">
      {/* 0. LEAVE MANAGEMENT */}
      {(pendingLeaves.length > 0 || activeLeavesToday.length > 0) && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending Approvals */}
            {pendingLeaves.length > 0 && (
              <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Pending Leave Approvals
                </h3>
                <div className="space-y-3">
                  {pendingLeaves.map((l: any) => (
                    <div
                      key={l.id}
                      className="p-4 border border-slate-700 rounded-xl bg-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div>
                        <div className="font-bold text-white">
                          {l.user.name}
                        </div>
                        <div className="text-sm text-slate-400">
                          {l.type} â€¢ {l.days} Days (
                          {new Date(l.fromDate).toLocaleDateString()} to{" "}
                          {new Date(l.toDate).toLocaleDateString()})
                        </div>
                        <div className="text-xs text-slate-500 italic mt-1">
                          "{l.reason}"
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproveReject(l.id, "APPROVED")}
                          disabled={approving === l.id}
                          className="px-3 py-1.5 bg-emerald-500/10 text-emerald-300 rounded-lg text-sm font-bold border border-emerald-400/20 hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleApproveReject(l.id, "REJECTED")}
                          disabled={approving === l.id}
                          className="px-3 py-1.5 bg-rose-500/10 text-rose-300 rounded-lg text-sm font-bold border border-rose-400/20 hover:bg-rose-500/20 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* On Leave Today */}
            {activeLeavesToday.length > 0 && (
              <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                  <UserCheck className="w-5 h-5 text-blue-500" />
                  On Leave Today
                </h3>
                <div className="space-y-3">
                  {activeLeavesToday.map((l: any) => (
                    <div
                      key={l.id}
                      className="p-3 border border-blue-100 dark:border-blue-900/50 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-between"
                    >
                      <span className="font-bold text-blue-100">
                        {l.user.name}
                      </span>
                      <span className="text-xs font-bold px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-300 rounded-full">
                        {l.type} - {l.days} Day(s)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 1. TODAY BOARD (GROUPED BY SHIFT) */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-700 pb-4">
          <div>
            <h2 className="text-2xl font-extrabold text-white flex items-center gap-3">
              <Clock className="w-7 h-7 text-blue-500" />
              Today Attendance Board
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Live attendance status across all shifts (On Time, Late, Absent
              based on active assignments).
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-400 rounded-xl border border-blue-200 dark:border-blue-800">
            Today: {new Date().toLocaleDateString()}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {todayBoard.map((item: any) => (
            <div
              key={item.shift.id}
              className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-blue-500" />
                  {item.shift.name}
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  {item.shift.startTime} - {item.shift.endTime}
                </span>
              </div>

              <div className="space-y-2.5">
                {item.operators.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    No operators scheduled for this shift.
                  </p>
                ) : (
                  item.operators.map((op: any) => {
                    const isPresent = op.status === "PRESENT";
                    const isLate = op.status === "LATE";
                    const isAbsent = op.status === "ABSENT";

                    return (
                      <div
                        key={op.operatorId}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                          isPresent
                            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 text-emerald-200"
                            : isLate
                              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/80 text-amber-200"
                              : op.status === "ON_LEAVE"
                                ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/80 text-blue-200"
                                : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/80 text-rose-200"
                        }`}
                      >
                        <div>
                          <div className="font-bold text-sm flex items-center gap-2">
                            {op.operatorName}
                            {op.machineName && (
                              <span className="text-[11px] font-mono opacity-75">
                                ({op.machineName})
                              </span>
                            )}
                          </div>
                          <div className="text-xs opacity-80 font-mono mt-0.5">
                            {isPresent && op.clockIn && (
                              <span>
                                Clocked in:{" "}
                                {new Date(op.clockIn).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            )}
                            {isLate && op.clockIn && (
                              <span>
                                Late clock-in:{" "}
                                {new Date(op.clockIn).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            )}
                            {isAbsent && (
                              <span>Assigned shift â€” No clock-in</span>
                            )}
                            {op.status === "ON_LEAVE" && (
                              <span>On Approved Leave</span>
                            )}
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            isPresent
                              ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                              : isLate
                                ? "bg-amber-500/20 border-amber-500/30 text-amber-300"
                                : op.status === "ON_LEAVE"
                                  ? "bg-blue-500/20 border-blue-500/30 text-blue-300"
                                  : "bg-rose-500/20 border-rose-500/30 text-rose-300"
                          }`}
                        >
                          {isPresent
                            ? "On Time"
                            : isLate
                              ? "Late"
                              : op.status === "ON_LEAVE"
                                ? "On Leave"
                                : "Absent"}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. MONTHLY ATTENDANCE REGISTER & DAILY EFFICIENCY */}
      <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700 pb-6">
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-3">
              <Calendar className="w-6 h-6 text-emerald-500" />
              Monthly Attendance &amp; Efficiency Register
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Filter by operator and month to view daily attendance logs, hours
              present, and efficiency %.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">
                Select Operator
              </label>
              <select
                value={selectedOperatorId}
                onChange={(e) => setSelectedOperatorId(e.target.value)}
                className="bg-slate-800/60 border border-slate-600 rounded-xl px-4 py-2 text-sm font-bold text-white focus:outline-none"
              >
                {operators.map((op: any) => (
                  <option key={op.id} value={op.id}>
                    {op.name} ({op.username || "Operator"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">
                Select Month
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-800/60 border border-slate-600 rounded-xl px-4 py-2 text-sm font-bold text-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* MONTHLY SUMMARY STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 rounded-xl">
            <span className="text-xs text-slate-400 font-medium block">
              Present Days
            </span>
            <span className="text-2xl font-bold text-emerald-400">
              {totals.presentDays} Days
            </span>
          </div>

          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50 rounded-xl">
            <span className="text-xs text-slate-400 font-medium block">
              Late Arrivals
            </span>
            <span className="text-2xl font-bold text-amber-400">
              {totals.lateCount} Times
            </span>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 rounded-xl">
            <span className="text-xs text-slate-400 font-medium block">
              Total Hours Present
            </span>
            <span className="text-2xl font-bold text-blue-400">
              {totals.totalHours} hrs
            </span>
          </div>
        </div>

        {/* LEAVE BALANCES */}
        {leaveBalances && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 mt-4">
            {["cl", "sl", "pl"].map((type) => (
              <div
                key={type}
                className="p-4 border border-slate-700 rounded-xl bg-slate-800/60"
              >
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  {type} Balance
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-2xl font-black text-white">
                    {(leaveBalances as any)[type].remaining}
                  </span>
                  <span className="text-xs text-slate-500">
                    {(leaveBalances as any)[type].taken} /{" "}
                    {(leaveBalances as any)[type].total} taken
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* REGISTER TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs tracking-wider">
              <tr>
                <th className="py-3 px-4 rounded-l-lg font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Shift</th>
                <th className="py-3 px-4 font-semibold">Clock In</th>
                <th className="py-3 px-4 font-semibold">Clock Out</th>
                <th className="py-3 px-4 font-semibold">Hours Present</th>
                <th className="py-3 px-4 font-semibold">Good Output</th>
                <th className="py-3 px-4 font-semibold">Daily Efficiency %</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 rounded-r-lg font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 divide-slate-800">
              {monthlyRegister.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-8 text-center text-slate-400 italic"
                  >
                    No attendance records found for this operator in{" "}
                    {selectedMonth}.
                  </td>
                </tr>
              ) : (
                monthlyRegister.map((row: any) => {
                  const ov = overrides.find(
                    (o) =>
                      o.entityType === "OPERATOR_EFFICIENCY" &&
                      o.entityId === row.id &&
                      o.field === "efficiency",
                  );
                  const effDisplay = ov ? ov.value : row.efficiencyPct;

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/60 hover:bg-slate-800/90/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-bold text-white font-mono">
                        {row.date}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-slate-300">
                        {row.shiftName}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                        {new Date(row.clockIn).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                        {row.clockOut
                          ? new Date(row.clockOut).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Active"}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white">
                        {row.hoursPresent} hrs
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-400">
                        {row.goodUnits.toLocaleString()} pcs
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-black font-mono px-2 py-0.5 rounded text-xs inline-flex items-center ${
                            effDisplay >= 95
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 text-emerald-300"
                              : effDisplay >= 80
                                ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 text-cyan-300"
                                : effDisplay >= 65
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950 text-amber-300"
                                  : "bg-slate-800/60 text-slate-400"
                          }`}
                        >
                          {effDisplay}%
                        </span>
                        <OverrideBadgeModal
                          entityType="OPERATOR_EFFICIENCY"
                          entityId={row.id}
                          field="efficiency"
                          fieldLabel="Daily Efficiency %"
                          currentCalculatedValue={row.efficiencyPct}
                          existingOverride={ov}
                          unit="%"
                          onOverrideSaved={fetchOverrides}
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                            row.status === "PRESENT"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 text-emerald-300 dark:border-emerald-800"
                              : row.status === "ON_LEAVE"
                                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 text-blue-300 dark:border-blue-800"
                                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 text-amber-300 dark:border-amber-800"
                          }`}
                        >
                          {row.status === "PRESENT"
                            ? "Present"
                            : row.status === "ON_LEAVE"
                              ? "On Leave"
                              : "Late"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <SourceRecordEditModal
                          entityType="AttendanceLog"
                          entityId={row.id}
                          title="Attendance Record"
                          fields={[
                            {
                              key: "clockIn",
                              label: "Clock In",
                              type: "datetime",
                            },
                            {
                              key: "clockOut",
                              label: "Clock Out",
                              type: "datetime",
                            },
                            {
                              key: "status",
                              label: "Status",
                              type: "select",
                              options: [
                                { label: "Present", value: "PRESENT" },
                                { label: "Late", value: "LATE" },
                              ],
                            },
                          ]}
                          initialValues={{
                            clockIn: row.clockIn,
                            clockOut: row.clockOut,
                            status: row.status,
                          }}
                          onSaved={() =>
                            fetchAttendanceData(
                              selectedOperatorId,
                              selectedMonth,
                            )
                          }
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. OVERTIME - THIS MONTH */}
      <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700 pb-6">
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-3">
              <Timer className="w-6 h-6 text-amber-500" />
              Overtime â€” This Month
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              OT computed as hours beyond {otData?.threshold ?? 9}h/day â€¢
              Multiplier: Ã—{otData?.multiplier ?? 2} â€¢ Labor Rate: â‚¹
              {otData?.laborRate ?? 150}/hr
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-800/60 border border-slate-600 px-3 py-2 rounded-xl text-sm font-bold text-white"
            />
          </div>
        </div>

        {otLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
          </div>
        ) : !otData?.summaries || otData.summaries.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8 italic">
            No operator OT data for this month.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs tracking-wider">
                <tr>
                  <th className="py-3 px-4 rounded-l-lg font-semibold">
                    Operator
                  </th>
                  <th className="py-3 px-4 font-semibold">Present Days</th>
                  <th className="py-3 px-4 font-semibold">Total Worked (h)</th>
                  <th className="py-3 px-4 font-semibold">Total OT (h)</th>
                  <th className="py-3 px-4 font-semibold">Est. OT Pay</th>
                  <th className="py-3 px-4 rounded-r-lg font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 divide-slate-800">
                {otData.summaries.map((op: any) => (
                  <tr
                    key={op.operatorId}
                    className="hover:bg-slate-50/60 hover:bg-slate-800/90/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-bold text-white">
                      {op.operatorName}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {op.presentDays}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-white">
                      {op.totalWorkedHours.toFixed(1)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`font-black font-mono px-2 py-0.5 rounded text-xs ${
                          op.totalOtHours > 0
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950 text-amber-300"
                            : "bg-slate-100 text-slate-500 bg-slate-800/60 text-slate-400"
                        }`}
                      >
                        {op.totalOtHours.toFixed(1)}h
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white font-mono">
                      â‚¹{op.estimatedOtPay.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-4">
                      {op.aboveStatutoryLimit ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 text-amber-300 dark:border-amber-800">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Above statutory limit!
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 text-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Within limit
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
