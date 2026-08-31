"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import { CheckCircle2, Clock, Wrench, RefreshCw, Sliders } from "lucide-react";

interface ReworkOrder {
  id: string;
  quarantineId: string;
  targetMachineId: string;
  routingSteps: string;
  extraLaborHours: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  createdAt: string;
  targetMachine?: {
    name: string;
    code: string;
    stationName?: string;
  };
  quarantine?: {
    quantity: number;
    defectCode: string;
    dispositionNotes?: string;
    costEstimate?: number;
    workOrder?: {
      woNumber: string;
      product?: {
        name: string;
        sku: string;
      };
    };
  };
}

export default function ReworkOrdersPage() {
  const [reworkOrders, setReworkOrders] = useState<ReworkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const fetchReworkOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/scrap/disposition");
      const data = await res.json();
      setReworkOrders(data.reworkOrders || []);
    } catch (e) {
      logClientError(e, "page");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReworkOrders();
  }, []);

  const filtered = reworkOrders.filter((ro) =>
    filterStatus === "ALL" ? true : ro.status === filterStatus,
  );

  const pendingCount = reworkOrders.filter(
    (ro) => ro.status === "PENDING",
  ).length;
  const inProgressCount = reworkOrders.filter(
    (ro) => ro.status === "IN_PROGRESS",
  ).length;
  const completedCount = reworkOrders.filter(
    (ro) => ro.status === "COMPLETED",
  ).length;
  const totalReworkHours = reworkOrders.reduce(
    (sum, ro) => sum + ro.extraLaborHours,
    0,
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <Wrench className="w-8 h-8 text-purple-400" />
              Shopfloor Rework Dispatch Board
            </h1>
            <p className="text-xs text-slate-400">
              Child rework job routing, target machine assignment, and labor
              hours tracking.
            </p>
          </div>
          <button
            onClick={fetchReworkOrders}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 border border-slate-700 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Rework Board
          </button>
        </div>

        {/* METRICS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-extrabold">
                Pending Rework
              </span>
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl font-black font-mono text-amber-400">
              {pendingCount} jobs
            </div>
            <p className="text-[11px] text-slate-400">
              Awaiting machine allocation
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-extrabold">
                In-Progress Rework
              </span>
              <Wrench className="w-5 h-5 text-purple-400 animate-spin-slow" />
            </div>
            <div className="text-3xl font-black font-mono text-purple-400">
              {inProgressCount} jobs
            </div>
            <p className="text-[11px] text-slate-400">
              Active on shopfloor lines
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-extrabold">
                Completed Rework
              </span>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-3xl font-black font-mono text-emerald-400">
              {completedCount} jobs
            </div>
            <p className="text-[11px] text-slate-400">Re-inspected & cleared</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-extrabold">
                Est. Labor Impact
              </span>
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-3xl font-black font-mono text-blue-400">
              {totalReworkHours.toFixed(1)} hrs
            </div>
            <p className="text-[11px] text-slate-400">
              Total extra labor consumed
            </p>
          </div>
        </div>

        {/* BOARD CARDS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-purple-400" />
              Active Child Rework Orders ({filtered.length})
            </h2>

            <div className="flex flex-wrap gap-2">
              {["ALL", "PENDING", "IN_PROGRESS", "COMPLETED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                    filterStatus === st
                      ? "bg-purple-600 text-white shadow-lg"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {st.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 font-mono text-xs animate-pulse">
              Loading Rework Dispatch Board...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-500 italic text-xs">
              No rework orders matching status `{filterStatus}`.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((ro) => {
                const isPending = ro.status === "PENDING";
                const isInProgress = ro.status === "IN_PROGRESS";

                const badgeClass = isPending
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : isInProgress
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40 animate-pulse"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";

                return (
                  <div
                    key={ro.id}
                    className="p-5 bg-slate-950 rounded-2xl border border-slate-800 space-y-3 shadow-md"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-mono block">
                          WO Reference
                        </span>
                        <strong className="text-white text-base">
                          {ro.quarantine?.workOrder?.woNumber || "Rework Job"}
                        </strong>
                      </div>
                      <span
                        className={`px-3 py-1 text-[11px] font-black uppercase rounded border ${badgeClass}`}
                      >
                        {ro.status.replace("_", " ")}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 block uppercase font-sans">
                          Target Machine
                        </span>
                        <strong className="text-purple-300 text-xs">
                          {ro.targetMachine?.name || "Machine"} (
                          {ro.targetMachine?.code})
                        </strong>
                      </div>

                      <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 block uppercase font-sans">
                          Rework Qty & Defect
                        </span>
                        <strong className="text-amber-300 text-xs">
                          {ro.quarantine?.quantity} pcs (
                          {ro.quarantine?.defectCode})
                        </strong>
                      </div>
                    </div>

                    <div className="space-y-1 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 text-xs">
                      <span className="text-[11px] font-bold text-slate-300 uppercase block font-sans">
                        Custom Rework Routing Steps:
                      </span>
                      <p className="text-purple-300 font-mono text-[11px]">
                        {ro.routingSteps}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono pt-1">
                      <span>
                        Extra Labor: <strong>{ro.extraLaborHours} hrs</strong>
                      </span>
                      <span>
                        Created: {new Date(ro.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
