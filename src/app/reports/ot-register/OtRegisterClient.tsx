"use client";

import { useState, useEffect } from "react";
import { Loader2, Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function OtRegisterClient() {
  const [operators, setOperators] = useState<any[]>([]);
  const [selectedOpId, setSelectedOpId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7),
  );
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [opLoading, setOpLoading] = useState(true);

  // Fetch operators
  useEffect(() => {
    fetch("/api/admin/data")
      .then((r) => r.json())
      .then((d) => {
        const ops = (d.users || []).filter(
          (u: any) => u.role?.name === "Operator",
        );
        setOperators(ops);
        if (ops.length > 0) setSelectedOpId(ops[0].id);
      })
      .finally(() => setOpLoading(false));
  }, []);

  // Fetch OT detail when operator or month changes
  useEffect(() => {
    if (!selectedOpId) return;
    setLoading(true);
    fetch(`/api/overtime?operatorId=${selectedOpId}&month=${selectedMonth}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedOpId, selectedMonth]);

  const selectedOp = operators.find((o) => o.id === selectedOpId);
  const [yearStr, monthStr] = selectedMonth.split("-");
  const monthLabel = new Date(
    parseInt(yearStr),
    parseInt(monthStr) - 1,
  ).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-bg text-slate-100">
      <div className="no-print p-4 sm:p-6 bg-slate-800/60 border-b border-slate-700 space-y-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center gap-4">
          <Link
            href="/reports"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-500 font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Reports
          </Link>
          <h1 className="text-2xl font-black tracking-tight flex-1">
            OT Register
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            {opLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            ) : (
              <select
                value={selectedOpId}
                onChange={(e) => setSelectedOpId(e.target.value)}
                className="bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold"
              >
                {operators.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.name}
                  </option>
                ))}
              </select>
            )}
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold"
            />
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
          </div>
        </div>
      </div>

      {/* Print-ready content */}
      <div className="max-w-5xl mx-auto p-4 sm:p-8 print:p-0 print:max-w-none">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : !data || !data.rows ? (
          <p className="text-center text-slate-400 py-16 italic">
            Select an operator and month to generate the OT register.
          </p>
        ) : (
          <div className="space-y-8 print:space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between print:mb-4">
              <div>
                <h2 className="text-2xl font-black print:text-xl">
                  ⏱ Overtime Register
                </h2>
                <p className="text-sm text-slate-500 mt-1 print:text-xs">
                  <strong>Operator:</strong> {selectedOp?.name || "—"}{" "}
                  &nbsp;|&nbsp;
                  <strong>Month:</strong> {monthLabel} &nbsp;|&nbsp;
                  <strong>Generated:</strong>{" "}
                  {new Date().toLocaleDateString("en-IN")}
                </p>
              </div>
              <div className="text-right text-xs text-slate-500 print:text-[10px]">
                <div>
                  Threshold: <strong>{data.threshold}h/day</strong>
                </div>
                <div>
                  Multiplier: <strong>×{data.multiplier}</strong>
                </div>
                <div>
                  Labor Rate: <strong>₹{data.laborRate}/hr</strong>
                </div>
              </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-4 gap-4 print:gap-2">
              {[
                {
                  label: "Total Days",
                  value: data.rows.length,
                  color: "text-blue-600",
                },
                {
                  label: "Total Worked",
                  value: `${data.totalWorked}h`,
                  color: "text-white",
                },
                {
                  label: "Total OT",
                  value: `${data.totalOt}h`,
                  color:
                    data.totalOt > 50 ? "text-red-600" : "text-amber-600",
                },
                {
                  label: "Est. OT Pay",
                  value: `₹${data.estimatedOtPay.toLocaleString("en-IN")}`,
                  color: "text-emerald-600",
                },
              ].map((kpi, i) => (
                <div
                  key={i}
                  className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-center print:p-2 print:rounded-none"
                >
                  <div
                    className={`text-2xl font-black font-mono ${kpi.color} print:text-lg`}
                  >
                    {kpi.value}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">
                    {kpi.label}
                  </div>
                </div>
              ))}
            </div>

            {data.totalOt > 50 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3 text-sm font-bold text-amber-300 print:rounded-none">
                ⚠️ This operator has exceeded the 50-hour statutory
                monthly OT limit ({data.totalOt}h).
              </div>
            )}

            {/* Daily Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white print:bg-slate-900 print:text-[9px]">
                    <th className="py-2.5 px-3 font-bold text-xs uppercase tracking-wider">
                      Date
                    </th>
                    <th className="py-2.5 px-3 font-bold text-xs uppercase tracking-wider">
                      Shift
                    </th>
                    <th className="py-2.5 px-3 font-bold text-xs uppercase tracking-wider">
                      Clock In
                    </th>
                    <th className="py-2.5 px-3 font-bold text-xs uppercase tracking-wider">
                      Clock Out
                    </th>
                    <th className="py-2.5 px-3 font-bold text-xs uppercase tracking-wider">
                      Worked (h)
                    </th>
                    <th className="py-2.5 px-3 font-bold text-xs uppercase tracking-wider">
                      OT (h)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {data.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-slate-400 italic"
                      >
                        No attendance records with clock-out for this period.
                      </td>
                    </tr>
                  ) : (
                    data.rows.map((row: any, idx: number) => (
                      <tr
                        key={idx}
                        className={`${idx % 2 === 0 ? "" : "bg-slate-800/60"} hover:bg-slate-800/90 transition-colors`}
                      >
                        <td className="py-2.5 px-3 font-bold font-mono text-white print:text-xs">
                          {new Date(row.date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 print:text-xs">
                          {row.shiftName}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs text-slate-300">
                          {new Date(row.clockIn).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs text-slate-300">
                          {new Date(row.clockOut).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2.5 px-3 font-bold font-mono text-white print:text-xs">
                          {row.workedHours.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 print:text-xs">
                          {row.otHours > 0 ? (
                            <span className="font-black font-mono text-amber-300 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded">
                              +{row.otHours.toFixed(2)}
                            </span>
                          ) : (
                            <span className="font-mono text-slate-400">
                              0.00
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {data.rows.length > 0 && (
                  <tfoot className="border-t-2 border-slate-300 font-black">
                    <tr className="bg-slate-800/60 print:bg-slate-200">
                      <td
                        colSpan={4}
                        className="py-3 px-3 text-right uppercase text-xs tracking-wider text-slate-300"
                      >
                        Totals
                      </td>
                      <td className="py-3 px-3 font-mono text-white">
                        {data.totalWorked}h
                      </td>
                      <td className="py-3 px-3 font-mono text-amber-300">
                        {data.totalOt}h
                      </td>
                    </tr>
                    <tr className="bg-emerald-50 dark:bg-emerald-950/30">
                      <td
                        colSpan={4}
                        className="py-3 px-3 text-right uppercase text-xs tracking-wider text-slate-300"
                      >
                        Estimated OT Pay ({data.totalOt}h × ₹{data.laborRate} ×{" "}
                        {data.multiplier})
                      </td>
                      <td
                        colSpan={2}
                        className="py-3 px-3 font-mono text-xl text-emerald-400"
                      >
                        ₹{data.estimatedOtPay.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Footer */}
            <div className="flex justify-between text-[10px] text-slate-400 pt-4 border-t border-slate-700 print:text-[8px]">
              <span>Manufacturing MES — OT Register</span>
              <span>Generated {new Date().toLocaleString("en-IN")}</span>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          body {
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  );
}
