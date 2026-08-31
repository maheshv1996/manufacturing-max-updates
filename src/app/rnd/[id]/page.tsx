"use client";


import { logClientError } from "@/lib/clientLogger";
import { useEffect, useState, useCallback, use } from "react";
import {
  ArrowLeft,
  Beaker,
  Loader2,
  FileText,
  Activity,
  Copy,
  Printer,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RndProjectDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = use(params);
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState(false);

  // New Campaign Modal State
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [activeIterationId, setActiveIterationId] = useState<string | null>(
    null,
  );
  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignCost, setCampaignCost] = useState("");
  const [savingCampaign, setSavingCampaign] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/rnd/${unwrappedParams.id}`);
      if (!res.ok) throw new Error("Failed to fetch project");
      const data = await res.json();
      setProject(data.project);
    } catch (err) {
      logClientError(err, "page");
    } finally {
      setLoading(false);
    }
  }, [unwrappedParams.id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleCloneIteration = async (sourceWorkOrderId: string) => {
    if (!confirm("Clone this iteration into a new one?")) return;
    try {
      setCloning(true);
      const res = await fetch(`/api/rnd/${project.id}/iterations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceWorkOrderId }),
      });
      if (!res.ok) throw new Error("Failed to clone iteration");
      fetchProject();
    } catch (err) {
      alert("Error cloning iteration");
    } finally {
      setCloning(false);
    }
  };

  const handleCreateCampaign = async () => {
    if (!activeIterationId || !campaignTitle) return;
    try {
      setSavingCampaign(true);
      const res = await fetch(`/api/rnd/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrderId: activeIterationId,
          title: campaignTitle,
          testCostRupees: parseFloat(campaignCost) || 0,
        }),
      });
      if (!res.ok) throw new Error("Failed to create test campaign");

      setShowCampaignModal(false);
      setCampaignTitle("");
      setCampaignCost("");
      fetchProject();
    } catch (err) {
      alert("Error creating campaign");
    } finally {
      setSavingCampaign(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-purple-400 gap-4">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="animate-pulse">Loading R&D Project Data...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <p>Project not found.</p>
        <Link href="/rnd" className="text-purple-400 mt-4 hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* ── HEADER ── */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/rnd")}
              className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-slate-800/80 border border-slate-700/50 text-slate-300 font-mono text-[10px] font-bold rounded">
                  {project.clientName}
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  #{project.code}
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                <Beaker className="w-5 h-5 text-purple-500" />
                {project.name}
              </h1>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white font-bold text-sm rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>

        {/* ── ITERATIONS (WORK ORDERS) ── */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-slate-300 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            Prototype Iterations
          </h2>

          {project.workOrders?.length === 0 ? (
            <div className="p-8 border border-dashed border-slate-800 rounded-2xl text-center text-slate-500 bg-slate-900/30">
              No iterations recorded. Create a new iteration to start testing.
            </div>
          ) : (
            <div className="space-y-6">
              {project.workOrders.map((wo: any) => (
                <div
                  key={wo.id}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl"
                >
                  {/* Iteration Header */}
                  <div className="flex items-start justify-between border-b border-slate-800/60 pb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        Iteration {wo.iteration}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-400 font-mono">
                          {wo.woNumber}
                        </span>
                      </h3>
                      <p className="text-sm text-slate-400 mt-1">
                        Product: {wo.product?.name || "Unknown"} (Qty:{" "}
                        {wo.plannedQuantity})
                      </p>
                    </div>
                    <button
                      onClick={() => handleCloneIteration(wo.id)}
                      disabled={cloning}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Clone to Next
                    </button>
                  </div>

                  {/* Test Campaigns in this iteration */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-400 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-purple-400" />
                        Test Campaigns
                      </h4>
                      <button
                        onClick={() => {
                          setActiveIterationId(wo.id);
                          setShowCampaignModal(true);
                        }}
                        className="px-2 py-1 text-xs font-bold text-purple-400 hover:text-purple-300 bg-purple-900/20 hover:bg-purple-900/40 rounded-md transition-colors"
                      >
                        + New Campaign
                      </button>
                    </div>

                    {wo.testCampaigns?.length === 0 ? (
                      <p className="text-xs text-slate-500 italic bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
                        No test campaigns run for this iteration.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {wo.testCampaigns.map((tc: any) => {
                          const records = tc.records || [];
                          const passed = records.filter(
                            (r: any) => r.result === "PASS",
                          ).length;
                          const failed = records.filter(
                            (r: any) => r.result === "FAIL",
                          ).length;
                          const pending = records.length - passed - failed;

                          return (
                            <div
                              key={tc.id}
                              className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className="text-[10px] font-mono text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                                    {tc.campaignNumber}
                                  </span>
                                  <h5 className="font-bold text-slate-200 mt-1">
                                    {tc.title}
                                  </h5>
                                </div>
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                                    tc.status === "COMPLETE"
                                      ? "bg-emerald-950/50 text-emerald-400 border-emerald-800/50"
                                      : tc.status === "RUNNING"
                                        ? "bg-cyan-950/50 text-cyan-400 border-cyan-800/50"
                                        : "bg-slate-800 text-slate-400 border-slate-700"
                                  }`}
                                >
                                  {tc.status}
                                </span>
                              </div>

                              {/* Progress / Status Bar */}
                              {records.length > 0 && (
                                <div className="space-y-1.5">
                                  <div className="flex h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                                    <div
                                      style={{
                                        width: `${(passed / records.length) * 100}%`,
                                      }}
                                      className="bg-emerald-500"
                                    />
                                    <div
                                      style={{
                                        width: `${(failed / records.length) * 100}%`,
                                      }}
                                      className="bg-rose-500"
                                    />
                                    <div
                                      style={{
                                        width: `${(pending / records.length) * 100}%`,
                                      }}
                                      className="bg-amber-500"
                                    />
                                  </div>
                                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                                    <span className="text-emerald-400">
                                      {passed} PASS
                                    </span>
                                    <span className="text-rose-400">
                                      {failed} FAIL
                                    </span>
                                    <span className="text-amber-400">
                                      {pending} PEND
                                    </span>
                                  </div>
                                </div>
                              )}

                              <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs mt-auto">
                                <span className="text-slate-500 font-mono">
                                  Cost: ₹
                                  {(tc.testCostRupees || 0).toLocaleString()}
                                </span>
                                <Link
                                  href={`/rnd/campaign/${tc.id}`}
                                  className="text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 transition-colors"
                                >
                                  View Records{" "}
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── NEW CAMPAIGN MODAL ── */}
      {showCampaignModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-6">
            <h2 className="text-xl font-bold text-white">New Test Campaign</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Campaign Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. High Temp Stress Test"
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Estimated Cost (₹)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={campaignCost}
                  onChange={(e) => setCampaignCost(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                onClick={() => setShowCampaignModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl"
                disabled={savingCampaign}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCampaign}
                disabled={savingCampaign || !campaignTitle}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm rounded-xl flex items-center gap-2 disabled:opacity-50"
              >
                {savingCampaign ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Create"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
