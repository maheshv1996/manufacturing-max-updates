"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Plus, RefreshCw, X } from "lucide-react";
import { Machine } from "@/lib/data";

const DOWNTIME_CATEGORIES = [
  "Mechanical",
  "Electrical",
  "Material Shortage",
  "Tooling & Setup",
  "Quality Alert",
  "Changeover",
  "Other",
];

function getLocalDateTimeString(d = new Date()) {
  const pad = (n: number) => (n < 10 ? "0" + n : n);
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

interface Props {
  machines: Machine[];
}

export default function DashboardHeaderClient({ machines }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Log Downtime Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Export Report Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [reportType, setReportType] = useState<"downtime" | "oee">("downtime");
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "all">("7d");

  // Form Fields State
  const [formMachineId, setFormMachineId] = useState(
    machines.length > 0 ? machines[0].id : "",
  );
  const [formCategory, setFormCategory] = useState("Mechanical");
  const [formReason, setFormReason] = useState("");
  const [formStartedAt, setFormStartedAt] = useState(getLocalDateTimeString());
  const [formEndedAt, setFormEndedAt] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const handleRefresh = () => {
    setLoading(true);
    router.refresh();
    setTimeout(() => setLoading(false), 500);
  };

  const openModal = () => {
    setFormError(null);
    setFormReason("");
    setFormNotes("");
    setFormStartedAt(getLocalDateTimeString());
    setFormEndedAt("");
    if (machines.length > 0 && !formMachineId) {
      setFormMachineId(machines[0].id);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (!submitting) {
      setIsModalOpen(false);
    }
  };

  const handleDownloadCsv = () => {
    const url = `/api/reports?type=${reportType}&range=${dateRange}`;
    const link = document.createElement("a");
    link.href = url;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportModalOpen(false);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMachineId || !formReason.trim() || !formStartedAt) {
      setFormError("Please fill in all required fields.");
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      const response = await fetch("/api/downtime", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          machineId: formMachineId,
          category: formCategory,
          reason: formReason.trim(),
          startedAt: formStartedAt,
          endedAt: formEndedAt ? formEndedAt : null,
          notes: formNotes.trim() ? formNotes.trim() : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit downtime event");
      }

      setIsModalOpen(false);
      router.refresh();
    } catch (err) {
      logClientError("Error submitting downtime event:", err, "DashboardHeaderClient");
      setFormError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-200 bg-slate-800/60 border border-slate-700 rounded-lg hover:bg-slate-800/90 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>

        {/* EXPORT REPORT BUTTON */}
        <button
          onClick={() => setIsExportModalOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4 text-blue-400" />
          Export Report
        </button>

        {/* LOG DOWNTIME BUTTON */}
        <button
          onClick={openModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-md shadow-blue-600/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Log Downtime
        </button>
      </div>

      {/* EXPORT REPORT MODAL */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-700 pb-4">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-bold text-white">
                  Export Analytical Report
                </h3>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Report Format & Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReportType("downtime")}
                    className={`py-2.5 px-3 text-xs font-bold rounded-xl border transition-all text-center ${
                      reportType === "downtime"
                        ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20"
                        : "bg-slate-800/60 text-slate-300 border-slate-600"
                    }`}
                  >
                    Downtime Events
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportType("oee")}
                    className={`py-2.5 px-3 text-xs font-bold rounded-xl border transition-all text-center ${
                      reportType === "oee"
                        ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20"
                        : "bg-slate-800/60 text-slate-300 border-slate-600"
                    }`}
                  >
                    OEE Summary
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Time Period Range
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "7d", label: "Last 7 Days" },
                    { id: "30d", label: "Last 30 Days" },
                    { id: "all", label: "All Time" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDateRange(item.id as any)}
                      className={`py-2 px-2 text-xs font-semibold rounded-lg border transition-all text-center ${
                        dateRange === item.id
                          ? "bg-slate-700/40 text-white border-slate-700"
                          : "bg-slate-800/60 text-slate-400 border-slate-700"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800/90 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                Download CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOG DOWNTIME MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-700 pb-4">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-bold text-white">
                  Log Downtime Event
                </h3>
              </div>
              <button
                onClick={closeModal}
                disabled={submitting}
                className="text-slate-400 hover:text-slate-600 hover:text-slate-200 p-1 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/80 text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-900">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Machine *
                </label>
                <select
                  value={formMachineId}
                  onChange={(e) => setFormMachineId(e.target.value)}
                  required
                  className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Downtime Category *
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  required
                  className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DOWNTIME_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Reason *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Spindle Motor Overheat"
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  required
                  className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Started At *
                  </label>
                  <input
                    type="datetime-local"
                    value={formStartedAt}
                    onChange={(e) => setFormStartedAt(e.target.value)}
                    required
                    className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Ended At (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formEndedAt}
                    onChange={(e) => setFormEndedAt(e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Notes / Observations
                </label>
                <textarea
                  rows={3}
                  placeholder="Additional details..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800/90 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Saving..." : "Save Downtime Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
