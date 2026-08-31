"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  ShoppingBag,
  Plus,
  Truck,
  Package,
  X,
  Loader2,
  FileText,
} from "lucide-react";
import SourceRecordEditModal from "@/app/components/modals/SourceRecordEditModal";

interface PurchasingTabProps {
  prefillMaterialId?: string | null;
  onClearPrefill?: () => void;
}

export default function PurchasingTab({
  prefillMaterialId,
  onClearPrefill,
}: PurchasingTabProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    purchaseOrders: any[];
    suppliers: any[];
    supplierScorecards: any[];
    rawMaterials: any[];
  }>({
    purchaseOrders: [],
    suppliers: [],
    supplierScorecards: [],
    rawMaterials: [],
  });

  // Modal States
  const [showNewPOModal, setShowNewPOModal] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [poQtyInput, setPoQtyInput] = useState("");
  const [poUnitCostInput, setPoUnitCostInput] = useState("");
  const [poExpectedDateInput, setPoExpectedDateInput] = useState("");
  const [submittingPO, setSubmittingPO] = useState(false);

  // Receive Modal States
  const [receiveTargetPO, setReceiveTargetPO] = useState<any | null>(null);
  const [receiveQtyInput, setReceiveQtyInput] = useState("");
  const [batchNoInput, setBatchNoInput] = useState("");
  const [submittingReceive, setSubmittingReceive] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/purchasing");
      const resData = await res.json();
      if (res.ok) {
        setData(resData);
      }
    } catch (e) {
      logClientError("Error fetching purchasing data:", e, "PurchasingTab");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle prefilled material from Low Stock Alert ("Reorder Now!")
  useEffect(() => {
    if (prefillMaterialId && data.rawMaterials.length > 0) {
      const mat = data.rawMaterials.find(
        (m: any) => m.id === prefillMaterialId,
      );
      if (mat) {
        setSelectedMaterialId(mat.id);
        if (mat.supplierId) {
          setSelectedSupplierId(mat.supplierId);
        }
        setPoQtyInput(String(mat.minStock * 2 || 100));
        setPoUnitCostInput(String(mat.unitCost || 0));

        // Default expected date = today + (supplier default lead days or 7)
        const leadDays = mat.supplier?.defaultLeadDays || 7;
        const exp = new Date();
        exp.setDate(exp.getDate() + leadDays);
        setPoExpectedDateInput(exp.toISOString().split("T")[0]);

        setShowNewPOModal(true);
      }
    }
  }, [prefillMaterialId, data.rawMaterials]);

  const handleMaterialChange = (matId: string) => {
    setSelectedMaterialId(matId);
    const mat = data.rawMaterials.find((m: any) => m.id === matId);
    if (mat) {
      if (mat.supplierId) {
        setSelectedSupplierId(mat.supplierId);
      }
      setPoUnitCostInput(String(mat.unitCost || 0));
      if (!poQtyInput) {
        setPoQtyInput(String(mat.minStock * 2 || 100));
      }
      const leadDays = mat.supplier?.defaultLeadDays || 7;
      const exp = new Date();
      exp.setDate(exp.getDate() + leadDays);
      setPoExpectedDateInput(exp.toISOString().split("T")[0]);
    }
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !selectedSupplierId ||
      !selectedMaterialId ||
      !poQtyInput ||
      !poUnitCostInput
    ) {
      alert("Please fill in all required fields.");
      return;
    }

    try {
      setSubmittingPO(true);
      const res = await fetch("/api/purchasing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_PO",
          supplierId: selectedSupplierId,
          rawMaterialId: selectedMaterialId,
          qty: poQtyInput,
          unitCost: poUnitCostInput,
          expectedDate: poExpectedDateInput,
        }),
      });

      if (res.ok) {
        setShowNewPOModal(false);
        if (onClearPrefill) onClearPrefill();
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create Purchase Order");
      }
    } catch (err) {
      logClientError(err, "PurchasingTab");
      alert("Error creating PO");
    } finally {
      setSubmittingPO(false);
    }
  };

  const handleOpenReceiveModal = (po: any) => {
    setReceiveTargetPO(po);
    const remaining = po.qty - po.receivedQty;
    setReceiveQtyInput(String(remaining > 0 ? remaining : 0));
    setBatchNoInput(`BATCH-${po.poNumber}-${Date.now().toString().slice(-4)}`);
  };

  const handleConfirmReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveTargetPO || !receiveQtyInput) return;

    try {
      setSubmittingReceive(true);
      const res = await fetch("/api/purchasing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RECEIVE_PO",
          poId: receiveTargetPO.id,
          receiveQty: receiveQtyInput,
          batchNo: batchNoInput,
        }),
      });

      if (res.ok) {
        setReceiveTargetPO(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to receive PO stock");
      }
    } catch (err) {
      logClientError(err, "PurchasingTab");
      alert("Error receiving PO");
    } finally {
      setSubmittingReceive(false);
    }
  };

  const handleCancelPO = async (poId: string, poNumber: string) => {
    if (!confirm(`Are you sure you want to cancel Purchase Order ${poNumber}?`))
      return;

    try {
      const res = await fetch("/api/purchasing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CANCEL_PO",
          poId,
        }),
      });

      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to cancel PO");
      }
    } catch (err) {
      logClientError(err, "PurchasingTab");
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span>Loading Purchasing & Supplier Scorecards...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. SUPPLIER SCORECARD SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">
                Supplier Scorecard
              </h2>
              <p className="text-xs text-slate-400">
                Track supplier reliability, on-time delivery %, avg lead times,
                and spend
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {data.supplierScorecards.map((sc: any) => {
            const s = sc.supplier;
            const onTimeColor =
              sc.onTimePct >= 90
                ? "text-emerald-400"
                : sc.onTimePct >= 75
                  ? "text-amber-400"
                  : "text-rose-400";
            return (
              <div
                key={s.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="font-extrabold text-lg text-white">
                      {s.name}
                    </h3>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      {s.email || s.contactPhone || "No contact info"}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg border border-slate-700">
                    Lead: {s.defaultLeadDays || 7}d
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
                      Total POs
                    </span>
                    <span className="text-lg font-black text-white">
                      {sc.totalPOs}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
                      On-Time %
                    </span>
                    <span className={`text-lg font-black ${onTimeColor}`}>
                      {sc.onTimePct}%
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
                      Avg Lead
                    </span>
                    <span className="text-lg font-black text-cyan-400">
                      {sc.avgLeadDays}d
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span>Total Spend:</span>
                  <span className="font-mono font-bold text-white text-sm">
                    ₹{sc.totalSpend.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. PURCHASE ORDERS TABLE */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">
                Purchase Orders Ledger
              </h2>
              <p className="text-xs text-slate-400">
                Manage procurement orders, track receipts, and update material
                inventory
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/reports/po-register"
              target="_blank"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              PO Register Report 🖨️
            </a>

            <button
              onClick={() => {
                if (onClearPrefill) onClearPrefill();
                setSelectedMaterialId("");
                setSelectedSupplierId("");
                setPoQtyInput("");
                setPoUnitCostInput("");
                setPoExpectedDateInput("");
                setShowNewPOModal(true);
              }}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Purchase Order
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/50 text-slate-300 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">PO Number</th>
                <th className="px-6 py-4">Supplier</th>
                <th className="px-6 py-4">Raw Material</th>
                <th className="px-6 py-4">Ordered Qty</th>
                <th className="px-6 py-4">Received Qty</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Expected Date</th>
                <th className="px-6 py-4">Total Value</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {data.purchaseOrders.map((po: any) => {
                const totalVal = po.qty * po.unitCost;
                const statusBadge =
                  po.status === "RECEIVED"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : po.status === "PARTIAL"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : po.status === "ORDERED"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20";

                return (
                  <tr
                    key={po.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-white">
                      {po.poNumber}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-200">
                      {po.supplier?.name || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">
                        {po.rawMaterial?.name}
                      </div>
                      <div className="text-xs font-mono text-slate-400">
                        {po.rawMaterial?.sku}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-200">
                      {po.qty} {po.rawMaterial?.unit}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-cyan-400">
                      {po.receivedQty} / {po.qty}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusBadge}`}
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300 font-mono text-xs">
                      {po.expectedDate
                        ? new Date(po.expectedDate).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-white">
                      ₹{totalVal.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                      {(po.status === "ORDERED" || po.status === "PARTIAL") && (
                        <>
                          <button
                            onClick={() => handleOpenReceiveModal(po)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow transition-colors cursor-pointer"
                          >
                            Receive
                          </button>
                          <button
                            onClick={() => handleCancelPO(po.id, po.poNumber)}
                            className="px-3 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      <SourceRecordEditModal
                        entityType="PurchaseOrder"
                        entityId={po.id}
                        title="Purchase Order"
                        fields={[
                          { key: "qty", label: "Ordered Qty", type: "number" },
                          {
                            key: "receivedQty",
                            label: "Received Qty",
                            type: "number",
                          },
                          {
                            key: "unitCost",
                            label: "Unit Cost (₹)",
                            type: "number",
                          },
                          {
                            key: "status",
                            label: "PO Status",
                            type: "select",
                            options: [
                              { label: "Ordered", value: "ORDERED" },
                              { label: "Partial", value: "PARTIAL" },
                              { label: "Received", value: "RECEIVED" },
                              { label: "Cancelled", value: "CANCELLED" },
                            ],
                          },
                          { key: "notes", label: "Notes", type: "text" },
                        ]}
                        initialValues={{
                          qty: po.qty,
                          receivedQty: po.receivedQty,
                          unitCost: po.unitCost,
                          status: po.status,
                          notes: po.notes,
                        }}
                        onSaved={fetchData}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. NEW PO MODAL */}
      {showNewPOModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Create Purchase Order
                  </h3>
                  <p className="text-xs text-slate-400">
                    Order materials from approved suppliers
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowNewPOModal(false);
                  if (onClearPrefill) onClearPrefill();
                }}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreatePO} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-300 mb-1">
                  Select Raw Material *
                </label>
                <select
                  value={selectedMaterialId}
                  onChange={(e) => handleMaterialChange(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Choose Material --</option>
                  {data.rawMaterials.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.sku}) • Stock: {m.currentStock} {m.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-300 mb-1">
                  Select Supplier *
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Choose Supplier --</option>
                  {data.suppliers.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Lead Time: {s.defaultLeadDays || 7}d)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase text-slate-300 mb-1">
                    Order Quantity *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={poQtyInput}
                    onChange={(e) => setPoQtyInput(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase text-slate-300 mb-1">
                    Unit Cost (₹) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={poUnitCostInput}
                    onChange={(e) => setPoUnitCostInput(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-300 mb-1">
                  Expected Delivery Date
                </label>
                <input
                  type="date"
                  value={poExpectedDateInput}
                  onChange={(e) => setPoExpectedDateInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewPOModal(false);
                    if (onClearPrefill) onClearPrefill();
                  }}
                  className="w-1/2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPO}
                  className="w-1/2 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submittingPO ? "Creating PO..." : "Issue Purchase Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. RECEIVE STOCK MODAL */}
      {receiveTargetPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Receive Goods ({receiveTargetPO.poNumber})
                  </h3>
                  <p className="text-xs text-slate-400">
                    {receiveTargetPO.rawMaterial?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReceiveTargetPO(null)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleConfirmReceive} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-300 mb-1">
                  Quantity Received Now *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  max={receiveTargetPO.qty - receiveTargetPO.receivedQty}
                  value={receiveQtyInput}
                  onChange={(e) => setReceiveQtyInput(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Remaining expected:{" "}
                  {receiveTargetPO.qty - receiveTargetPO.receivedQty}{" "}
                  {receiveTargetPO.rawMaterial?.unit}
                </p>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-300 mb-1">
                  Batch / Lot / Supplier Reference # *
                </label>
                <input
                  type="text"
                  value={batchNoInput}
                  onChange={(e) => setBatchNoInput(e.target.value)}
                  required
                  placeholder="e.g. BATCH-2026-08A"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setReceiveTargetPO(null)}
                  className="w-1/2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReceive}
                  className="w-1/2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submittingReceive
                    ? "Updating Stock..."
                    : "Confirm Receipt & Stock IN"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
