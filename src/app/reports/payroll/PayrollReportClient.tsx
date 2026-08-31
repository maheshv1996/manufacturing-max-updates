"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState } from "react";
import PrintWrapper from "@/app/components/print/PrintWrapper";
import {
  Download,
  Printer,
  DollarSign,
  Clock,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { MonthlyPayrollSummary } from "@/lib/payrollEngine";

export default function PayrollReportClient({
  initialSummary,
}: {
  initialSummary: MonthlyPayrollSummary;
}) {
  const [selectedYear, setSelectedYear] = useState<number>(initialSummary.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(
    initialSummary.month,
  );
  const [summary, setSummary] = useState<MonthlyPayrollSummary>(initialSummary);
  const [loading, setLoading] = useState<boolean>(false);

  const handleMonthChange = async (newYear: number, newMonth: number) => {
    setSelectedYear(newYear);
    setSelectedMonth(newMonth);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reports/payroll?year=${newYear}&month=${newMonth}`,
      );
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      logClientError("Failed to fetch payroll summary:", err, "PayrollReportClient");
    } finally {
      setLoading(false);
    }
  };

  const monthStr = String(selectedMonth).padStart(2, "0");
  const monthInputValue = `${selectedYear}-${monthStr}`;

  const exportCsvUrl = `/api/reports/payroll?year=${selectedYear}&month=${selectedMonth}&export=true`;

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const formattedMonthName = `${monthNames[selectedMonth - 1]} ${selectedYear}`;

  const aboveLimitCount = summary.rows.filter(
    (r) => r.aboveStatutoryLimit,
  ).length;

  return (
    <PrintWrapper
      title="Monthly Payroll & Compensation Summary"
      subtitle={`Period: ${formattedMonthName} â€” Statutory Overtime & Attendance Payroll Register`}
      controls={
        <div className="flex flex-wrap items-center gap-3">
          {/* Month Picker */}
          <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-600 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm">
            <span className="text-slate-500 font-bold uppercase">Period:</span>
            <input
              type="month"
              value={monthInputValue}
              onChange={(e) => {
                if (e.target.value) {
                  const [y, m] = e.target.value
                    .split("-")
                    .map((v) => parseInt(v, 10));
                  handleMonthChange(y, m);
                }
              }}
              className="bg-transparent text-white font-bold outline-none cursor-pointer"
            />
          </div>

          {/* Export CSV Button */}
          <a
            href={exportCsvUrl}
            download={`payroll-${selectedYear}-${monthStr}.csv`}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-sm transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </a>

          {/* Print / Save PDF Button */}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-800/60 text-slate-200 hover:bg-slate-700 rounded-xl shadow-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="p-8 text-center text-slate-500 font-medium animate-pulse">
          Recalculating monthly payroll matrix...
        </div>
      ) : (
        <div className="space-y-6">
          {/* TOP STATS CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
            <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                <span>Gross Payroll</span>
              </div>
              <div className="text-xl font-black font-mono text-white">
                â‚¹{summary.totals.grossPay.toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Rate: â‚¹{summary.laborRate}/hr | OT Multiplier:{" "}
                {summary.multiplier}x
              </div>
            </div>

            <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                <Clock className="w-4 h-4 text-blue-500" />
                <span>Worked Hours</span>
              </div>
              <div className="text-xl font-black font-mono text-white">
                {summary.totals.workedHours} hrs
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Reg: {summary.totals.regularHours}h | OT:{" "}
                {summary.totals.otHours}h
              </div>
            </div>

            <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                <DollarSign className="w-4 h-4 text-purple-500" />
                <span>Total OT Pay</span>
              </div>
              <div className="text-xl font-black font-mono text-purple-400">
                â‚¹{summary.totals.otPay.toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Threshold: {summary.threshold}h / day
              </div>
            </div>

            <div
              className={`p-4 rounded-xl border shadow-sm ${
                aboveLimitCount > 0
                  ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800"
                  : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-1">
                {aboveLimitCount > 0 ? (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                )}
                <span
                  className={
                    aboveLimitCount > 0 ? "text-rose-300" : "text-emerald-300"
                  }
                >
                  Statutory OT Limit
                </span>
              </div>
              <div
                className={`text-xl font-black font-mono ${
                  aboveLimitCount > 0 ? "text-rose-300" : "text-emerald-300"
                }`}
              >
                {aboveLimitCount > 0
                  ? `${aboveLimitCount} Exceeded`
                  : "All Compliant"}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Monthly Cap: {summary.statutoryLimit} OT Hours
              </div>
            </div>
          </div>

          {/* MAIN PAYROLL REGISTER TABLE */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/60">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200">
                Operator Payroll Ledger â€” {formattedMonthName}
              </h3>
              <span className="text-xs font-semibold text-slate-500">
                {summary.rows.length} Operators Enrolled
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800/60 border-b border-slate-600 font-bold uppercase text-slate-300">
                    <th className="p-3">Operator</th>
                    <th className="p-3 text-center">Present Days</th>
                    <th className="p-3 text-center">Late Days</th>
                    <th className="p-3 text-right">Worked Hours</th>
                    <th className="p-3 text-right">OT Hours</th>
                    <th className="p-3 text-right">Regular Pay (â‚¹)</th>
                    <th className="p-3 text-right">OT Pay (â‚¹)</th>
                    <th className="p-3 text-right">Gross Pay (â‚¹)</th>
                    <th className="p-3 text-center">Statutory Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 font-medium">
                  {summary.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="p-6 text-center text-slate-500"
                      >
                        No attendance records found for this period.
                      </td>
                    </tr>
                  ) : (
                    summary.rows.map((row) => (
                      <tr
                        key={row.operatorId}
                        className="hover:bg-slate-50/80 hover:bg-slate-800/90/40 transition-colors"
                      >
                        <td className="p-3 font-bold text-white">
                          {row.operatorName}
                        </td>
                        <td className="p-3 text-center font-mono">
                          {row.presentDays}
                        </td>
                        <td className="p-3 text-center font-mono">
                          <span
                            className={
                              row.lateDays > 0
                                ? "text-amber-400 font-bold"
                                : "text-slate-500"
                            }
                          >
                            {row.lateDays}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono">
                          {row.workedHours} h
                        </td>
                        <td className="p-3 text-right font-mono">
                          <span
                            className={
                              row.otHours > 0
                                ? "text-purple-400 font-bold"
                                : "text-slate-500"
                            }
                          >
                            {row.otHours} h
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono">
                          â‚¹
                          {row.regularPay.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-purple-400">
                          â‚¹
                          {row.otPay.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-3 text-right font-mono font-extrabold text-white">
                          â‚¹
                          {row.grossPay.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-3 text-center">
                          {row.aboveStatutoryLimit ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-950 text-rose-300 border border-rose-300 dark:border-rose-800">
                              <AlertTriangle className="w-3 h-3" />
                              <span>&gt;{summary.statutoryLimit}h Limit</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800/60 text-slate-400">
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-800/60 border-t-2 border-slate-600 font-black">
                  <tr>
                    <td className="p-3 uppercase tracking-wider text-slate-200">
                      Total Payroll
                    </td>
                    <td className="p-3 text-center font-mono text-white">
                      {summary.totals.presentDays}
                    </td>
                    <td className="p-3 text-center font-mono text-white">
                      {summary.totals.lateDays}
                    </td>
                    <td className="p-3 text-right font-mono text-white">
                      {summary.totals.workedHours} h
                    </td>
                    <td className="p-3 text-right font-mono text-purple-400">
                      {summary.totals.otHours} h
                    </td>
                    <td className="p-3 text-right font-mono text-white">
                      â‚¹
                      {summary.totals.regularPay.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-3 text-right font-mono text-purple-400">
                      â‚¹
                      {summary.totals.otPay.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-3 text-right font-mono text-lg text-emerald-400">
                      â‚¹
                      {summary.totals.grossPay.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-3 text-center"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </PrintWrapper>
  );
}
