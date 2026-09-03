"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Truck,
  FileText,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Printer,
} from "lucide-react";

interface WorkOrderDispatchesCardProps {
  wo: any;
  userRole?: string;
}

export default function WorkOrderDispatchesCard({
  wo,
}: WorkOrderDispatchesCardProps) {
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedDispatch, setSelectedDispatch] = useState<any>(null);

  // New Dispatch Form State
  const [dispatchedQty, setDispatchedQty] = useState<number>(
    wo.plannedQuantity || 100,
  );
  const [carrierName, setCarrierName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [dispatchedByName, setDispatchedByName] = useState("Store Manager");
  const [dispatchNotes, setDispatchNotes] = useState("");

  // New Invoice Form State
  const [customerName, setCustomerName] = useState(wo.customerName || "");
  const [customerAddress, setCustomerAddress] = useState(
    "Plot 42, Chakan Industrial Area, Pune 410501",
  );
  const [customerGstin, setCustomerGstin] = useState("27AAACT9876F1Z2");
  const [taxType, setTaxType] = useState<"INTRA" | "INTER">("INTRA");
  const [taxRatePct, setTaxRatePct] = useState<number>(18);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  );
  const [invoiceNotes, setInvoiceNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "ok" | "err";
  } | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Helper unit price calculation
  const unitPrice =
    wo.quotedPrice && wo.plannedQuantity > 0
      ? wo.quotedPrice / wo.plannedQuantity
      : wo.product?.sellingPricePerUnit || 100.0;

  // Handle Dispatch Creation
  const handleCreateDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch("/api/movement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrderId: wo.id,
          dispatchedQty,
          carrierName,
          vehicleNumber,
          dispatchedByName,
          notes: dispatchNotes,
          isDispatch: true,
        }),
      });

      if (res.ok) {
        showToast("Dispatch challan created successfully!");
        setShowDispatchModal(false);
        window.location.reload();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to create dispatch", "err");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to create dispatch", "err");
    } finally {
      setLoading(false);
    }
  };

  // Handle Invoice Generation
  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDispatch) return;

    try {
      setLoading(true);
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dispatchRecordId: selectedDispatch.id,
          workOrderId: wo.id,
          customerName,
          customerAddress,
          customerGstin,
          taxType,
          taxRatePct,
          dueDate,
          notes: invoiceNotes,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        showToast(`Tax Invoice ${json.invoice.invoiceNumber} generated!`);
        setShowInvoiceModal(false);
        window.location.reload();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to generate invoice", "err");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to generate invoice", "err");
    } finally {
      setLoading(false);
    }
  };

  // Real-time invoice tax preview
  const currQty = selectedDispatch
    ? selectedDispatch.dispatchedQty
    : wo.plannedQuantity;
  const taxableValue = Number((currQty * unitPrice).toFixed(2));
  const cgst =
    taxType === "INTRA"
      ? Number(((taxableValue * taxRatePct) / 200).toFixed(2))
      : 0;
  const sgst =
    taxType === "INTRA"
      ? Number(((taxableValue * taxRatePct) / 200).toFixed(2))
      : 0;
  const igst =
    taxType === "INTER"
      ? Number(((taxableValue * taxRatePct) / 100).toFixed(2))
      : 0;
  const totalValue = Number((taxableValue + cgst + sgst + igst).toFixed(2));

  return (
    <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
      {/* TOAST */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl text-sm font-bold text-white flex items-center gap-2 animate-bounce ${
            toast.type === "ok" ? "bg-emerald-600" : "bg-rose-600"
          }`}
        >
          {toast.type === "ok" ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          {toast.msg}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-4">
        <div>
          <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            Dispatches &amp; GST Tax Invoices ({wo.dispatchRecords?.length || 0}
            )
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Turn completed production dispatches into legal 18% GST Tax
            Invoices.
          </p>
        </div>

        <button
          onClick={() => setShowDispatchModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create New Dispatch
        </button>
      </div>

      {/* DISPATCHES TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs">
            <tr>
              <th className="py-2.5 px-3">Challan #</th>
              <th className="py-2.5 px-3">Dispatch Date</th>
              <th className="py-2.5 px-3">Quantity</th>
              <th className="py-2.5 px-3">Carrier / Vehicle</th>
              <th className="py-2.5 px-3">Dispatched By</th>
              <th className="py-2.5 px-3">Tax Invoice Status</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 divide-slate-800">
            {!wo.dispatchRecords || wo.dispatchRecords.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="py-8 text-center text-slate-400 italic"
                >
                  No dispatches recorded yet for this Work Order.
                </td>
              </tr>
            ) : (
              wo.dispatchRecords.map((d: any) => {
                const inv = d.invoice;

                return (
                  <tr
                    key={d.id}
                    className="hover:bg-slate-50/60 hover:bg-slate-800/90/40"
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-400">
                      {d.challanNumber}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-slate-500">
                      {new Date(d.dispatchedAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-white">
                      {d.dispatchedQty.toLocaleString()} pcs
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-600 text-slate-300">
                      {d.carrierName || "Direct"}{" "}
                      {d.vehicleNumber ? `(${d.vehicleNumber})` : ""}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-500">
                      {d.dispatchedByName}
                    </td>
                    <td className="py-2.5 px-3">
                      {inv ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-purple-400">
                            {inv.invoiceNumber}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                              inv.status === "PAID"
                                ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 text-emerald-300"
                                : inv.status === "PARTIAL"
                                  ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 text-amber-300"
                                  : "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950 text-rose-300"
                            }`}
                          >
                            {inv.status} (₹
                            {inv.totalValue?.toLocaleString("en-IN")})
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          No Invoice Generated
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {inv ? (
                        <Link
                          href={`/reports/invoice/${inv.id}`}
                          className="px-3 py-1 bg-purple-50 text-purple-700 dark:bg-purple-950 text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg text-xs font-bold hover:bg-purple-100 transition-colors inline-flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" /> View Invoice
                        </Link>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedDispatch(d);
                            setShowInvoiceModal(true);
                          }}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1 inline-flex cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" /> Generate Invoice
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── CREATE DISPATCH MODAL ── */}
      {showDispatchModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800/60 border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                New Dispatch Delivery Challan
              </h3>
              <button
                onClick={() => setShowDispatchModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateDispatch}
              className="space-y-4 text-xs font-medium"
            >
              <div>
                <label className="block text-slate-300 uppercase font-bold text-[10px] mb-1">
                  Dispatched Quantity (pcs) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={dispatchedQty}
                  onChange={(e) =>
                    setDispatchedQty(parseInt(e.target.value, 10) || 1)
                  }
                  className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 uppercase font-bold text-[10px] mb-1">
                    Carrier Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Blue Dart Logistics"
                    value={carrierName}
                    onChange={(e) => setCarrierName(e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 uppercase font-bold text-[10px] mb-1">
                    Vehicle Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MH-12-AB-1234"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 uppercase font-bold text-[10px] mb-1">
                  Dispatched By Name
                </label>
                <input
                  type="text"
                  value={dispatchedByName}
                  onChange={(e) => setDispatchedByName(e.target.value)}
                  className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-300 uppercase font-bold text-[10px] mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Batch #1 shipment"
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="px-4 py-2 text-slate-400 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-lg flex items-center gap-1.5"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Dispatch Challan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── GENERATE INVOICE MODAL ── */}
      {showInvoiceModal && selectedDispatch && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-800/60 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-600 text-white rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white">
                    Generate GST Tax Invoice
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    Dispatch Challan: {selectedDispatch.challanNumber} (
                    {selectedDispatch.dispatchedQty} pcs)
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleGenerateInvoice}
              className="space-y-5 text-xs font-medium"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 uppercase font-bold text-[10px] mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 uppercase font-bold text-[10px] mb-1">
                    Customer GSTIN Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 27AAACT9876F1Z2"
                    value={customerGstin}
                    onChange={(e) => setCustomerGstin(e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-300 uppercase font-bold text-[10px] mb-1">
                    Customer Registered Address
                  </label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 uppercase font-bold text-[10px] mb-1">
                    GST Tax Type *
                  </label>
                  <select
                    value={taxType}
                    onChange={(e) =>
                      setTaxType(e.target.value as "INTRA" | "INTER")
                    }
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="INTRA">
                      INTRA-STATE (CGST 9% + SGST 9%)
                    </option>
                    <option value="INTER">INTER-STATE (IGST 18%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 uppercase font-bold text-[10px] mb-1">
                    GST Rate %
                  </label>
                  <input
                    type="number"
                    value={taxRatePct}
                    onChange={(e) =>
                      setTaxRatePct(parseFloat(e.target.value) || 18)
                    }
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 uppercase font-bold text-[10px] mb-1">
                    Payment Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 uppercase font-bold text-[10px] mb-1">
                    Invoice Notes / Terms
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Payment terms NET-30"
                    value={invoiceNotes}
                    onChange={(e) => setInvoiceNotes(e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              {/* REAL-TIME TAX CALCULATION PREVIEW */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3 font-mono">
                <span className="text-[10px] uppercase font-sans font-bold text-emerald-400 block tracking-wider">
                  Real-time Tax Calculation Breakdown
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-sans">
                      Taxable Value
                    </span>
                    <strong className="text-white font-bold">
                      ₹{taxableValue.toLocaleString("en-IN")}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-sans">
                      {taxType === "INTRA" ? "CGST (9%)" : "IGST (18%)"}
                    </span>
                    <strong className="text-emerald-400 font-bold">
                      ₹
                      {(taxType === "INTRA" ? cgst : igst).toLocaleString(
                        "en-IN",
                      )}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-sans">
                      {taxType === "INTRA" ? "SGST (9%)" : "N/A"}
                    </span>
                    <strong className="text-emerald-400 font-bold">
                      {taxType === "INTRA"
                        ? `₹${sgst.toLocaleString("en-IN")}`
                        : "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-sans">
                      Grand Total Value
                    </span>
                    <strong className="text-cyan-400 font-bold text-sm">
                      ₹{totalValue.toLocaleString("en-IN")}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  className="px-4 py-2 text-slate-400 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-lg flex items-center gap-1.5"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Generate GST Tax Invoice 📄
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
