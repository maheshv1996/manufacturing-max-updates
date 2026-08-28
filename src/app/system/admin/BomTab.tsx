"use client";

import { useState, useEffect } from "react";
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Boxes,
  HelpCircle,
} from "lucide-react";

export default function BomTab() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [targetLine, setTargetLine] = useState<any | null>(null);

  // Form states
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [qtyPerUnitInput, setQtyPerUnitInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/bom");
      const data = await res.json();
      if (res.ok) {
        setProducts(data.products || []);
        setRawMaterials(data.rawMaterials || []);
        if (data.products && data.products.length > 0 && !selectedProductId) {
          setSelectedProductId(data.products[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to load BOM data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const currentProduct =
    products.find((p) => p.id === selectedProductId) || null;
  const currentBomLines: any[] = currentProduct?.bomLines || [];

  // Compute live BOM cost per unit
  const computedBomCost = currentBomLines.reduce(
    (sum, line) =>
      sum + (line.qtyPerUnit || 0) * (line.rawMaterial?.unitCost || 0),
    0,
  );

  const configuredCost = currentProduct?.materialCostPerUnit ?? null;

  // Filter raw materials that haven't been added to current product yet
  const availableMaterials = rawMaterials.filter(
    (rm) => !currentBomLines.some((line) => line.rawMaterialId === rm.id),
  );

  const handleAddLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !selectedMaterialId || !qtyPerUnitInput) return;

    try {
      setSubmitting(true);
      const res = await fetch("/api/admin/bom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_LINE",
          productId: selectedProductId,
          rawMaterialId: selectedMaterialId,
          qtyPerUnit: qtyPerUnitInput,
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setSelectedMaterialId("");
        setQtyPerUnitInput("");
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to add BOM line");
      }
    } catch (err) {
      console.error(err);
      alert("Error adding BOM line");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetLine || !qtyPerUnitInput) return;

    try {
      setSubmitting(true);
      const res = await fetch("/api/admin/bom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "EDIT_LINE",
          lineId: targetLine.id,
          qtyPerUnit: qtyPerUnitInput,
        }),
      });

      if (res.ok) {
        setShowEditModal(false);
        setTargetLine(null);
        setQtyPerUnitInput("");
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to edit BOM line");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating BOM line");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLine = async (lineId: string, materialName: string) => {
    if (
      !confirm(`Are you sure you want to remove ${materialName} from this BOM?`)
    )
      return;

    try {
      const res = await fetch("/api/admin/bom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DELETE_LINE",
          lineId,
        }),
      });

      if (res.ok) {
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete BOM line");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span>Loading Bill of Materials (BOM) configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* HEADER SECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">
                Bill of Materials (BOM) Configurator
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Define raw material quantities required per piece of finished
                product to enable automated material readiness checks &amp; MRP
                planning.
              </p>
            </div>
          </div>

          {/* PRODUCT SELECTOR DROPDOWN */}
          <div className="w-full md:w-72">
            <label className="block text-[11px] font-extrabold uppercase text-slate-400 mb-1">
              Select Product *
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white font-semibold focus:outline-none focus:border-blue-500"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* SELECTED PRODUCT SUMMARY CARD & HINT CHIP */}
        {currentProduct && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-1">
            {/* Product details */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">
                Selected Product
              </span>
              <h3 className="text-lg font-bold text-white">
                {currentProduct.name}
              </h3>
              <p className="text-xs font-mono text-slate-400">
                {currentProduct.sku}
              </p>
            </div>

            {/* Calculated BOM Cost */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">
                Calculated BOM Cost
              </span>
              <div className="text-2xl font-black text-white font-mono flex items-center gap-1">
                ₹{computedBomCost.toFixed(2)}
                <span className="text-xs text-slate-400 font-sans font-normal">
                  / unit
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Sum of ({currentBomLines.length} material lines × unit cost)
              </p>
            </div>

            {/* Hint Chip comparing computed BOM cost vs configured materialCostPerUnit */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">
                Target Comparison
              </span>

              <div className="mt-1">
                {configuredCost !== null ? (
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold font-mono border inline-flex items-center gap-2 ${
                        computedBomCost > configuredCost
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      }`}
                    >
                      {computedBomCost > configuredCost ? (
                        <AlertCircle className="w-4 h-4 text-amber-400" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                      BOM ₹{computedBomCost.toFixed(0)} vs configured ₹
                      {configuredCost.toFixed(0)}
                    </span>
                  </div>
                ) : (
                  <span className="px-3 py-1.5 rounded-xl text-xs font-extrabold font-mono bg-slate-800 text-slate-300 border border-slate-700 inline-flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-slate-400" />
                    BOM ₹{computedBomCost.toFixed(0)} vs configured N/A
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                {configuredCost !== null && computedBomCost > configuredCost
                  ? "BOM cost exceeds target configured material cost"
                  : configuredCost !== null
                    ? "BOM cost is within target configured material budget"
                    : "No configured target cost set on product model"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* BOM LINES TABLE */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                Bill of Material Components
              </h3>
              <p className="text-xs text-slate-400">
                Raw materials consumed per piece of product
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setSelectedMaterialId("");
              setQtyPerUnitInput("");
              setShowAddModal(true);
            }}
            disabled={availableMaterials.length === 0}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Add BOM Material Line
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/50 text-slate-300 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Raw Material</th>
                <th className="px-6 py-4">Unit of Measure</th>
                <th className="px-6 py-4">Qty per Unit</th>
                <th className="px-6 py-4">Material Unit Cost</th>
                <th className="px-6 py-4">Calculated Line Cost</th>
                <th className="px-6 py-4">Supplier</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 font-sans">
              {currentBomLines.map((line) => {
                const mat = line.rawMaterial || {};
                const lineCost = (line.qtyPerUnit || 0) * (mat.unitCost || 0);

                return (
                  <tr
                    key={line.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{mat.name}</div>
                      <div className="text-xs font-mono text-slate-400">
                        {mat.sku}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      <span className="px-2.5 py-1 bg-slate-800 text-slate-300 text-xs font-mono rounded-lg border border-slate-700">
                        {mat.unit}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-cyan-400">
                      {line.qtyPerUnit} {mat.unit} / pc
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-300">
                      ₹{mat.unitCost?.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-emerald-400">
                      ₹{lineCost.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-slate-300 text-xs">
                      {mat.supplier?.name || "Unassigned"}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setTargetLine(line);
                          setQtyPerUnitInput(String(line.qtyPerUnit));
                          setShowEditModal(true);
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold text-xs rounded-lg border border-slate-700 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteLine(line.id, mat.name)}
                        className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 font-bold text-xs rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}

              {currentBomLines.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-slate-400"
                  >
                    <p className="font-semibold text-slate-300">
                      No BOM Lines Configured
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Click "Add BOM Material Line" to define materials for this
                      product.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD BOM LINE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Add BOM Line</h3>
                  <p className="text-xs text-slate-400">
                    {currentProduct?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAddLine} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-300 mb-1">
                  Select Raw Material *
                </label>
                <select
                  value={selectedMaterialId}
                  onChange={(e) => setSelectedMaterialId(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Choose Raw Material --</option>
                  {availableMaterials.map((rm) => (
                    <option key={rm.id} value={rm.id}>
                      {rm.name} ({rm.sku}) • ₹{rm.unitCost}/{rm.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-300 mb-1">
                  Quantity Required Per Piece *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  value={qtyPerUnitInput}
                  onChange={(e) => setQtyPerUnitInput(e.target.value)}
                  placeholder="e.g. 0.5"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-1/2 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? "Saving..." : "Add to BOM"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT BOM LINE MODAL */}
      {showEditModal && targetLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                  <Edit2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Edit BOM Line Quantity
                  </h3>
                  <p className="text-xs text-slate-400">
                    {targetLine.rawMaterial?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setTargetLine(null);
                }}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleEditLine} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-300 mb-1">
                  Quantity Required Per Piece ({targetLine.rawMaterial?.unit}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  value={qtyPerUnitInput}
                  onChange={(e) => setQtyPerUnitInput(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setTargetLine(null);
                  }}
                  className="w-1/2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-1/2 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
