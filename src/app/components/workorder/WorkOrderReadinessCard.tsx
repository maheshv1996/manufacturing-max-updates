"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertTriangle,
  ShoppingBag,
  X,
  PackageCheck,
} from "lucide-react";
import {
  calculateWorkOrderReadiness,
  MaterialRequirement,
} from "@/lib/readinessEngine";

interface WorkOrderReadinessCardProps {
  workOrder: any;
  suppliers: any[];
}

export default function WorkOrderReadinessCard({
  workOrder,
  suppliers,
}: WorkOrderReadinessCardProps) {
  const router = useRouter();
  const readiness = calculateWorkOrderReadiness(workOrder);

  // Modal State for prefilled PO creation
  const [selectedMaterial, setSelectedMaterial] =
    useState<MaterialRequirement | null>(null);
  const [showPOModal, setShowPOModal] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [poQtyInput, setPoQtyInput] = useState("");
  const [poUnitCostInput, setPoUnitCostInput] = useState("");
  const [poExpectedDateInput, setPoExpectedDateInput] = useState("");
  const [submittingPO, setSubmittingPO] = useState(false);

  const handleOpenPOModal = (mat: MaterialRequirement) => {
    setSelectedMaterial(mat);
    setSelectedSupplierId(mat.supplier?.id || suppliers[0]?.id || "");
    setPoQtyInput(
      String(mat.shortageQty > 0 ? mat.shortageQty : mat.requiredQty),
    );
    setPoUnitCostInput(String(mat.unitCost || 0));

    const leadDays = mat.supplier?.defaultLeadDays || 7;
    const exp = new Date();
    exp.setDate(exp.getDate() + leadDays);
    setPoExpectedDateInput(exp.toISOString().split("T")[0]);

    setShowPOModal(true);
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !selectedMaterial ||
      !selectedSupplierId ||
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
          rawMaterialId: selectedMaterial.rawMaterialId,
          qty: poQtyInput,
          unitCost: poUnitCostInput,
          expectedDate: poExpectedDateInput,
        }),
      });

      if (res.ok) {
        setShowPOModal(false);
        setSelectedMaterial(null);
        router.refresh();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create Purchase Order");
      }
    } catch (err) {
      console.error(err);
      alert("Error creating Purchase Order");
    } finally {
      setSubmittingPO(false);
    }
  };

  return (
    <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-400 rounded-xl">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              Material Readiness &amp; BOM Requirements
            </h2>
            <p className="text-xs text-slate-400">
              Evaluating raw material stock availability for{" "}
              {workOrder.plannedQuantity?.toLocaleString()} planned units
            </p>
          </div>
        </div>

        <div>
          {readiness.overallStatus === "READY" ? (
            <span className="px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 text-emerald-300 dark:border-emerald-800 inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              All Materials Ready (Can Start WO)
            </span>
          ) : (
            <span className="px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 text-rose-300 dark:border-rose-800 inline-flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
              Shortage Detected ({readiness.shortageCount} material
              {readiness.shortageCount > 1 ? "s" : ""} short)
            </span>
          )}
        </div>
      </div>

      {/* MATERIAL READINESS TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs tracking-wider">
            <tr>
              <th className="py-3 px-4 rounded-l-lg font-semibold">
                Raw Material
              </th>
              <th className="py-3 px-4 font-semibold">BOM Qty / Unit</th>
              <th className="py-3 px-4 font-semibold">Required Qty</th>
              <th className="py-3 px-4 font-semibold">In Stock</th>
              <th className="py-3 px-4 font-semibold">Stock Delta</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 rounded-r-lg font-semibold text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 divide-slate-800">
            {readiness.materials.map((mat) => {
              const delta = mat.currentStock - mat.requiredQty;
              const isShort = mat.status === "SHORT";

              return (
                <tr
                  key={mat.rawMaterialId}
                  className="hover:bg-slate-50/60 hover:bg-slate-800/90/40 transition-colors"
                >
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-white">{mat.name}</div>
                    <div className="text-xs font-mono text-slate-400">
                      SKU: {mat.sku}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-300">
                    {mat.qtyPerUnit} {mat.unit} / pc
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-white">
                    {mat.requiredQty.toLocaleString()} {mat.unit}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-300">
                    {mat.currentStock.toLocaleString()} {mat.unit}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs">
                    {isShort ? (
                      <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 text-rose-300 dark:border-rose-800 rounded-lg font-bold">
                        -{mat.shortageQty.toLocaleString()} {mat.unit} Short
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 text-emerald-300 dark:border-emerald-800 rounded-lg font-bold">
                        +{delta.toLocaleString()} {mat.unit} Surplus
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    {isShort ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-900/60 text-rose-200">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        SHORT
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 text-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        READY
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {isShort && (
                      <button
                        onClick={() => handleOpenPOModal(mat)}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        Create PO for Shortage
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}

            {readiness.materials.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="py-8 text-center text-sm text-slate-400"
                >
                  No Bill of Materials (BOM) configured for product "
                  {workOrder.product?.name}". Please configure BOM lines in
                  Admin &gt; BOM tab.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PREFILLED NEW PO MODAL */}
      {showPOModal && selectedMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-6 shadow-2xl text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Create PO for Shortage
                  </h3>
                  <p className="text-xs text-slate-400">
                    Prefilled for Work Order {workOrder.woNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPOModal(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreatePO} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-300 mb-1">
                  Raw Material
                </label>
                <input
                  type="text"
                  readOnly
                  value={`${selectedMaterial.name} (${selectedMaterial.sku})`}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 text-sm text-slate-300 font-bold focus:outline-none cursor-not-allowed"
                />
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
                  {suppliers.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Lead Time: {s.defaultLeadDays || 7}d)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase text-slate-300 mb-1">
                    Suggested PO Qty ({selectedMaterial.unit}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    value={poQtyInput}
                    onChange={(e) => setPoQtyInput(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-[11px] text-rose-400 mt-1">
                    Exact shortage: {selectedMaterial.shortageQty}{" "}
                    {selectedMaterial.unit}
                  </p>
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
                  onClick={() => setShowPOModal(false)}
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
    </section>
  );
}
