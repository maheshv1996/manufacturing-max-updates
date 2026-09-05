"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  AlertOctagon,
  DollarSign,
  Package,
  RefreshCw,
  ShieldAlert,
  Sliders,
  Trash2,
  Truck,
  Wrench,
  X,
} from "lucide-react";

interface ScrapQuarantineItem {
  id: string;
  workOrderId: string;
  quantity: number;
  defectCode: string;
  loggedBy: string;
  status: "PENDING" | "SCRAPPED" | "REWORK" | "VENDOR_RETURN";
  dispositionNotes?: string;
  costEstimate?: number;
  createdAt: string;
  workOrder?: {
    woNumber: string;
    product?: {
      id: string;
      sku: string;
      name: string;
    };
  };
  reworkOrders?: any[];
}

export default function ScrapMRBPageClient() {
  const [items, setItems] = useState<ScrapQuarantineItem[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // Disposition Modal State
  const [selectedItem, setSelectedItem] = useState<ScrapQuarantineItem | null>(
    null,
  );
  const [dispositionStatus, setDispositionStatus] =
    useState<string>("SCRAPPED");
  const [costEstimateInput, setCostEstimateInput] = useState<string>("");
  const [notesInput, setNotesInput] = useState<string>("");
  const [targetMachineId, setTargetMachineId] = useState<string>("");
  const [routingStepsInput, setRoutingStepsInput] = useState<string>(
    "Surface Regrinding -> QC Inspection Pass",
  );
  const [extraHoursInput, setExtraHoursInput] = useState<string>("1.5");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [res, macRes] = await Promise.all([
        fetch("/api/scrap/quarantine"),
        fetch("/api/machines"),
      ]);
      const data = await res.json();
      const macData = await macRes.json();

      setItems(data.items || []);
      const macList = macData.machines || macData || [];
      setMachines(macList);
      if (macList.length > 0 && !targetMachineId) {
        setTargetMachineId(macList[0].id);
      }
    } catch (e) {
      logClientError(e, "page");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedItem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedItem(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedItem]);

  const handleOpenModal = (item: ScrapQuarantineItem) => {
    setSelectedItem(item);
    setDispositionStatus(item.status === "PENDING" ? "SCRAPPED" : item.status);
    setCostEstimateInput(
      item.costEstimate
        ? String(item.costEstimate)
        : String(item.quantity * 15),
    );
    setNotesInput(item.dispositionNotes || "");
  };

  const handleSaveDisposition = async () => {
    if (!selectedItem) return;
    try {
      setSubmitting(true);
      const res = await fetch("/api/scrap/disposition", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quarantineId: selectedItem.id,
          status: dispositionStatus,
          costEstimate: parseFloat(costEstimateInput) || 0,
          dispositionNotes: notesInput.trim(),
          targetMachineId:
            dispositionStatus === "REWORK" ? targetMachineId : undefined,
          routingSteps:
            dispositionStatus === "REWORK"
              ? routingStepsInput.trim()
              : undefined,
          extraLaborHours:
            dispositionStatus === "REWORK"
              ? parseFloat(extraHoursInput) || 1.0
              : undefined,
        }),
      });

      if (res.ok) {
        alert("MRB Disposition saved successfully!");
        setSelectedItem(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to process disposition");
      }
    } catch (e) {
      alert("Error processing disposition");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRaiseNcr = async (item: ScrapQuarantineItem) => {
    if (
      !confirm(
        `Raise NCR for Work Order ${item.workOrder?.woNumber || item.workOrderId}?`,
      )
    )
      return;
    try {
      const res = await fetch("/api/mrb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quarantineId: item.id,
          workOrderId: item.workOrderId,
          productId: item.workOrder?.product?.id,
          quantity: item.quantity,
          defectCodeId: item.defectCode,
          description: `Raised from Scrap Quarantine (${item.defectCode})`,
        }),
      });
      if (res.ok) {
        alert("NCR Raised successfully! See MRB Kanban for details.");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to raise NCR");
      }
    } catch (e) {
      alert("Error raising NCR");
    }
  };

  // Metrics
  const totalQuarantined = items.reduce((sum, i) => sum + i.quantity, 0);
  const pendingCount = items.filter((i) => i.status === "PENDING").length;
  const totalCOPQ = items.reduce((sum, i) => sum + (i.costEstimate || 0), 0);
  const reworkCount = items.filter((i) => i.status === "REWORK").length;

  const filteredItems = items.filter((i) =>
    filterStatus === "ALL" ? true : i.status === filterStatus,
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-rose-500" />
              Material Review Board (MRB) — Scrap Quarantine
            </h1>
            <p className="text-xs text-slate-400">
              Quarantine queue, COPQ financial loss tracking, and disposition
              workflow (Scrap, Rework, Vendor Return).
            </p>
          </div>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 border border-slate-700 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Queue
          </button>
        </div>

        {/* METRICS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-extrabold">
                Quarantined Parts
              </span>
              <Package className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl font-black font-mono text-white">
              {totalQuarantined.toLocaleString()} pcs
            </div>
            <p className="text-[11px] text-slate-400">
              {items.length} logged quarantine lots
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-extrabold">
                Pending Review
              </span>
              <AlertOctagon className="w-5 h-5 text-rose-400 animate-pulse" />
            </div>
            <div className="text-3xl font-black font-mono text-rose-400">
              {pendingCount} lots
            </div>
            <p className="text-[11px] text-slate-400">
              Awaiting Quality MRB Disposition
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-extrabold">
                Cost of Poor Quality (COPQ)
              </span>
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-3xl font-black font-mono text-emerald-400">
              $
              {totalCOPQ.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-[11px] text-slate-400">
              Total estimated material loss
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-extrabold">
                Active Rework Orders
              </span>
              <Wrench className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-3xl font-black font-mono text-purple-400">
              {reworkCount} lots
            </div>
            <p className="text-[11px] text-slate-400">
              Dispositioned for shopfloor rework
            </p>
          </div>
        </div>

        {/* QUEUE TABLE & FILTERS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-400" />
              Scrap Quarantine Queue ({filteredItems.length})
            </h2>

            {/* FILTER BUTTONS */}
            <div className="flex flex-wrap gap-2">
              {["ALL", "PENDING", "SCRAPPED", "REWORK", "VENDOR_RETURN"].map(
                (st) => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                      filterStatus === st
                        ? "bg-blue-600 text-white shadow-lg"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {st.replace("_", " ")}
                  </button>
                ),
              )}
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 font-mono text-xs animate-pulse">
              Loading MRB Quarantine Queue...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 italic text-xs">
              No quarantine items found matching filter `{filterStatus}`.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-extrabold">
                  <tr>
                    <th className="py-3 px-4 rounded-l-lg">Date Logged</th>
                    <th className="py-3 px-4">Work Order & Product</th>
                    <th className="py-3 px-4">Defect Code</th>
                    <th className="py-3 px-4 text-center">Quarantined Qty</th>
                    <th className="py-3 px-4">Est. COPQ ($)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Logged By</th>
                    <th className="py-3 px-4 rounded-r-lg text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {filteredItems.map((item) => {
                    const isPending = item.status === "PENDING";
                    const isScrapped = item.status === "SCRAPPED";
                    const isRework = item.status === "REWORK";

                    const badgeClass = isPending
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                      : isScrapped
                        ? "bg-slate-800 text-slate-300 border-slate-700"
                        : isRework
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                          : "bg-amber-500/20 text-amber-300 border-amber-500/40";

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-4 px-4 text-slate-400">
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                        <td className="py-4 px-4">
                          <strong className="text-white text-sm block">
                            {item.workOrder?.woNumber || item.workOrderId}
                          </strong>
                          <span className="text-[11px] text-slate-400">
                            {item.workOrder?.product?.name || "Product"} (
                            {item.workOrder?.product?.sku || "SKU"})
                          </span>
                        </td>
                        <td className="py-4 px-4 font-bold text-rose-400">
                          {item.defectCode}
                        </td>
                        <td className="py-4 px-4 text-center text-sm font-black text-white">
                          {item.quantity} pcs
                        </td>
                        <td className="py-4 px-4 text-emerald-400 font-bold">
                          ${(item.costEstimate || 0).toFixed(2)}
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2.5 py-1 text-[11px] font-black uppercase rounded border ${badgeClass}`}
                          >
                            {item.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-slate-300 font-sans">
                          {item.loggedBy}
                        </td>
                        <td className="py-4 px-4 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleRaiseNcr(item)}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-sans font-bold text-xs rounded-lg shadow-md cursor-pointer transition-all"
                          >
                            Raise NCR
                          </button>
                          <button
                            onClick={() => handleOpenModal(item)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-sans font-bold text-xs rounded-lg shadow-md cursor-pointer transition-all"
                          >
                            {isPending
                              ? "Process Disposition"
                              : "Edit Disposition"}
                          </button>
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

      {/* DISPOSITION MODAL */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={() => setSelectedItem(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mrb-review-title"
        >
          <div
            className="bg-slate-900 border-2 border-blue-500/50 rounded-3xl w-full max-w-xl p-6 space-y-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 id="mrb-review-title" className="text-lg font-black text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-blue-400" />
                  MRB Disposition Review — {selectedItem.workOrder?.woNumber}
                </h3>
                <p className="text-xs text-slate-400">
                  Quarantined Lot: {selectedItem.quantity} pcs (
                  {selectedItem.defectCode})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-white"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* DISPOSITION OPTION BUTTONS */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-300 mb-2">
                  Select Disposition *
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setDispositionStatus("SCRAPPED")}
                    className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      dispositionStatus === "SCRAPPED"
                        ? "bg-rose-600 border-rose-400 text-white shadow-lg"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    <Trash2 className="w-5 h-5" />
                    <span className="text-xs font-bold">SCRAP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDispositionStatus("REWORK")}
                    className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      dispositionStatus === "REWORK"
                        ? "bg-purple-600 border-purple-400 text-white shadow-lg"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    <Wrench className="w-5 h-5" />
                    <span className="text-xs font-bold">REWORK</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDispositionStatus("VENDOR_RETURN")}
                    className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      dispositionStatus === "VENDOR_RETURN"
                        ? "bg-amber-600 border-amber-400 text-white shadow-lg"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    <Truck className="w-5 h-5" />
                    <span className="text-xs font-bold">VENDOR RETURN</span>
                  </button>
                </div>
              </div>

              {/* FINANCIAL LOSS COPQ */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-300 mb-1">
                  Financial Loss / COPQ Estimate ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={costEstimateInput}
                  onChange={(e) => setCostEstimateInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-lg font-mono font-bold text-emerald-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* REWORK ROUTING FIELDS IF REWORK SELECTED */}
              {dispositionStatus === "REWORK" && (
                <div className="p-4 bg-purple-600/10 border border-purple-500/30 rounded-2xl space-y-3">
                  <h4 className="text-xs font-extrabold uppercase text-purple-300 flex items-center gap-2">
                    <Wrench className="w-4 h-4" />
                    Child Rework Order Generation Parameters
                  </h4>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1">
                      Target Rework Machine *
                    </label>
                    <select
                      value={targetMachineId}
                      onChange={(e) => setTargetMachineId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                    >
                      {machines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.code}) — {m.stationName || "Shopfloor"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1">
                      Custom Rework Routing Steps *
                    </label>
                    <input
                      type="text"
                      required
                      value={routingStepsInput}
                      onChange={(e) => setRoutingStepsInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1">
                      Est. Extra Labor Hours *
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      required
                      value={extraHoursInput}
                      onChange={(e) => setExtraHoursInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* DISPOSITION NOTES */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-300 mb-1">
                  Quality Disposition Notes & Root Cause *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Parts failed dimensional check due to worn insert. Approved for regrinding."
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDisposition}
                disabled={submitting}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg cursor-pointer"
              >
                {submitting ? "Saving..." : "Confirm MRB Disposition"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
