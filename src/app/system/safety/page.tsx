"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  RefreshCw,
  Flame,
  FileText,
  Layers,
  X,
} from "lucide-react";

interface Incident {
  id: string;
  type: "NEAR_MISS" | "HAZARD" | "PPE_VIOLATION" | "INCIDENT";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  location: string;
  reportedBy: string;
  status: "OPEN" | "CAPA_ASSIGNED" | "CLOSED";
  capaOwner?: string;
  capaDueDate?: string;
  fiveWhyReason?: string;
  createdAt: string;
}

export default function SafetyDashboardPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [daysSince, setDaysSince] = useState<number>(0);
  const [heatmap, setHeatmap] = useState<
    Record<string, Record<string, number>>
  >({});
  const [openCapas, setOpenCapas] = useState<number>(0);
  const [criticalCount, setCriticalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [filterStatus] = useState<string>("ALL");

  // CAPA Modal State
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(
    null,
  );
  const [capaOwnerInput, setCapaOwnerInput] = useState("");
  const [capaDueDateInput, setCapaDueDateInput] = useState("");
  const [fiveWhyInput, setFiveWhyInput] = useState("");
  const [capaStatusInput, setCapaStatusInput] = useState("CAPA_ASSIGNED");
  const [updatingCapa, setUpdatingCapa] = useState(false);

  // Fast Log Modal State
  const [showLogModal, setShowLogModal] = useState(false);
  const [typeInput, setTypeInput] = useState<string>("HAZARD");
  const [severityInput, setSeverityInput] = useState<string>("HIGH");
  const [descInput, setDescInput] = useState("");
  const [locationInput, setLocationInput] = useState("CNC Milling Bay");
  const [reporterInput, setReporterInput] = useState("Operator");
  const [logging, setLogging] = useState(false);

  const fetchSafetyData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/safety");
      const data = await res.json();
      setIncidents(data.incidents || []);
      setDaysSince(data.daysSinceLastIncident || 0);
      setHeatmap(data.heatmap || {});
      setOpenCapas(data.openCapas || 0);
      setCriticalCount(data.criticalCount || 0);
    } catch (e) {
      logClientError("Fetch safety data error:", e, "page");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSafetyData();
  }, []);

  const handleOpenCapaModal = (inc: Incident) => {
    setSelectedIncident(inc);
    setCapaOwnerInput(inc.capaOwner || "");
    setCapaDueDateInput(
      inc.capaDueDate
        ? new Date(inc.capaDueDate).toISOString().split("T")[0]
        : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
    );
    setFiveWhyInput(inc.fiveWhyReason || "");
    setCapaStatusInput(inc.status === "OPEN" ? "CAPA_ASSIGNED" : inc.status);
  };

  const handleSaveCapa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    try {
      setUpdatingCapa(true);
      const res = await fetch("/api/safety", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedIncident.id,
          capaOwner: capaOwnerInput.trim(),
          capaDueDate: capaDueDateInput,
          fiveWhyReason: fiveWhyInput.trim(),
          status: capaStatusInput,
        }),
      });

      if (res.ok) {
        alert("✅ CAPA & 5-Why Analysis updated successfully!");
        setSelectedIncident(null);
        fetchSafetyData();
      } else {
        alert("Failed to update CAPA");
      }
    } catch (e) {
      alert("Error updating CAPA");
    } finally {
      setUpdatingCapa(false);
    }
  };

  const handleCreateSafetyReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLogging(true);
      const res = await fetch("/api/safety", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: typeInput,
          severity: severityInput,
          description: descInput.trim(),
          location: locationInput.trim(),
          reportedBy: reporterInput.trim() || "Operator",
        }),
      });

      if (res.ok) {
        alert(
          severityInput === "HIGH" || severityInput === "CRITICAL"
            ? "🚨 CRITICAL Safety Report Logged! Immediate Andon alert triggered on shopfloor."
            : "⚠️ Safety incident reported successfully.",
        );
        setShowLogModal(false);
        setDescInput("");
        fetchSafetyData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to log safety incident");
      }
    } catch (e) {
      alert("Error submitting safety report");
    } finally {
      setLogging(false);
    }
  };

  const filteredIncidents = incidents.filter((i) => {
    const sevMatch = filterSeverity === "ALL" || i.severity === filterSeverity;
    const statMatch = filterStatus === "ALL" || i.status === filterStatus;
    return sevMatch && statMatch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-rose-500" />
              Zero-Harm Safety &amp; Near-Miss EHS Management
            </h1>
            <p className="text-xs text-slate-400">
              Hazard triage queue, CAPA 5-Why root cause logging, EHS risk
              heatmaps, and Andon alerts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchSafetyData}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 border border-slate-700 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={() => setShowLogModal(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-rose-600/30 cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" />
              Log Safety Hazard ⚠️
            </button>
          </div>
        </div>

        {/* METRIC CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* DAYS SINCE LAST INCIDENT */}
          <div className="bg-slate-900 border-2 border-emerald-500/40 rounded-2xl p-5 space-y-2 shadow-xl">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-extrabold text-emerald-400">
                Days Since Last Incident
              </span>
              <ShieldAlert className="w-6 h-6 text-emerald-400 animate-pulse" />
            </div>
            <div className="text-4xl font-black font-mono text-emerald-400">
              {daysSince} Days
            </div>
            <p className="text-[11px] text-slate-400">
              Zero-Harm safety streak
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-extrabold">
                Active Open Hazards
              </span>
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl font-black font-mono text-amber-400">
              {incidents.filter((i) => i.status !== "CLOSED").length}
            </div>
            <p className="text-[11px] text-slate-400">
              Under triage &amp; action
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-extrabold">
                Open CAPAs Pending
              </span>
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-3xl font-black font-mono text-blue-400">
              {openCapas}
            </div>
            <p className="text-[11px] text-slate-400">
              5-Why corrective actions assigned
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-extrabold">
                High/Critical EHS Risks
              </span>
              <Flame className="w-5 h-5 text-rose-500" />
            </div>
            <div className="text-3xl font-black font-mono text-rose-500">
              {criticalCount}
            </div>
            <p className="text-[11px] text-slate-400">Auto Andon triggers</p>
          </div>
        </div>

        {/* EHS RISK HEATMAP MATRIX */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <h2 className="text-base font-extrabold text-white flex items-center gap-2 uppercase tracking-wider">
            <Layers className="w-5 h-5 text-rose-400" />
            Shopfloor EHS Risk Heatmap (Location x Severity)
          </h2>

          {Object.keys(heatmap).length === 0 ? (
            <p className="text-xs text-slate-500 italic p-4 text-center">
              No location heatmap data recorded.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 font-extrabold text-slate-400 uppercase font-mono">
                    <th className="p-3">Shopfloor Location</th>
                    <th className="p-3 text-center text-blue-400">
                      Low Severity
                    </th>
                    <th className="p-3 text-center text-amber-400">
                      Medium Severity
                    </th>
                    <th className="p-3 text-center text-orange-400">
                      High Severity
                    </th>
                    <th className="p-3 text-center text-rose-500">
                      Critical Risk
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {Object.entries(heatmap).map(([loc, counts]) => (
                    <tr key={loc} className="hover:bg-slate-950/60">
                      <td className="p-3 font-bold text-white font-sans">
                        {loc}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2.5 py-1 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-black">
                          {counts.LOW || 0}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-black">
                          {counts.MEDIUM || 0}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2.5 py-1 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30 font-black">
                          {counts.HIGH || 0}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 font-black">
                          {counts.CRITICAL || 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* HAZARD TRIAGE QUEUE */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              Hazard Triage &amp; CAPA Queue ({filteredIncidents.length})
            </h2>

            {/* FILTERS */}
            <div className="flex flex-wrap gap-2">
              {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setFilterSeverity(sev)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition-all cursor-pointer ${
                    filterSeverity === sev
                      ? "bg-rose-600 text-white shadow-md"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 font-mono text-xs animate-pulse">
              Loading Safety Triage Queue...
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="py-12 text-center text-slate-500 italic text-xs">
              No incidents match the active filters.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredIncidents.map((inc) => {
                const isCritical = inc.severity === "CRITICAL";
                const isHigh = inc.severity === "HIGH";
                const isMedium = inc.severity === "MEDIUM";

                const severityBadge = isCritical
                  ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                  : isHigh
                    ? "bg-orange-500/20 text-orange-400 border-orange-500/40"
                    : isMedium
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-blue-500/20 text-blue-300 border-blue-500/40";

                const statusBadge =
                  inc.status === "CLOSED"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : inc.status === "CAPA_ASSIGNED"
                      ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                      : "bg-rose-500/20 text-rose-300 border-rose-500/40";

                return (
                  <div
                    key={inc.id}
                    className="p-5 bg-slate-950 rounded-2xl border border-slate-800 space-y-4 shadow-md hover:border-slate-700 transition-all flex flex-col md:flex-row items-start justify-between gap-4"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 text-[10px] font-black uppercase rounded border ${severityBadge}`}
                        >
                          {inc.severity} SEVERITY
                        </span>
                        <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {inc.type.replace("_", " ")}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 text-[10px] font-black uppercase rounded border ${statusBadge}`}
                        >
                          {inc.status.replace("_", " ")}
                        </span>
                      </div>

                      <div className="text-sm font-bold text-white leading-relaxed">
                        {inc.description}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-900">
                        <span>
                          Location:{" "}
                          <strong className="text-white font-sans">
                            {inc.location}
                          </strong>
                        </span>
                        <span>
                          Reported by:{" "}
                          <strong className="text-white font-sans">
                            {inc.reportedBy}
                          </strong>
                        </span>
                        <span>
                          Date: {new Date(inc.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* CAPA & 5-WHY DISPLAY */}
                      {inc.capaOwner && (
                        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1.5 text-xs text-slate-300">
                          <div className="flex items-center justify-between font-mono text-[11px]">
                            <span className="text-blue-400 font-bold">
                              CAPA Owner: {inc.capaOwner}
                            </span>
                            {inc.capaDueDate && (
                              <span className="text-slate-400">
                                Target Due:{" "}
                                {new Date(inc.capaDueDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {inc.fiveWhyReason && (
                            <div className="text-slate-400 text-[11px]">
                              <strong className="text-amber-400 block mb-0.5">
                                5-Why Root Cause Analysis:
                              </strong>
                              {inc.fiveWhyReason}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* CAPA ACTION BUTTON */}
                    <button
                      onClick={() => handleOpenCapaModal(inc)}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-2 cursor-pointer shrink-0"
                    >
                      <FileText className="w-4 h-4 text-blue-400" />
                      {inc.capaOwner ? "Edit CAPA & 5-Why" : "Assign CAPA"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* CAPA & 5-WHY MODAL */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <form
            onSubmit={handleSaveCapa}
            className="bg-slate-900 border-2 border-blue-500/50 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                Assign CAPA &amp; 5-Why Root Cause
              </h3>
              <button
                type="button"
                onClick={() => setSelectedIncident(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1">
              <div className="font-bold text-white">
                {selectedIncident.description}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {selectedIncident.location} • {selectedIncident.severity}{" "}
                Severity
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  CAPA Owner *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amit Verma (EHS Officer)"
                  value={capaOwnerInput}
                  onChange={(e) => setCapaOwnerInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Target Completion Date *
                </label>
                <input
                  type="date"
                  required
                  value={capaDueDateInput}
                  onChange={(e) => setCapaDueDateInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Status *
                </label>
                <select
                  value={capaStatusInput}
                  onChange={(e) => setCapaStatusInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="CAPA_ASSIGNED">
                    CAPA Assigned / In Progress
                  </option>
                  <option value="CLOSED">
                    CLOSED (Corrective Action Complete)
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  5-Why Root Cause Analysis *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Why 1: Spilled oil on floor. Why 2: Seal failure. Why 3: Overdue maintenance..."
                  value={fiveWhyInput}
                  onChange={(e) => setFiveWhyInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedIncident(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updatingCapa}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg cursor-pointer"
              >
                {updatingCapa ? "Saving..." : "Save CAPA & 5-Why"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FAST LOG SAFETY HAZARD MODAL */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <form
            onSubmit={handleCreateSafetyReport}
            className="bg-slate-900 border-2 border-rose-500/50 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                Report Safety Hazard / Near-Miss
              </h3>
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Incident Type *
                </label>
                <select
                  value={typeInput}
                  onChange={(e) => setTypeInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="HAZARD">Hazard Condition</option>
                  <option value="NEAR_MISS">Near-Miss Event</option>
                  <option value="PPE_VIOLATION">PPE Violation</option>
                  <option value="INCIDENT">Injury Incident</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Severity *
                </label>
                <select
                  value={severityInput}
                  onChange={(e) => setSeverityInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-rose-500 font-bold"
                >
                  <option value="LOW">Low (Minor hazard)</option>
                  <option value="MEDIUM">Medium (Needs attention)</option>
                  <option value="HIGH">HIGH (High Risk - Auto Andon)</option>
                  <option value="CRITICAL">
                    CRITICAL (Stop Work - Auto Andon)
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Shopfloor Location *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CNC Milling Bay 01"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Reporter Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ravi Kumar"
                  value={reporterInput}
                  onChange={(e) => setReporterInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Detailed Description *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe the hazard, near-miss, or safety risk..."
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={logging}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-lg cursor-pointer"
              >
                {logging ? "Logging..." : "Submit Safety Report ⚠️"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
