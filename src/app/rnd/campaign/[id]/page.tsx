"use client";


import { logClientError } from "@/lib/clientLogger";
import { useEffect, useState, useCallback, use } from "react";
import {
  ArrowLeft,
  FileText,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function CampaignDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = use(params);
  const router = useRouter();
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // New Record State
  const [showNewRecord, setShowNewRecord] = useState(false);
  const [newParamName, setNewParamName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newMin, setNewMin] = useState("");
  const [newMax, setNewMax] = useState("");
  const [savingRecord, setSavingRecord] = useState(false);

  // Status Change State
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchCampaign = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/rnd/campaign/${unwrappedParams.id}`);
      if (!res.ok) throw new Error("Failed to fetch campaign");
      const data = await res.json();
      setCampaign(data.campaign);
    } catch (err) {
      logClientError(err, "page");
    } finally {
      setLoading(false);
    }
  }, [unwrappedParams.id]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  const handleUpdateRecord = async (recordId: string, actual: string) => {
    try {
      const res = await fetch(`/api/rnd/records/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actual }),
      });
      if (!res.ok) throw new Error("Failed to update record");

      // Update local state to avoid full refetch
      const data = await res.json();
      setCampaign((prev: any) => ({
        ...prev,
        records: prev.records.map((r: any) =>
          r.id === recordId ? data.record : r,
        ),
      }));
    } catch (err) {
      alert("Error updating record actual value");
    }
  };

  const handleCreateRecord = async () => {
    if (!newParamName) return;
    try {
      setSavingRecord(true);
      const res = await fetch(
        `/api/rnd/campaign/${unwrappedParams.id}/records`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parameterName: newParamName,
            unit: newUnit,
            target: newTarget,
            min: newMin,
            max: newMax,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to create record");

      setShowNewRecord(false);
      setNewParamName("");
      setNewUnit("");
      setNewTarget("");
      setNewMin("");
      setNewMax("");
      fetchCampaign();
    } catch (err) {
      alert("Error creating record");
    } finally {
      setSavingRecord(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      setUpdatingStatus(true);
      const res = await fetch(`/api/rnd/campaign/${unwrappedParams.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update campaign status");
      const data = await res.json();
      setCampaign((prev: any) => ({ ...prev, status: data.campaign.status }));
    } catch (err) {
      alert("Error updating status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-purple-400 gap-4">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="animate-pulse">Loading Test Campaign...</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <p>Campaign not found.</p>
        <button
          onClick={() => router.back()}
          className="text-purple-400 mt-4 hover:underline"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* ── HEADER ── */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/rnd/${campaign.workOrder?.projectId}`}
              className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-purple-900/50 border border-purple-700/50 text-purple-300 font-mono text-[10px] font-bold rounded">
                  {campaign.campaignNumber}
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {campaign.workOrder?.project?.name} - Iteration{" "}
                  {campaign.workOrder?.iteration}
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-500" />
                {campaign.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-bold uppercase">
              Status:
            </span>
            <select
              value={campaign.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={updatingStatus}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border focus:outline-none appearance-none ${
                campaign.status === "COMPLETE"
                  ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                  : campaign.status === "RUNNING"
                    ? "bg-cyan-950 text-cyan-400 border-cyan-800"
                    : "bg-slate-800 text-slate-300 border-slate-700"
              }`}
            >
              <option value="PLANNED">PLANNED</option>
              <option value="RUNNING">RUNNING</option>
              <option value="COMPLETE">COMPLETE</option>
            </select>
          </div>
        </div>

        {/* ── TEST RECORDS LIST ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-4">
            <h2 className="text-lg font-bold text-slate-200">
              Test Parameters & Results
            </h2>
            <button
              onClick={() => setShowNewRecord(!showNewRecord)}
              className="px-3 py-1.5 bg-purple-900/40 hover:bg-purple-900/60 text-purple-300 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors border border-purple-800/50"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Parameter
            </button>
          </div>

          {showNewRecord && (
            <div className="bg-slate-950/50 border border-purple-900/30 rounded-2xl p-4 space-y-4 mb-6">
              <h3 className="text-sm font-bold text-purple-400">
                Define New Test Parameter
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Parameter
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tensile Strength"
                    value={newParamName}
                    onChange={(e) => setNewParamName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MPa"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Target
                  </label>
                  <input
                    type="number"
                    placeholder="Optional"
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Min
                  </label>
                  <input
                    type="number"
                    placeholder="Optional"
                    value={newMin}
                    onChange={(e) => setNewMin(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Max
                  </label>
                  <input
                    type="number"
                    placeholder="Optional"
                    value={newMax}
                    onChange={(e) => setNewMax(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowNewRecord(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRecord}
                  disabled={savingRecord || !newParamName}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 flex items-center gap-1"
                >
                  {savingRecord ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save Parameter
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-separate border-spacing-y-2">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-2 font-bold">Parameter</th>
                  <th className="px-4 py-2 font-bold">Criteria</th>
                  <th className="px-4 py-2 font-bold">Actual</th>
                  <th className="px-4 py-2 font-bold">Result</th>
                </tr>
              </thead>
              <tbody>
                {campaign.records?.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-slate-500 italic"
                    >
                      No parameters defined yet.
                    </td>
                  </tr>
                ) : (
                  campaign.records?.map((record: any) => (
                    <tr key={record.id} className="bg-slate-950/50">
                      <td className="px-4 py-3 rounded-l-xl border-y border-l border-slate-800">
                        <span className="font-bold text-white">
                          {record.parameterName}
                        </span>
                        {record.unit && (
                          <span className="ml-1 text-slate-500 text-xs">
                            ({record.unit})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 border-y border-slate-800">
                        <div className="flex flex-col text-xs font-mono text-slate-400">
                          {record.min !== null && record.max !== null ? (
                            <span>
                              {record.min} - {record.max}
                            </span>
                          ) : record.target !== null ? (
                            <span>Target: {record.target}</span>
                          ) : (
                            <span className="italic text-slate-600">
                              Info only
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 border-y border-slate-800">
                        <input
                          type="number"
                          defaultValue={record.actual ?? ""}
                          onBlur={(e) => {
                            if (
                              e.target.value !== String(record.actual ?? "")
                            ) {
                              handleUpdateRecord(record.id, e.target.value);
                            }
                          }}
                          className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-sm focus:outline-none focus:border-purple-500"
                          placeholder="---"
                        />
                      </td>
                      <td className="px-4 py-3 rounded-r-xl border-y border-r border-slate-800">
                        <div className="flex items-center gap-2">
                          {record.result === "PASS" && (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          )}
                          {record.result === "FAIL" && (
                            <XCircle className="w-5 h-5 text-rose-500" />
                          )}
                          {record.result === "PENDING" && (
                            <HelpCircle className="w-5 h-5 text-amber-500" />
                          )}
                          <span
                            className={`text-xs font-bold ${
                              record.result === "PASS"
                                ? "text-emerald-400"
                                : record.result === "FAIL"
                                  ? "text-rose-400"
                                  : "text-amber-400"
                            }`}
                          >
                            {record.result}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
