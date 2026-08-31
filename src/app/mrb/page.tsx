"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  FileText,
  ShieldCheck,
  RefreshCw,
  X,
} from "lucide-react";

interface NcrReport {
  id: string;
  ncrNumber: string;
  workOrderId: string;
  source: string;
  severity: string;
  status: string;
  defectCategory: string;
  defectDescription: string;
  containmentAction?: string;
  rootCauseAnalysis?: string;
  why1?: string;
  why2?: string;
  why3?: string;
  why4?: string;
  why5?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  disposition?: string;
  dispositionNotes?: string;
  createdAt: string;
  workOrder?: {
    woNumber: string;
    product?: {
      name: string;
      sku: string;
    };
  };
}

function MrbDrawer({
  selectedReport,
  onClose,
  onUpdate,
}: {
  selectedReport: NcrReport;
  onClose: () => void;
  onUpdate: (id: string, form: any, action?: string) => Promise<void>;
}) {
  const [form, setForm] = useState({
    containmentAction: selectedReport.containmentAction || "",
    why1: selectedReport.why1 || "",
    why2: selectedReport.why2 || "",
    why3: selectedReport.why3 || "",
    why4: selectedReport.why4 || "",
    why5: selectedReport.why5 || "",
    correctiveAction: selectedReport.correctiveAction || "",
    preventiveAction: selectedReport.preventiveAction || "",
    disposition: selectedReport.disposition || "",
    status: selectedReport.status,
  });

  const isClosed = selectedReport.status === "CLOSED";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-500" />
              {selectedReport.ncrNumber}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              WO: {selectedReport.workOrder?.woNumber} | Severity:{" "}
              {selectedReport.severity}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Defect Overview */}
          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
              {selectedReport.defectCategory}
            </span>
            <p className="text-sm text-slate-200 mt-1">
              {selectedReport.defectDescription}
            </p>
          </div>

          {/* Containment Action */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Immediate Containment Action
            </label>
            <textarea
              disabled={isClosed}
              value={form.containmentAction}
              onChange={(e) =>
                setForm({ ...form, containmentAction: e.target.value })
              }
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
              placeholder="Quarantine lot, stop line, isolate tools..."
            />
          </div>

          {/* 5-Why Analysis */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Root Cause (5-Why Analysis)
            </label>
            {[1, 2, 3, 4, 5].map((level) => {
              const key = `why${level}` as keyof typeof form;
              return (
                <div key={level} className="flex gap-2">
                  <span className="text-xs font-bold text-slate-500 w-12 py-2">
                    Why {level}:
                  </span>
                  <input
                    disabled={isClosed}
                    type="text"
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder={`Why did this occur? (Level ${level})`}
                  />
                </div>
              );
            })}
          </div>

          {/* Corrective & Preventive Action */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Corrective Action (CAPA)
              </label>
              <textarea
                disabled={isClosed}
                value={form.correctiveAction}
                onChange={(e) =>
                  setForm({ ...form, correctiveAction: e.target.value })
                }
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="Fix current defect condition..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Preventive Action
              </label>
              <textarea
                disabled={isClosed}
                value={form.preventiveAction}
                onChange={(e) =>
                  setForm({ ...form, preventiveAction: e.target.value })
                }
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="Poka-yoke, SOP update, fixture redesign..."
              />
            </div>
          </div>

          {/* Disposition Decision */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              MRB Final Disposition
            </label>
            <select
              disabled={isClosed}
              value={form.disposition}
              onChange={(e) =>
                setForm({ ...form, disposition: e.target.value })
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Select Disposition...</option>
              <option value="REWORK">Rework to Standard Spec</option>
              <option value="SCRAP">Scrap / Write-off Material</option>
              <option value="USE_AS_IS">
                Use-As-Is (Engineering Concession)
              </option>
              <option value="RETURN_TO_VENDOR">
                Return to Vendor (RTV)
              </option>
            </select>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white rounded-lg text-sm"
          >
            Cancel
          </button>
          {!isClosed && (
            <>
              <button
                onClick={() => onUpdate(selectedReport.id, form)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-bold"
              >
                Save Progress
              </button>
              {form.status === "OPEN" && (
                <button
                  onClick={() =>
                    onUpdate(selectedReport.id, form, "DISPOSE")
                  }
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold"
                >
                  Set Dispositioned
                </button>
              )}
              {form.status === "DISPOSITIONED" && (
                <button
                  onClick={() =>
                    onUpdate(selectedReport.id, form, "CLOSE")
                  }
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold"
                >
                  Approve & Close NCR
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MrbDashboard() {
  const [reports, setReports] = useState<NcrReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [selectedReport, setSelectedReport] = useState<NcrReport | null>(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/mrb");
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (e) {
      logClientError("Failed to load MRB reports", e, "page");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleUpdateReport = async (
    id: string,
    payload: any,
    action?: string,
  ) => {
    try {
      const res = await fetch("/api/mrb", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload, action }),
      });
      if (res.ok) {
        alert("Report updated successfully");
        setSelectedReport(null);
        fetchReports();
      } else {
        alert("Failed to update report");
      }
    } catch (e) {
      alert("Error updating report");
    }
  };

  const filteredReports = reports.filter((r) => {
    if (filter === "ALL") return true;
    return r.status === filter;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-blue-500" />
              MRB & Quality NCR Disposition
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Material Review Board, 5-Why Root Cause Analysis & CAPA Workflows
            </p>
          </div>
          <button
            onClick={fetchReports}
            className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg text-sm"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-xs font-bold uppercase text-slate-400">
              Total NCRs
            </span>
            <p className="text-2xl font-black text-white mt-1">
              {reports.length}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-xs font-bold uppercase text-rose-400">
              Open / In-Review
            </span>
            <p className="text-2xl font-black text-rose-400 mt-1">
              {reports.filter((r) => r.status === "OPEN").length}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-xs font-bold uppercase text-blue-400">
              Dispositioned
            </span>
            <p className="text-2xl font-black text-blue-400 mt-1">
              {reports.filter((r) => r.status === "DISPOSITIONED").length}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-xs font-bold uppercase text-emerald-400">
              Closed NCRs
            </span>
            <p className="text-2xl font-black text-emerald-400 mt-1">
              {reports.filter((r) => r.status === "CLOSED").length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 border-b border-slate-800 pb-4">
          {["ALL", "OPEN", "DISPOSITIONED", "CLOSED"].map((st) => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === st
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* NCR List Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50 text-xs font-bold uppercase text-slate-400">
                <th className="p-4">NCR #</th>
                <th className="p-4">Work Order / SKU</th>
                <th className="p-4">Defect Category</th>
                <th className="p-4">Severity</th>
                <th className="p-4">Status</th>
                <th className="p-4">Disposition</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-sm">
              {loading && reports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Loading NCRs...
                  </td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No NCR records found matching filter
                  </td>
                </tr>
              ) : (
                filteredReports.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-4 font-mono font-bold text-blue-400">
                      {r.ncrNumber}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-white">
                        {r.workOrder?.woNumber || "N/A"}
                      </div>
                      <div className="text-xs text-slate-400">
                        {r.workOrder?.product?.name || "Generic Component"}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-800 border border-slate-700 text-slate-300">
                        {r.defectCategory}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          r.severity === "CRITICAL"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : r.severity === "MAJOR"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        }`}
                      >
                        {r.severity}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          r.status === "CLOSED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : r.status === "DISPOSITIONED"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="p-4 text-xs font-semibold text-slate-300">
                      {r.disposition || "Pending MRB"}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedReport(r)}
                        className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold"
                      >
                        Review / 5-Why
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedReport && (
        <MrbDrawer
          selectedReport={selectedReport}
          onClose={() => setSelectedReport(null)}
          onUpdate={handleUpdateReport}
        />
      )}
    </div>
  );
}
