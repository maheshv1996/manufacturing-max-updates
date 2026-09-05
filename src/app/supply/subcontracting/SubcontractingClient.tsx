"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  Truck,
  Plus,
  CheckCircle2,
  Search,
  X,
  PackageCheck,
} from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface SubcontractChallan {
  id: string;
  challanNumber: string;
  workOrderId: string;
  workOrder: {
    id: string;
    woNumber: string;
    plannedQuantity: number;
    product: {
      name: string;
      sku: string;
    };
  };
  vendorName: string;
  processType: string;
  dispatchedQty: number;
  receivedQty: number;
  rejectedQty: number;
  dispatchedAt: string;
  expectedReturn?: string | null;
  receivedAt?: string | null;
  vehicleNumber?: string | null;
  status:
    "DRAFT" | "DISPATCHED" | "PROCESSING" | "RECEIVED" | "QC_PASSED" | "CLOSED";
  remarks?: string | null;
}

const PROCESS_TYPES = [
  "HEAT_TREATMENT",
  "ANODIZING",
  "HARD_CHROME_PLATING",
  "ELECTROLESS_NICKEL",
  "BLACKODIZING",
  "NDT_INSPECTION",
  "PASSIVATION",
  "GALVANIZING",
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DISPATCHED: {
    label: "In Transit / Dispatched",
    color: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  },
  PROCESSING: {
    label: "Processing at Vendor",
    color: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  },
  RECEIVED: {
    label: "Inward Received",
    color: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  },
  QC_PASSED: {
    label: "QC Passed & Accepted",
    color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  },
  CLOSED: {
    label: "Closed",
    color: "bg-slate-700/50 text-slate-300 border-slate-600",
  },
};

