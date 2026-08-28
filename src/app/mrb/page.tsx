"use client";

import { useState, useEffect } from "react";
import { ShieldAlert, X, FileText, Save } from "lucide-react";

export default function MRBKanbanPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mrb");
      const data = await res.json();
      setReports(data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const statuses = ["OPEN", "UNDER_REVIEW", "DISPOSITIONED", "CLOSED"];

  const handleUpdateReport = async (
    reportId: string,
    updates: any,
    action?: string,
  ) => {
    try {
      const res = await fetch(`/api/mrb/${reportId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...updates, action }),
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

  const Drawer = () => {
    if (!selectedReport) return null;

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
              onClick={() => setSelectedReport(null)}
              className="text-slate-500 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
                Issue Details
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Defect Code:</span>{" "}
                  <span className="font-mono text-rose-400">
                    {selectedReport.defectCodeId}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Quantity:</span>{" "}
                  <span className="text-white font-bold">
                    {selectedReport.quantity}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Serial Unit:</span>{" "}
                  <span className="font-mono text-white">
                    {selectedReport.serialUnit?.serialNo || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Raised By:</span>{" "}
                  <span className="text-white">{selectedReport.raisedBy}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Description:</span>{" "}
                  <p className="text-white bg-slate-950 p-3 rounded-lg mt-1 text-xs">
                    {selectedReport.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
                Containment & Root Cause (5-Why)
              </h3>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  Containment Action
                </label>
                <textarea
                  disabled={isClosed}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  rows={2}
                  value={form.containmentAction}
                  onChange={(e) =>
                    setForm({ ...form, containmentAction: e.target.value })
                  }
                />
              </div>

              {[1, 2, 3, 4, 5].map((num) => {
                const key = `why${num}` as keyof typeof form;
                return (
                  <div key={num}>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Why {num}
                    </label>
                    <input
                      disabled={isClosed}
                      type="text"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                      value={form[key]}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                    />
                  </div>
                );
              })}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
                Corrective & Preventive Action (CAPA)
              </h3>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  Corrective Action
                </label>
                <textarea
                  disabled={isClosed}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  rows={2}
                  value={form.correctiveAction}
                  onChange={(e) =>
                    setForm({ ...form, correctiveAction: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  Preventive Action
                </label>
                <textarea
                  disabled={isClosed}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  rows={2}
                  value={form.preventiveAction}
                  onChange={(e) =>
                    setForm({ ...form, preventiveAction: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
                Disposition
              </h3>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  Disposition Decision
                </label>
                <select
                  disabled={isClosed}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  value={form.disposition}
                  onChange={(e) =>
                    setForm({ ...form, disposition: e.target.value })
                  }
                >
                  <option value="">Select...</option>
                  <option value="USE_AS_IS">Use As Is</option>
                  <option value="REWORK">Rework</option>
                  <option value="SCRAP">Scrap</option>
                  <option value="RETURN_TO_SUPPLIER">Return to Supplier</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  Status
                </label>
                <select
                  disabled={isClosed}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="OPEN">Open</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="DISPOSITIONED">Dispositioned</option>
                </select>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
            {!isClosed && (
              <>
                <button
                  onClick={() =>
                    handleUpdateReport(selectedReport.id, form, "SAVE")
                  }
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-bold flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save Draft
                </button>
                {form.disposition && form.status !== "DISPOSITIONED" && (
                  <button
                    onClick={() =>
                      handleUpdateReport(selectedReport.id, form, "DISPOSE")
                    }
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold"
                  >
                    Set Dispositioned
                  </button>
                )}
                {form.status === "DISPOSITIONED" && (
                  <button
                    onClick={() =>
                      handleUpdateReport(selectedReport.id, form, "CLOSE")
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
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-rose-500" />
              MRB Kanban
            </h1>
            <p className="text-xs text-slate-400">
              Manage Non-Conformance Reports and Dispositions
            </p>
          </div>
          <button
            onClick={fetchReports}
            className="px-4 py-2 bg-slate-800 rounded-lg text-sm font-bold"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-slate-500">
            Loading Kanban...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {statuses.map((status) => {
              const colReports = reports.filter((r) => r.status === status);
              return (
                <div
                  key={status}
                  className="bg-slate-900/50 rounded-xl border border-slate-800 p-4 flex flex-col h-[calc(100vh-200px)]"
                >
                  <h3 className="text-sm font-bold text-slate-300 uppercase flex items-center justify-between mb-4">
                    {status.replace("_", " ")}
                    <span className="bg-slate-800 px-2 py-0.5 rounded-full text-[10px]">
                      {colReports.length}
                    </span>
                  </h3>
                  <div className="flex-1 overflow-y-auto space-y-3">
                    {colReports.map((report) => (
                      <div
                        key={report.id}
                        onClick={() => setSelectedReport(report)}
                        className="bg-slate-950 border border-slate-800 hover:border-slate-600 rounded-lg p-3 cursor-pointer transition-all shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono font-bold text-blue-400">
                            {report.ncrNumber}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              report.severity === "CRITICAL"
                                ? "bg-rose-500/20 text-rose-400"
                                : report.severity === "HIGH"
                                  ? "bg-orange-500/20 text-orange-400"
                                  : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {report.severity}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-white truncate">
                          {report.workOrder?.woNumber}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono mt-1 truncate">
                          {report.defectCodeId}
                        </p>
                      </div>
                    ))}
                    {colReports.length === 0 && (
                      <div className="text-center py-6 text-slate-600 text-xs italic">
                        No items
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Drawer />
    </div>
  );
}
