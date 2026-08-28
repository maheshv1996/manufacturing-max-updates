"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function FaiListPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // New FAI form state
  const [workOrderId, setWorkOrderId] = useState("");
  const [serialUnitId, setSerialUnitId] = useState("");
  const [type, setType] = useState("FULL");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchReports = async () => {
    try {
      const res = await fetch("/api/fai");
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/fai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workOrderId, serialUnitId, type }),
      });
      if (res.ok) {
        setShowModal(false);
        fetchReports();
        setWorkOrderId("");
        setSerialUnitId("");
        setType("FULL");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create FAI");
      }
    } catch (e) {
      setError("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-emerald-500/10 text-emerald-400";
      case "REJECTED":
        return "bg-rose-500/10 text-rose-400";
      case "SUBMITTED":
        return "bg-blue-500/10 text-blue-400";
      default:
        return "bg-slate-700/30 text-slate-300";
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">
              First Article Inspections
            </h1>
            <p className="text-slate-400 mt-1">AS9102 Compliance Reports</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg shadow-lg shadow-blue-500/25 hover:from-blue-400 hover:to-blue-500 transition"
          >
            + New FAI Report
          </button>
        </div>

        {loading ? (
          <p className="text-slate-400">Loading reports...</p>
        ) : reports.length === 0 ? (
          <div className="bg-slate-800/60 p-8 rounded-2xl border border-white/10 text-center backdrop-blur-xl">
            <p className="text-slate-400">No FAI Reports found.</p>
          </div>
        ) : (
          <div className="bg-slate-800/60 rounded-2xl border border-white/10 overflow-hidden backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-slate-800/60">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    FAI Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    Work Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    Serial
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                      {r.faiNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {r.workOrder?.woNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {r.serialUnit?.serialNo || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {r.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(r.status)}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/fai/${r.id}`}
                        className="text-blue-400 hover:text-blue-300 mr-4"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/reports/fai/${r.id}`}
                        className="text-indigo-400 hover:text-indigo-300"
                        target="_blank"
                      >
                        Print AS9102
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-900 rounded-xl border border-white/10 shadow-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-4">
                Create FAI Report
              </h2>
              {error && (
                <div className="mb-4 text-rose-400 text-sm">{error}</div>
              )}

              <form onSubmit={handleCreate}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Work Order ID
                  </label>
                  <input
                    type="text"
                    required
                    value={workOrderId}
                    onChange={(e) => setWorkOrderId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    placeholder="e.g. WO-AERO-12345"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Serial Unit ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={serialUnitId}
                    onChange={(e) => setSerialUnitId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    <option value="FULL">FULL</option>
                    <option value="PARTIAL">PARTIAL</option>
                    <option value="DELTA">DELTA</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 transition"
                  >
                    {submitting ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
