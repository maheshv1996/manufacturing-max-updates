"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function FaiEditorPage() {
  const params = useParams();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [chars, setChars] = useState<any[]>([]);

  useEffect(() => {
    fetchReport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReport = async () => {
    try {
      const res = await fetch(`/api/fai/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
        setChars(data.characteristics || []);
      }
    } catch (e) {
      logClientError(e, "page");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/fai/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "IMPORT_QC" }),
      });
      if (res.ok) {
        alert("Imported QC parameters successfully!");
        fetchReport();
      } else {
        const err = await res.json();
        alert(err.error || "Import failed");
      }
    } catch (e) {
      alert("Error importing QC parameters");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChars = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/fai/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_CHARS",
          characteristics: chars,
        }),
      });
      if (res.ok) {
        alert("Saved characteristics successfully!");
        fetchReport();
      } else {
        const err = await res.json();
        alert(err.error || "Save failed");
      }
    } catch (e) {
      alert("Error saving characteristics");
    } finally {
      setSaving(false);
    }
  };

  const handleChangeStatus = async (status: string) => {
    try {
      setSaving(true);
      const res = await fetch(`/api/fai/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CHANGE_STATUS", status }),
      });
      if (res.ok) {
        alert(`Status changed to ${status}`);
        fetchReport();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to change status");
      }
    } catch (e) {
      alert("Error changing status");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-slate-400">Loading...</div>;
  if (!report)
    return <div className="p-8 text-slate-400">Report not found.</div>;

  const isReadOnly =
    report.status === "APPROVED" || report.status === "SUBMITTED";

  const getStatusPill = (status: string) => {
    switch (status) {
      case "PASS":
        return "bg-emerald-500/10 text-emerald-400";
      case "FAIL":
        return "bg-rose-500/10 text-rose-400";
      default:
        return "bg-slate-700/30 text-slate-300";
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <Link
              href="/fai"
              className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block"
            >
              ← Back to List
            </Link>
            <h1 className="text-3xl font-bold text-white">
              {report.faiNumber}
            </h1>
            <p className="text-slate-400 mt-1">
              Work Order: {report.workOrder?.woNumber} | Product:{" "}
              {report.product?.sku}
              {report.serialUnit
                ? ` | Serial: ${report.serialUnit.serialNo}`
                : ""}
            </p>
          </div>
          <div className="flex gap-2">
            {report.status === "IN_PROGRESS" && (
              <>
                <button
                  onClick={() => handleChangeStatus("SUBMITTED")}
                  disabled={saving}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg shadow-lg shadow-blue-500/25 hover:from-blue-400 hover:to-blue-500 transition disabled:opacity-50"
                >
                  Submit FAI
                </button>
              </>
            )}
            {report.status === "SUBMITTED" && (
              <>
                <button
                  onClick={() => handleChangeStatus("APPROVED")}
                  disabled={saving}
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-emerald-500 transition disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleChangeStatus("REJECTED")}
                  disabled={saving}
                  className="bg-gradient-to-r from-rose-500 to-rose-600 text-white px-4 py-2 rounded-lg shadow-lg shadow-rose-500/25 hover:from-rose-400 hover:to-rose-500 transition disabled:opacity-50"
                >
                  Reject
                </button>
              </>
            )}
            <Link
              href={`/reports/fai/${report.id}`}
              target="_blank"
              className="bg-slate-800/60 text-slate-300 px-4 py-2 rounded-lg border border-white/10 hover:bg-slate-700 transition"
            >
              Print
            </Link>
          </div>
        </div>

        <div className="bg-slate-800/60 rounded-2xl border border-white/10 p-6 mb-6 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-400 uppercase">Status</p>
              <p className="font-semibold text-lg text-white">
                {report.status}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase">Type</p>
              <p className="font-semibold text-white">{report.type}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase">Prepared By</p>
              <p className="font-semibold text-white">{report.preparedBy}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase">Approved By</p>
              <p className="font-semibold text-white">
                {report.approvedBy || "-"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/60 rounded-2xl border border-white/10 overflow-hidden backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-800/40">
            <h2 className="text-lg font-semibold text-white">
              Characteristics
            </h2>
            {!isReadOnly && (
              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  disabled={saving}
                  className="text-sm bg-slate-800/60 text-slate-300 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-slate-700 transition"
                >
                  Import from QC
                </button>
                <button
                  onClick={handleSaveChars}
                  disabled={saving}
                  className="text-sm bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-3 py-1.5 rounded-lg shadow-lg shadow-indigo-500/25 hover:from-indigo-400 hover:to-indigo-500 transition disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            )}
          </div>

          {chars.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No characteristics found. Use "Import from QC" to pull product
              parameters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-slate-800/40">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">
                      Char No
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">
                      Description
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">
                      Target
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">
                      LSL
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">
                      USL
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">
                      Actual
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {chars.map((char, index) => {
                    return (
                      <tr key={char.id} className="hover:bg-slate-700/40">
                        <td className="px-4 py-2 text-sm text-white">
                          {char.charNo}
                        </td>
                        <td
                          className="px-4 py-2 text-sm text-slate-300 max-w-xs truncate"
                          title={char.description}
                        >
                          {char.description}
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-300">
                          {char.target || "-"}
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-300">
                          {char.lsl || "-"}
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-300">
                          {char.usl || "-"}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {isReadOnly ? (
                            <span className="text-white">
                              {char.actual || "-"}
                            </span>
                          ) : (
                            <input
                              type="number"
                              step="any"
                              value={char.actual || ""}
                              onChange={(e) => {
                                const newChars = [...chars];
                                newChars[index].actual =
                                  e.target.value === ""
                                    ? null
                                    : parseFloat(e.target.value);
                                setChars(newChars);
                              }}
                              className="border border-slate-600 bg-slate-900/60 text-white rounded px-2 py-1 w-24 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                            />
                          )}
                        </td>
                        <td className={`px-4 py-2 text-sm font-semibold`}>
                          <span
                            className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusPill(char.status)}`}
                          >
                            {char.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
