"use client";

import { useState, useEffect } from "react";
import {
  Boxes,
  Plus,
  Minus,
  SlidersHorizontal,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  X,
  FileText,
} from "lucide-react";
import SourceRecordEditModal from "@/app/components/modals/SourceRecordEditModal";

export default function InventoryTab() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal states
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: "IN" | "OUT" | "ADJUST" | null;
    selectedMaterialId: string;
  }>({
    isOpen: false,
    type: null,
    selectedMaterialId: "",
  });

  const [formQty, setFormQty] = useState("");
  const [formUnitCost, setFormUnitCost] = useState("");
  const [formBatchNo, setFormBatchNo] = useState("");
  const [formReference, setFormReference] = useState("");
  const [formWorkOrderId, setFormWorkOrderId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Cert-related state
  const [requireMillCerts, setRequireMillCerts] = useState(false);
  const [formHeatNumber, setFormHeatNumber] = useState("");
  const [formCertNumber, setFormCertNumber] = useState("");
  const [formCertType, setFormCertType] = useState("MILL_CERT");
  const [formSpecGrade, setFormSpecGrade] = useState("");
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const [resInv, resTx, resSettings] = await Promise.all([
        fetch("/api/inventory"),
        fetch("/api/inventory/transactions"),
        fetch("/api/settings"),
      ]);
      if (resInv.ok) {
        const json = await resInv.json();
        setMaterials(json.materials || []);
        setWorkOrders(json.workOrders || []);
      }
      if (resTx.ok) {
        const jsonTx = await resTx.json();
        setTransactions(jsonTx.transactions || []);
      }
      if (resSettings.ok) {
        const s = await resSettings.json();
        setRequireMillCerts(!!s.requireMillCerts);
      }
    } catch (err) {
      console.error("Failed to load inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const openModal = (type: "IN" | "OUT" | "ADJUST", materialId = "") => {
    setModalState({
      isOpen: true,
      type,
      selectedMaterialId:
        materialId || (materials.length > 0 ? materials[0].id : ""),
    });

    const mat = materials.find(
      (m) =>
        m.id === (materialId || (materials.length > 0 ? materials[0].id : "")),
    );

    setFormError(null);
    setFormQty("");
    setFormUnitCost(mat ? String(mat.unitCost) : "");
    setFormBatchNo(
      type === "IN"
        ? `BATCH-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
        : "",
    );
    setFormReference(
      type === "IN"
        ? "PO-RECEIPT"
        : type === "OUT"
          ? "JOB-ISSUE"
          : "PHYSICAL-AUDIT",
    );
    setFormWorkOrderId(workOrders.length > 0 ? workOrders[0].id : "");
    // Reset cert fields
    setFormHeatNumber("");
    setFormCertNumber("");
    setFormCertType("MILL_CERT");
    setFormSpecGrade("");
    setFormExpiresAt("");
    setCertFile(null);
  };

  const closeModal = () => {
    if (!submitting) {
      setModalState({ isOpen: false, type: null, selectedMaterialId: "" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalState.selectedMaterialId || !formQty) {
      setFormError("Please enter material and quantity.");
      return;
    }

    // Client-side cert validation for IN when requireMillCerts is ON
    if (
      modalState.type === "IN" &&
      requireMillCerts &&
      !formHeatNumber.trim()
    ) {
      setFormError(
        "Heat Number is required (Aerospace Mode: requireMillCerts is ON).",
      );
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      let certFileBase64: string | undefined;
      let certMimeType: string | undefined;
      let certSizeKb: number | undefined;

      if (certFile) {
        const MAX_MB = 4;
        if (certFile.size > MAX_MB * 1024 * 1024) {
          setFormError(`File too large. Max ${MAX_MB}MB allowed.`);
          setSubmitting(false);
          return;
        }
        const ab = await certFile.arrayBuffer();
        certFileBase64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
        certMimeType = certFile.type;
        certSizeKb = Math.round(certFile.size / 1024);
      }

      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: modalState.type,
          rawMaterialId: modalState.selectedMaterialId,
          qty: parseFloat(formQty),
          unitCost: formUnitCost ? parseFloat(formUnitCost) : undefined,
          batchNo: formBatchNo || undefined,
          reference: formReference || undefined,
          workOrderId: modalState.type === "OUT" ? formWorkOrderId : undefined,
          // Cert fields
          heatNumber: formHeatNumber || undefined,
          certNumber: formCertNumber || undefined,
          certType: formCertType || undefined,
          specGrade: formSpecGrade || undefined,
          expiresAt: formExpiresAt || undefined,
          certFileBase64,
          certMimeType,
          certSizeKb,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(
          errData.error || "Failed to execute inventory transaction",
        );
      }

      closeModal();
      await fetchInventory();
    } catch (err: any) {
      setFormError(err?.message || "Transaction failed");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMaterials = materials.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.sku.toLowerCase().includes(search.toLowerCase()),
  );

  const lowStockCount = materials.filter(
    (m) => m.currentStock <= m.minStock,
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* ACTION BAR & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/60 border border-slate-700 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-400 rounded-xl">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              Raw Material Stock &amp; Batch Register
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage inventory receipts, job issuances, lot batching, and stock
              adjustments.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => openModal("IN")}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Receive Stock (IN)
          </button>

          <button
            onClick={() => openModal("OUT")}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Minus className="w-4 h-4" /> Issue to Job (OUT)
          </button>

          <button
            onClick={() => openModal("ADJUST")}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all border border-slate-700"
          >
            <SlidersHorizontal className="w-4 h-4 text-amber-400" /> Adjust
            Stock
          </button>

          <button
            onClick={fetchInventory}
            title="Refresh Inventory"
            className="p-2 bg-slate-800/60 hover:bg-slate-200 hover:bg-slate-700 text-slate-600 text-slate-300 rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* LOW STOCK ALERT BANNER IF APPLICABLE */}
      {lowStockCount > 0 && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-2xl flex items-center justify-between text-xs text-rose-200 font-medium">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>
              <strong>Inventory Warning:</strong> {lowStockCount} raw material
              item(s) are below minimum reorder thresholds.
            </span>
          </div>
          <span className="px-2.5 py-1 bg-rose-600 text-white font-bold rounded-lg uppercase tracking-wider text-[10px]">
            Reorder Action Required
          </span>
        </div>
      )}

      {/* SEARCH BAR */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
        <input
          type="text"
          placeholder="Filter materials by name or SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-800/60 border border-slate-700 text-white rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* MATERIALS TABLE */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-800/60 border-b border-slate-700 text-slate-400 font-bold uppercase tracking-wider">
              <th className="p-4">Material / SKU</th>
              <th className="p-4">Unit Cost</th>
              <th className="p-4 text-right">Current Stock</th>
              <th className="p-4 text-right">Min Stock</th>
              <th className="p-4 text-right">Total Valuation</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-center">Cert Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 divide-slate-800 font-mono">
            {filteredMaterials.map((mat) => {
              const isLow = mat.currentStock <= mat.minStock;
              const valuation = mat.currentStock * mat.unitCost;

              return (
                <tr
                  key={mat.id}
                  className={`hover:bg-slate-800/90/40 transition-colors ${
                    isLow ? "bg-rose-50/40 dark:bg-rose-950/20" : ""
                  }`}
                >
                  <td className="p-4 font-sans">
                    <p className="font-bold text-white text-sm">{mat.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      SKU: {mat.sku} â€¢ Unit: {mat.unit}
                    </p>
                  </td>
                  <td className="p-4 font-bold text-slate-200">
                    â‚¹{mat.unitCost.toLocaleString()}
                  </td>
                  <td className="p-4 text-right font-black text-sm text-white">
                    {mat.currentStock.toLocaleString()} {mat.unit}
                  </td>
                  <td className="p-4 text-right text-slate-500">
                    {mat.minStock.toLocaleString()} {mat.unit}
                  </td>
                  <td className="p-4 text-right font-bold text-emerald-400">
                    â‚¹{valuation.toLocaleString()}
                  </td>
                  <td className="p-4 text-center font-sans">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                        isLow
                          ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 text-rose-300 dark:border-rose-900 animate-pulse"
                          : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 text-emerald-300 dark:border-emerald-900"
                      }`}
                    >
                      {isLow ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          <span>Reorder Now!</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>OK</span>
                        </>
                      )}
                    </span>
                  </td>
                  {/* Cert status chip â€” show if requireMillCerts ON or if cert exists */}
                  <td className="p-4 text-center font-sans">
                    {(() => {
                      const inTxs =
                        mat.transactions?.filter((t: any) => t.type === "IN") ||
                        [];
                      const hasCert =
                        inTxs.length > 0 &&
                        inTxs.every((t: any) => t.materialCert);
                      const hasAnyCert = inTxs.some((t: any) => t.materialCert);
                      const latestCert = inTxs.find(
                        (t: any) => t.materialCert,
                      )?.materialCert;
                      if (hasCert)
                        return (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-300 text-[10px] font-bold">
                            âœ“ CERT Â· {latestCert?.heatNumber}
                          </span>
                        );
                      if (hasAnyCert)
                        return (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-300 text-[10px] font-bold">
                            âš  PARTIAL
                          </span>
                        );
                      return (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            requireMillCerts
                              ? "bg-rose-100 dark:bg-rose-950 text-rose-300 animate-pulse"
                              : "bg-slate-800/60 text-slate-500"
                          }`}
                        >
                          {requireMillCerts ? "ðŸ”´ NO CERT" : "â€”"}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="p-4 text-right font-sans">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openModal("IN", mat.id)}
                        className="p-1.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-400 border border-emerald-200 dark:border-emerald-900 rounded-lg hover:bg-emerald-100 transition-colors"
                        title="Receive Stock IN"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openModal("OUT", mat.id)}
                        className="p-1.5 bg-blue-50 dark:bg-blue-950 text-blue-400 border border-blue-200 dark:border-blue-900 rounded-lg hover:bg-blue-100 transition-colors"
                        title="Issue OUT to Job"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openModal("ADJUST", mat.id)}
                        className="p-1.5 bg-slate-800/60 text-slate-600 text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                        title="Adjust Stock Count"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredMaterials.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-8 text-center text-slate-500 font-sans"
                >
                  No raw materials found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* RECENT INVENTORY TRANSACTIONS LOG (EDITABLE) */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm p-6 space-y-4">
        <h3 className="text-base font-extrabold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" />
          Recent Inventory Movement Ledger ({transactions.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-800/60 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-700">
                <th className="p-3">Date</th>
                <th className="p-3">Material</th>
                <th className="p-3">Type</th>
                <th className="p-3 text-right">Quantity</th>
                <th className="p-3 text-right">Unit Cost (â‚¹)</th>
                <th className="p-3">Batch / Lot #</th>
                <th className="p-3">Reference</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 divide-slate-800 font-mono">
              {transactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="p-6 text-center text-slate-400 italic font-sans"
                  >
                    No transactions recorded yet.
                  </td>
                </tr>
              ) : (
                transactions.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-slate-800/90/40">
                    <td className="p-3 text-slate-500 font-sans">
                      {new Date(tx.at).toLocaleString()}
                    </td>
                    <td className="p-3 font-bold font-sans">
                      {tx.rawMaterial?.name || "â€”"}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.type === "IN"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 text-emerald-300"
                            : tx.type === "OUT"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950 text-blue-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950 text-amber-300"
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold">{tx.qty}</td>
                    <td className="p-3 text-right">â‚¹{tx.unitCost || 0}</td>
                    <td className="p-3 text-slate-400 text-[11px]">
                      {tx.batchNo || "â€”"}
                    </td>
                    <td className="p-3 text-slate-400 text-[11px]">
                      {tx.reference || "â€”"}
                    </td>
                    <td className="p-3 text-right">
                      <SourceRecordEditModal
                        entityType="InventoryTransaction"
                        entityId={tx.id}
                        title="Inventory Transaction"
                        fields={[
                          { key: "qty", label: "Quantity", type: "number" },
                          {
                            key: "unitCost",
                            label: "Unit Cost (â‚¹)",
                            type: "number",
                          },
                          {
                            key: "batchNo",
                            label: "Batch / Lot #",
                            type: "text",
                          },
                          {
                            key: "reference",
                            label: "Reference",
                            type: "text",
                          },
                        ]}
                        initialValues={{
                          qty: tx.qty,
                          unitCost: tx.unitCost,
                          batchNo: tx.batchNo,
                          reference: tx.reference,
                        }}
                        onSaved={fetchInventory}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INVENTORY TRANSACTION MODAL */}
      {modalState.isOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800/60 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`p-2 rounded-xl text-white ${
                    modalState.type === "IN"
                      ? "bg-emerald-600"
                      : modalState.type === "OUT"
                        ? "bg-blue-600"
                        : "bg-amber-600"
                  }`}
                >
                  {modalState.type === "IN" ? (
                    <Plus className="w-5 h-5" />
                  ) : modalState.type === "OUT" ? (
                    <Minus className="w-5 h-5" />
                  ) : (
                    <SlidersHorizontal className="w-5 h-5" />
                  )}
                </div>
                <h3 className="text-lg font-extrabold text-white">
                  {modalState.type === "IN"
                    ? "Receive Stock (IN)"
                    : modalState.type === "OUT"
                      ? "Issue Material to Job (OUT)"
                      : "Adjust Stock Count"}
                </h3>
              </div>

              <button
                onClick={closeModal}
                disabled={submitting}
                className="text-slate-400 hover:text-slate-600 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 text-rose-700 dark:bg-rose-950 text-rose-300 text-xs font-medium rounded-xl border border-rose-200 dark:border-rose-900">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Raw Material *
                </label>
                <select
                  value={modalState.selectedMaterialId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setModalState({ ...modalState, selectedMaterialId: id });
                    const m = materials.find((mat) => mat.id === id);
                    if (m) setFormUnitCost(String(m.unitCost));
                  }}
                  required
                  className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.sku}) â€” Stock: {m.currentStock} {m.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-500 mb-1">
                  {modalState.type === "ADJUST"
                    ? "New Actual Physical Stock *"
                    : "Quantity *"}
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  placeholder="e.g. 100"
                  value={formQty}
                  onChange={(e) => setFormQty(e.target.value)}
                  required
                  className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {modalState.type === "IN" && (
                <>
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Unit Cost (â‚¹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Unit cost in â‚¹"
                      value={formUnitCost}
                      onChange={(e) => setFormUnitCost(e.target.value)}
                      className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  {/* â”€â”€â”€ MILL CERT SECTION â”€â”€â”€ */}
                  <div className="border-t border-dashed border-amber-300 dark:border-amber-800 pt-4 space-y-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                      âœˆ Mill Certificate{" "}
                      {requireMillCerts ? "(REQUIRED)" : "(Optional)"}
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Heat Number{" "}
                          {requireMillCerts && (
                            <span className="text-rose-500">*</span>
                          )}
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. HT-2026-0041"
                          value={formHeatNumber}
                          onChange={(e) => setFormHeatNumber(e.target.value)}
                          required={requireMillCerts}
                          className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Cert Number
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. CERT-4911-001"
                          value={formCertNumber}
                          onChange={(e) => setFormCertNumber(e.target.value)}
                          className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Cert Type
                        </label>
                        <select
                          value={formCertType}
                          onChange={(e) => setFormCertType(e.target.value)}
                          className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="MILL_CERT">Mill Cert</option>
                          <option value="COC">
                            Certificate of Conformance
                          </option>
                          <option value="TEST_REPORT">Test Report</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Expiry Date
                        </label>
                        <input
                          type="date"
                          value={formExpiresAt}
                          onChange={(e) => setFormExpiresAt(e.target.value)}
                          className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Spec / Grade
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Ti-6Al-4V AMS 4911"
                        value={formSpecGrade}
                        onChange={(e) => setFormSpecGrade(e.target.value)}
                        className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Cert File (PDF / Image, max 4MB)
                      </label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) =>
                          setCertFile(e.target.files?.[0] || null)
                        }
                        className="w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-amber-900 file:text-amber-300 file:font-bold file:text-xs"
                      />
                    </div>
                  </div>
                </>
              )}

              {modalState.type === "OUT" && (
                <>
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Target Work Order *
                    </label>
                    <select
                      value={formWorkOrderId}
                      onChange={(e) => setFormWorkOrderId(e.target.value)}
                      className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    >
                      {workOrders.map((wo) => (
                        <option key={wo.id} value={wo.id}>
                          {wo.woNumber} â€” {wo.customerName || "Order"} (
                          {wo.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* NO CERT block warning */}
                  {requireMillCerts &&
                    (() => {
                      const mat = materials.find(
                        (m) => m.id === modalState.selectedMaterialId,
                      );
                      const inTxs =
                        mat?.transactions?.filter(
                          (t: any) => t.type === "IN",
                        ) || [];
                      const hasUncertified = inTxs.some(
                        (t: any) => !t.materialCert,
                      );
                      if (!hasUncertified) return null;
                      return (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950 border border-rose-300 dark:border-rose-800 rounded-xl">
                          <p className="text-xs font-extrabold text-rose-300 flex items-center gap-2">
                            ðŸ”´ ISSUE BLOCKED â€” NO CERT ON FILE
                          </p>
                          <p className="text-[11px] text-rose-400 mt-1">
                            This material has an uncertified batch. Aerospace
                            mode is ON. You must receive a new batch with a
                            valid cert before issuing.
                          </p>
                        </div>
                      );
                    })()}
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Batch / Lot Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BATCH-2026-08"
                    value={formBatchNo}
                    onChange={(e) => setFormBatchNo(e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Reference / PO #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PO-102"
                    value={formReference}
                    onChange={(e) => setFormReference(e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800/90 rounded-xl"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl flex items-center gap-2 ${
                    modalState.type === "IN"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : modalState.type === "OUT"
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-amber-600 hover:bg-amber-700"
                  }`}
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm {modalState.type} Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