export default function SubcontractingClient() {
  const [challans, setChallans] = useState<SubcontractChallan[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalChallans: 0,
    activeAtVendors: 0,
    inwardCompleted: 0,
    totalRejections: 0,
  });
  const [_loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInwardModal, setShowInwardModal] = useState(false);
  const [selectedChallan, setSelectedChallan] =
    useState<SubcontractChallan | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states - Create
  const [formWoId, setFormWoId] = useState("");
  const [formVendor, setFormVendor] = useState("");
  const [formProcess, setFormProcess] = useState("HEAT_TREATMENT");
  const [formQty, setFormQty] = useState("");
  const [formReturnDate, setFormReturnDate] = useState("");
  const [formVehicle, setFormVehicle] = useState("");
  const [formRemarks, setFormRemarks] = useState("");

  // Form states - Inward
  const [inwardGoodQty, setInwardGoodQty] = useState("");
  const [inwardRejectQty, setInwardRejectQty] = useState("0");
  const [inwardStatus, setInwardStatus] = useState("QC_PASSED");
  const [inwardRemarks, setInwardRemarks] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/supply/subcontracting");
      if (res.ok) {
        const data = await res.json();
        setChallans(data.challans || []);
        setWorkOrders(data.workOrders || []);
        setVendors(data.vendors || []);
        setStats(
          data.stats || {
            totalChallans: 0,
            activeAtVendors: 0,
            inwardCompleted: 0,
            totalRejections: 0,
          },
        );
      }
    } catch (err) {
      logClientError("Failed to load subcontracting data", err, "SubcontractingClient");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!showCreateModal && !showInwardModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showCreateModal) setShowCreateModal(false);
        if (showInwardModal) setShowInwardModal(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showCreateModal, showInwardModal]);

  const handleCreateChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formWoId || !formVendor || !formProcess || !formQty) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/supply/subcontracting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrderId: formWoId,
          vendorName: formVendor,
          processType: formProcess,
          dispatchedQty: formQty,
          expectedReturn: formReturnDate || null,
          vehicleNumber: formVehicle || null,
          remarks: formRemarks || null,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setFormWoId("");
        setFormVendor("");
        setFormQty("");
        setFormVehicle("");
        setFormRemarks("");
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create challan");
      }
    } catch (err) {
      logClientError("Create challan error", err, "SubcontractingClient");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInwardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChallan || !inwardGoodQty) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/supply/subcontracting/inward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challanId: selectedChallan.id,
          receivedQty: inwardGoodQty,
          rejectedQty: inwardRejectQty,
          status: inwardStatus,
          remarks: inwardRemarks,
        }),
      });

      if (res.ok) {
        setShowInwardModal(false);
        setSelectedChallan(null);
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to record inward receipt");
      }
    } catch (err) {
      logClientError("Inward error", err, "SubcontractingClient");
    } finally {
      setSubmitting(false);
    }
  };

  const openInwardModal = (c: SubcontractChallan) => {
    setSelectedChallan(c);
    setInwardGoodQty(c.dispatchedQty.toString());
    setInwardRejectQty("0");
    setInwardStatus("QC_PASSED");
    setInwardRemarks("");
    setShowInwardModal(true);
  };

  const filteredChallans = challans.filter((c) => {
    const matchesSearch =
      c.challanNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.workOrder.woNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.workOrder.product.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterStatus === "ALL") return true;
    if (filterStatus === "ACTIVE")
      return c.status === "DISPATCHED" || c.status === "PROCESSING";
    if (filterStatus === "RECEIVED")
      return (
        c.status === "RECEIVED" ||
        c.status === "QC_PASSED" ||
        c.status === "CLOSED"
      );
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Subcontracting & Special Process Dispatch"
        description="Track external vendor operations: Heat Treatment, Surface Finishing, Anodizing, NDT, Delivery Challans, and Inward QC."
      >
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create Delivery Challan (DC)
        </button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Active at Vendors
          </span>
          <div className="text-2xl font-black font-mono text-amber-400 mt-1">
            {stats.activeAtVendors} Challans
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Currently out for processing
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Total Dispatches
          </span>
          <div className="text-2xl font-black font-mono text-blue-400 mt-1">
            {stats.totalChallans} Challans
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            All-time special process DCs
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Inward Completed
          </span>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
            {stats.inwardCompleted} Batches
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Returned & QC approved
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            QC Rejections
          </span>
          <div className="text-2xl font-black font-mono text-rose-400 mt-1">
            {stats.totalRejections} pcs
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Non-conformance at inward
          </div>
        </div>
      </div>

      {/* Challans Table Container */}
      <div className="bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-border pb-4">
          {/* Status Filters */}
          <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl border border-border">
            <button
              onClick={() => setFilterStatus("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterStatus === "ALL"
                  ? "bg-accent text-white shadow-sm"
                  : "text-text-3 hover:text-text-1"
              }`}
            >
              All Challans ({challans.length})
            </button>
            <button
              onClick={() => setFilterStatus("ACTIVE")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterStatus === "ACTIVE"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-text-3 hover:text-text-1"
              }`}
            >
              At Vendor ({stats.activeAtVendors})
            </button>
            <button
              onClick={() => setFilterStatus("RECEIVED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterStatus === "RECEIVED"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-text-3 hover:text-text-1"
              }`}
            >
              Received ({stats.inwardCompleted})
            </button>
          </div>

          {/* Search */}
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search challan, vendor, WO..."
              className="w-full bg-surface-2 border border-border rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-text-1 placeholder-text-3 focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {filteredChallans.length === 0 ? (
          <div className="text-center py-12 text-xs text-text-3">
            No subcontracting challans found. Click "+ Create Delivery Challan"
            to dispatch parts.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-text-3 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3">Challan / Date</th>
                  <th className="py-3">Work Order & Part</th>
                  <th className="py-3">Vendor / Process</th>
                  <th className="py-3 text-right">Dispatched</th>
                  <th className="py-3 text-right">Inward / Reject</th>
                  <th className="py-3 text-center">Status</th>
                  <th className="py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {filteredChallans.map((c) => {
                  const cfg =
                    STATUS_CONFIG[c.status] || STATUS_CONFIG.DISPATCHED;
                  const isPending =
                    c.status === "DISPATCHED" || c.status === "PROCESSING";

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-surface-2/40 transition-colors"
                    >
                      <td className="py-3">
                        <div className="font-extrabold text-text-1">
                          {c.challanNumber}
                        </div>
                        <div className="text-[10px] text-text-3 font-sans mt-0.5">
                          {new Date(c.dispatchedAt).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="py-3">
                        <div className="font-bold text-text-1">
                          #{c.workOrder.woNumber}
                        </div>
                        <div className="text-[11px] text-text-3 font-sans truncate max-w-[180px]">
                          {c.workOrder.product.name}
                        </div>
                      </td>

                      <td className="py-3 font-sans">
                        <div className="font-bold text-text-1">
                          {c.vendorName}
                        </div>
                        <div className="text-[10px] font-mono text-cyan-400 font-semibold mt-0.5">
                          {c.processType.replace(/_/g, " ")}
                        </div>
                      </td>

                      <td className="py-3 text-right font-bold text-text-1">
                        {c.dispatchedQty} pcs
                      </td>

                      <td className="py-3 text-right font-sans">
                        {c.receivedQty > 0 ? (
                          <div>
                            <span className="font-mono font-bold text-emerald-400">
                              {c.receivedQty} pcs
                            </span>
                            {c.rejectedQty > 0 && (
                              <span className="text-[10px] text-rose-400 ml-1">
                                ({c.rejectedQty} rej)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-text-3 font-mono">-</span>
                        )}
                      </td>

                      <td className="py-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-sans font-bold ${cfg.color}`}
                        >
                          {cfg.label}
                        </span>
                      </td>

                      <td className="py-3 text-right font-sans">
                        {isPending ? (
                          <button
                            onClick={() => openInwardModal(c)}
                            className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            Receive Inward
                          </button>
                        ) : (
                          <span className="text-[11px] text-text-3 flex items-center justify-end gap-1 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Completed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Delivery Challan Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowCreateModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-challan-title"
        >
          <div
            className="bg-surface-1 border border-border rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 id="create-challan-title" className="font-extrabold text-text-1 text-base flex items-center gap-2">
                <Truck className="w-5 h-5 text-accent" />
                Dispatch Delivery Challan (DC)
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg hover:bg-surface-3 text-text-3 hover:text-text-1"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateChallan} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
                  Target Work Order
                </label>
                <select
                  value={formWoId}
                  onChange={(e) => setFormWoId(e.target.value)}
                  required
                  className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-xs text-text-1 font-semibold focus:outline-none focus:border-accent"
                >
                  <option value="">-- Choose Work Order --</option>
                  {workOrders.map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      #{wo.woNumber} - {wo.product.name} (Qty:{" "}
                      {wo.plannedQuantity})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
                    Special Process Vendor
                  </label>
                  <input
                    type="text"
                    list="vendorList"
                    value={formVendor}
                    onChange={(e) => setFormVendor(e.target.value)}
                    placeholder="e.g. Apex Heat Treat"
                    required
                    className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-xs text-text-1 font-semibold focus:outline-none focus:border-accent"
                  />
                  <datalist id="vendorList">
                    {vendors.map((v) => (
                      <option key={v.id} value={v.name} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
                    Process Type
                  </label>
                  <select
                    value={formProcess}
                    onChange={(e) => setFormProcess(e.target.value)}
                    required
                    className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-xs text-text-1 font-semibold focus:outline-none focus:border-accent"
                  >
                    {PROCESS_TYPES.map((pt) => (
                      <option key={pt} value={pt}>
                        {pt.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
                    Quantity to Dispatch (pcs)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formQty}
                    onChange={(e) => setFormQty(e.target.value)}
                    required
                    className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-text-1 focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
                    Expected Return Date
                  </label>
                  <input
                    type="date"
                    value={formReturnDate}
                    onChange={(e) => setFormReturnDate(e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-xs text-text-1 focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
                  Vehicle / Transporter Number
                </label>
                <input
                  type="text"
                  value={formVehicle}
                  onChange={(e) => setFormVehicle(e.target.value)}
                  placeholder="e.g. KA-01-AB-1234 (Courier / Driver)"
                  className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-xs text-text-1 focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-2 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-1/2 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-xs shadow-md transition-colors"
                >
                  {submitting ? "Generating DC..." : "Generate Challan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inward QC Receipt Modal */}
      {showInwardModal && selectedChallan && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowInwardModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="inward-qc-title"
        >
          <div
            className="bg-surface-1 border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 id="inward-qc-title" className="font-extrabold text-text-1 text-base flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-emerald-400" />
                  Inward Receipt & QC Signoff
                </h3>
                <p className="text-xs text-text-3 font-mono mt-0.5">
                  {selectedChallan.challanNumber} · Dispatched:{" "}
                  {selectedChallan.dispatchedQty} pcs
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInwardModal(false)}
                className="p-1 rounded-lg hover:bg-surface-3 text-text-3 hover:text-text-1"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInwardSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
                    Good Quantity (pcs)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={selectedChallan.dispatchedQty}
                    value={inwardGoodQty}
                    onChange={(e) => setInwardGoodQty(e.target.value)}
                    required
                    className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-emerald-400 focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
                    Rejected Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={inwardRejectQty}
                    onChange={(e) => setInwardRejectQty(e.target.value)}
                    required
                    className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-rose-400 focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
                  QC Verification Decision
                </label>
                <select
                  value={inwardStatus}
                  onChange={(e) => setInwardStatus(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-xs text-text-1 font-semibold focus:outline-none focus:border-accent"
                >
                  <option value="QC_PASSED">
                    QC Passed & Accepted (Return to Line)
                  </option>
                  <option value="RECEIVED">
                    Pending QC Metrology Inspection
                  </option>
                  <option value="CLOSED">Closed (With Rejections)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1">
                  Remarks / Certificate No.
                </label>
                <input
                  type="text"
                  value={inwardRemarks}
                  onChange={(e) => setInwardRemarks(e.target.value)}
                  placeholder="e.g. Test Cert #HT-9823 attached, hardness 58-60 HRC verified"
                  className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-xs text-text-1 focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInwardModal(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-2 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-1/2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors"
                >
                  {submitting ? "Signing Off..." : "Accept & Post Inward"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
