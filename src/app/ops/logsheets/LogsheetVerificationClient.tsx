"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Check,
  X,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";
import { Button } from "@/app/components/ui/Button";

interface Entry {
  type: string;
  qty?: number;
  minutes?: number;
  at?: string;
  note?: string;
}

interface Logsheet {
  id: string;
  machineId: string;
  machine: { id: string; code: string; name: string; plantId?: string };
  shiftId: string;
  shift: { id: string; name: string; startTime: string; endTime: string };
  operatorId?: string | null;
  operator?: { id: string; name: string; email?: string } | null;
  logDate: string;
  entries: Entry[];
  remarks?: string | null;
  status: "OPEN" | "SUBMITTED" | "VERIFIED" | "REJECTED";
  submittedAt?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  verificationNote?: string | null;
}

interface CrossCheckResult {
  sheetGood: number;
  sheetScrap: number;
  systemGood: number;
  systemScrap: number;
  goodMatches: boolean;
  scrapMatches: boolean;
}

export default function LogsheetVerificationClient({
  initialSheets,
}: {
  initialSheets: Logsheet[];
}) {
  const [sheets, setSheets] = useState<Logsheet[]>(initialSheets);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("" );
  const [selectedSheet, setSelectedSheet] = useState<Logsheet | null>(null);
  const [supervisorNote, setSupervisorNote] = useState<string>("");
  const [verifying, setVerifying] = useState<boolean>(false);
  const [lastCrossCheck, setLastCrossCheck] = useState<{
    [id: string]: CrossCheckResult;
  }>({});
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const filteredSheets = sheets.filter((s) => {
    if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.machine.code.toLowerCase().includes(term) ||
      s.machine.name.toLowerCase().includes(term) ||
      s.shift.name.toLowerCase().includes(term) ||
      (s.operator?.name && s.operator.name.toLowerCase().includes(term))
    );
  });

  const counts = {
    total: sheets.length,
    submitted: sheets.filter((s) => s.status === "SUBMITTED").length,
    verified: sheets.filter((s) => s.status === "VERIFIED").length,
    open: sheets.filter((s) => s.status === "OPEN").length,
    rejected: sheets.filter((s) => s.status === "REJECTED").length,
  };

  const handleVerifyOrReject = async (
    id: string,
    decision: "VERIFIED" | "REJECTED",
  ) => {
    setVerifying(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/logsheet/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: supervisorNote }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");

      if (data.crossCheck) {
        setLastCrossCheck((prev) => ({ ...prev, [id]: data.crossCheck }));
      }

      setSheets((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...data.logsheet } : s)),
      );

      if (selectedSheet?.id === id) {
        setSelectedSheet((prev) => (prev ? { ...prev, ...data.logsheet } : null));
      }

      setFeedback({
        type: "success",
        message: `Logsheet marked as ${decision}. ${
          data.crossCheck
            ? `Cross-check: Good ${
                data.crossCheck.goodMatches ? "✓ MATCH" : "⚠ VARIANCE"
              }, Scrap ${
                data.crossCheck.scrapMatches ? "✓ MATCH" : "⚠ VARIANCE"
              }`
            : ""
        }`,
      });
      setSupervisorNote("");
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Failed to process logsheet",
      });
    } finally {
      setVerifying(false);
    }
  };

  const calculateSheetSummary = (entries: Entry[]) => {
    let good = 0;
    let scrap = 0;
    let rework = 0;
    let downtime = 0;
    let setup = 0;

    entries.forEach((e) => {
      if (e.type === "GOOD") good += Number(e.qty) || 0;
      else if (e.type === "SCRAP") scrap += Number(e.qty) || 0;
      else if (e.type === "REWORK") rework += Number(e.qty) || 0;
      else if (e.type === "DOWNTIME") downtime += Number(e.minutes) || 0;
      else if (e.type === "SETUP" || e.type === "CHANGEOVER")
        setup += Number(e.minutes) || 0;
    });

    return { good, scrap, rework, downtime, setup };
  };

  return (
    <div className="space-y-6">
      {/* Header with Title & Stats */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <ClipboardCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Logsheet Verification
              </h1>
              <p className="text-sm text-slate-400">
                P3 Shopfloor Cross-Check · Manual Operator Records vs Telemetry
              </p>
            </div>
          </div>
        </div>

        {/* Quick Refresh */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const res = await fetch("/api/logsheet");
              if (res.ok) {
                const data = await res.json();
                setSheets(data);
              }
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div
          onClick={() => setStatusFilter("ALL")}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === "ALL"
              ? "bg-slate-800 border-indigo-500/50 shadow-[0_0_16px_rgba(99,102,241,0.2)]"
              : "bg-slate-800/60 border-slate-700/60 hover:bg-slate-800"
          }`}
        >
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Sheets
          </div>
          <div className="text-2xl font-black text-white mt-1">{counts.total}</div>
        </div>

        <div
          onClick={() => setStatusFilter("SUBMITTED")}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === "SUBMITTED"
              ? "bg-amber-950/40 border-amber-500/50 shadow-[0_0_16px_rgba(245,158,11,0.2)]"
              : "bg-slate-800/60 border-slate-700/60 hover:bg-slate-800"
          }`}
        >
          <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
            Pending Review
          </div>
          <div className="text-2xl font-black text-amber-300 mt-1">
            {counts.submitted}
          </div>
        </div>

        <div
          onClick={() => setStatusFilter("VERIFIED")}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === "VERIFIED"
              ? "bg-emerald-950/40 border-emerald-500/50 shadow-[0_0_16px_rgba(16,185,129,0.2)]"
              : "bg-slate-800/60 border-slate-700/60 hover:bg-slate-800"
          }`}
        >
          <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            Verified
          </div>
          <div className="text-2xl font-black text-emerald-300 mt-1">
            {counts.verified}
          </div>
        </div>

        <div
          onClick={() => setStatusFilter("OPEN")}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === "OPEN"
              ? "bg-blue-950/40 border-blue-500/50 shadow-[0_0_16px_rgba(59,130,246,0.2)]"
              : "bg-slate-800/60 border-slate-700/60 hover:bg-slate-800"
          }`}
        >
          <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
            In Progress (Open)
          </div>
          <div className="text-2xl font-black text-blue-300 mt-1">
            {counts.open}
          </div>
        </div>

        <div
          onClick={() => setStatusFilter("REJECTED")}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === "REJECTED"
              ? "bg-rose-950/40 border-rose-500/50 shadow-[0_0_16px_rgba(244,63,94,0.2)]"
              : "bg-slate-800/60 border-slate-700/60 hover:bg-slate-800"
          }`}
        >
          <div className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
            Rejected
          </div>
          <div className="text-2xl font-black text-rose-300 mt-1">
            {counts.rejected}
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
              : "bg-rose-950/30 border-rose-500/40 text-rose-200"
          }`}
        >
          <div className="flex items-center gap-3 text-sm">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-bold uppercase tracking-wider opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-800/60 border border-slate-700/60 p-4 rounded-2xl">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by machine code, shift, or operator..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUBMITTED">Submitted (Pending)</option>
            <option value="VERIFIED">Verified</option>
            <option value="OPEN">Open</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Main Grid: Logsheet List & Inspection Detail Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table / List View */}
        <div className={selectedSheet ? "lg:col-span-7" : "lg:col-span-12"}>
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-900/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                  <tr>
                    <th className="py-3.5 px-4">Date & Machine</th>
                    <th className="py-3.5 px-4">Shift & Operator</th>
                    <th className="py-3.5 px-4 text-right">Production</th>
                    <th className="py-3.5 px-4 text-right">Downtime</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {filteredSheets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No logsheets found matching the criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredSheets.map((sheet) => {
                      const summary = calculateSheetSummary(sheet.entries || []);
                      const isSelected = selectedSheet?.id === sheet.id;

                      return (
                        <tr
                          key={sheet.id}
                          onClick={() => setSelectedSheet(sheet)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-indigo-950/40 hover:bg-indigo-950/60"
                              : "hover:bg-slate-700/40"
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-indigo-400" />
                              {sheet.machine.code}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              {format(new Date(sheet.logDate), "yyyy-MM-dd")}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-slate-200">
                              {sheet.shift.name}
                            </div>
                            <div className="text-xs text-slate-400">
                              {sheet.operator?.name || "Unassigned"}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span className="font-mono font-bold text-emerald-400">
                              {summary.good}
                            </span>
                            <span className="text-slate-500 text-xs ml-1">good</span>
                            {summary.scrap > 0 && (
                              <span className="text-xs text-rose-400 ml-2 font-mono">
                                ({summary.scrap}s)
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                            {summary.downtime > 0 ? (
                              <span className="text-amber-400">
                                {summary.downtime}m
                              </span>
                            ) : (
                              <span className="text-slate-500">0m</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide ${
                                sheet.status === "VERIFIED"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                  : sheet.status === "SUBMITTED"
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                  : sheet.status === "REJECTED"
                                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                                  : "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                              }`}
                            >
                              {sheet.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSheet(sheet);
                              }}
                              className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Detailed Inspection Drawer */}
        {selectedSheet && (
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-white">
                      {selectedSheet.machine.code}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                      {selectedSheet.shift.name}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {format(new Date(selectedSheet.logDate), "EEEE, MMMM d, yyyy")}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSheet(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Header */}
              <div className="mt-4 p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">
                    Current Status
                  </div>
                  <div className="font-bold text-white mt-0.5">
                    {selectedSheet.status}
                  </div>
                </div>
                {selectedSheet.verifiedBy && (
                  <div className="text-right text-xs">
                    <div className="text-slate-400">Verified by</div>
                    <div className="font-bold text-emerald-400">
                      {selectedSheet.verifiedBy}
                    </div>
                  </div>
                )}
              </div>

              {/* Manual Sheet vs Telemetry Summary */}
              {(() => {
                const sSummary = calculateSheetSummary(
                  selectedSheet.entries || [],
                );
                const cross = lastCrossCheck[selectedSheet.id];

                return (
                  <div className="mt-4 space-y-3">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      Cross-Check Reconciliation
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                        <div className="text-xs text-slate-400">Operator Good Qty</div>
                        <div className="text-xl font-mono font-bold text-emerald-400 mt-1">
                          {sSummary.good}
                        </div>
                        {cross && (
                          <div className="text-[11px] mt-1 text-slate-400 flex items-center gap-1">
                            System:{" "}
                            <span className="font-bold text-white">
                              {cross.systemGood}
                            </span>
                            {cross.goodMatches ? (
                              <Check className="w-3 h-3 text-emerald-400 ml-auto" />
                            ) : (
                              <AlertTriangle className="w-3 h-3 text-amber-400 ml-auto" />
                            )}
                          </div>
                        )}
                      </div>

                      <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                        <div className="text-xs text-slate-400">Operator Scrap Qty</div>
                        <div className="text-xl font-mono font-bold text-rose-400 mt-1">
                          {sSummary.scrap}
                        </div>
                        {cross && (
                          <div className="text-[11px] mt-1 text-slate-400 flex items-center gap-1">
                            System:{" "}
                            <span className="font-bold text-white">
                              {cross.systemScrap}
                            </span>
                            {cross.scrapMatches ? (
                              <Check className="w-3 h-3 text-emerald-400 ml-auto" />
                            ) : (
                              <AlertTriangle className="w-3 h-3 text-amber-400 ml-auto" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Entries Feed */}
              <div className="mt-4">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Shift Entries ({(selectedSheet.entries || []).length})
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {(selectedSheet.entries || []).length === 0 ? (
                    <div className="text-xs text-slate-500 italic py-2">
                      No discrete entries logged for this shift.
                    </div>
                  ) : (
                    selectedSheet.entries.map((entry, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40 text-xs flex items-center justify-between"
                      >
                        <div>
                          <span
                            className={`font-bold px-1.5 py-0.5 rounded text-[10px] mr-2 ${
                              entry.type === "GOOD"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : entry.type === "SCRAP"
                                ? "bg-rose-500/20 text-rose-300"
                                : entry.type === "DOWNTIME"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-blue-500/20 text-blue-300"
                            }`}
                          >
                            {entry.type}
                          </span>
                          <span className="text-slate-300">
                            {entry.qty !== undefined
                              ? `${entry.qty} pcs`
                              : `${entry.minutes || 0} mins`}
                          </span>
                          {entry.note && (
                            <span className="text-slate-400 ml-2">
                              · {entry.note}
                            </span>
                          )}
                        </div>
                        {entry.at && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            {entry.at.slice(11, 16)}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Remarks / Notes */}
              {selectedSheet.remarks && (
                <div className="mt-4 p-3 rounded-lg bg-slate-800/30 border border-slate-700/30 text-xs">
                  <div className="text-slate-400 font-semibold mb-1">
                    Operator Remarks:
                  </div>
                  <div className="text-slate-200">{selectedSheet.remarks}</div>
                </div>
              )}

              {/* Supervisor Actions */}
              <div className="mt-6 border-t border-slate-800 pt-4 space-y-3">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Supervisor Verification Note
                </label>
                <textarea
                  rows={2}
                  value={supervisorNote}
                  onChange={(e) => setSupervisorNote(e.target.value)}
                  placeholder="Optional audit justification or variance note..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    variant="primary"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                    disabled={verifying}
                    onClick={() =>
                      handleVerifyOrReject(selectedSheet.id, "VERIFIED")
                    }
                  >
                    <Check className="w-4 h-4 mr-1.5" />
                    Verify Logsheet
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold"
                    disabled={verifying}
                    onClick={() =>
                      handleVerifyOrReject(selectedSheet.id, "REJECTED")
                    }
                  >
                    <X className="w-4 h-4 mr-1.5" />
                    Reject Logsheet
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
