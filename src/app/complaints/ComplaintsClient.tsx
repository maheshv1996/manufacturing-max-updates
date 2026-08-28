"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Search,
  Plus,
  AlertCircle,
  X,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "@/app/components/ui/Card";
import { StatusPill } from "@/app/components/ui/StatusPill";

interface ComplaintsClientProps {
  canEdit: boolean;
}

export default function ComplaintsClient({ canEdit }: ComplaintsClientProps) {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState<any | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    try {
      const res = await fetch("/api/complaints");
      if (res.ok) {
        const data = await res.json();
        setComplaints(Array.isArray(data) ? data : data.complaints || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 text-rose-400";
      case "HIGH":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 text-orange-400";
      case "MEDIUM":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 text-amber-400";
      case "LOW":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 text-blue-400";
      default:
        return "bg-slate-500/10 text-slate-300";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "OPEN":
        return "error";
      case "ACKNOWLEDGED":
        return "info";
      case "INVESTIGATING":
        return "warning";
      case "CAPA":
        return "info";
      case "CLOSED":
        return "success";
      default:
        return "default";
    }
  };

  const SlaChips = ({ complaint }: { complaint: any }) => {
    const sla = complaint.sla;
    if (!sla) return null;
    return (
      <>
        {sla.ackBreached && (
          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-600 text-white">
            ACK OVERDUE
          </span>
        )}
        {sla.eightDBreached && (
          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-orange-600 text-white">
            8D OVERDUE
          </span>
        )}
        {!sla.ackAt && sla.ackDueIn != null && sla.ackDueIn >= 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/40">
            ACK {sla.ackDueIn}h
          </span>
        )}
        {!sla.eightDClosedAt &&
          sla.eightDDueIn != null &&
          sla.eightDDueIn >= 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/40">
              8D {sla.eightDDueIn}d
            </span>
          )}
      </>
    );
  };

  const filteredComplaints = complaints.filter(
    (c) =>
      c.complaintNumber.toLowerCase().includes(search.toLowerCase()) ||
      c.customerName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search complaints..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {canEdit && (
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            New Complaint
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          {loading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-slate-800/60 rounded-xl" />
              ))}
            </div>
          ) : filteredComplaints.length === 0 ? (
            <div className="text-center py-12 bg-slate-800/60 border border-slate-700 rounded-xl">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white">
                No complaints found
              </h3>
              <p className="text-slate-500 mt-1">Quality is looking good!</p>
            </div>
          ) : (
            filteredComplaints.map((complaint) => (
              <div
                key={complaint.id}
                onClick={() => setSelectedComplaint(complaint)}
                className={`p-5 rounded-xl border cursor-pointer transition-all ${
                  selectedComplaint?.id === complaint.id
                    ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
                    : "border-slate-700 bg-slate-800/60 hover:border-blue-300"
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white">
                        {complaint.complaintNumber}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSeverityColor(complaint.severity)}`}
                      >
                        {complaint.severity}
                      </span>
                      <StatusPill
                        variant={getStatusColor(complaint.status) as any}
                        label={complaint.status}
                      />
                      <SlaChips complaint={complaint} />
                    </div>
                    <div className="text-sm text-slate-500">
                      {complaint.customerName} â€¢{" "}
                      {format(new Date(complaint.raisedAt), "MMM d, yyyy")}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-sm text-slate-300 line-clamp-2">
                  {complaint.description}
                </p>
                {complaint.workOrder && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/60 text-xs font-medium text-slate-400">
                    WO: {complaint.workOrder.woNumber}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="md:col-span-1">
          {selectedComplaint ? (
            <ComplaintDetailDrawer
              complaintId={selectedComplaint.id}
              canEdit={canEdit}
              onClose={() => setSelectedComplaint(null)}
              onUpdated={() => {
                fetchComplaints();
                setSelectedComplaint(null);
              }}
            />
          ) : (
            <Card className="h-full flex items-center justify-center min-h-[400px] border-dashed">
              <div className="text-center px-6">
                <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">
                  Select a complaint to view details, trace batches, and log
                  CAPA actions.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {showNewModal && (
        <NewComplaintModal
          onClose={() => setShowNewModal(false)}
          onCreated={() => {
            setShowNewModal(false);
            fetchComplaints();
          }}
        />
      )}
    </div>
  );
}

function ComplaintDetailDrawer({
  complaintId,
  canEdit,
  onClose,
  onUpdated,
}: {
  complaintId: string;
  canEdit: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [complaint, setComplaint] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rootCause, setRootCause] = useState("");
  const [capaAction, setCapaAction] = useState("");
  const [disposition, setDisposition] = useState("");

  useEffect(() => {
    fetchDetail();
  }, [complaintId]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/complaints/${complaintId}`);
      if (res.ok) {
        const data = await res.json();
        setComplaint(data);
        setRootCause(data.rootCause || "");
        setCapaAction(data.capaAction || "");
        setDisposition(data.disposition || "");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseComplaint = async () => {
    if (!rootCause || !capaAction || !disposition) {
      alert("Please fill in Root Cause, CAPA, and Disposition before closing.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/complaints/${complaintId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CLOSED",
          rootCause,
          capaAction,
          disposition,
        }),
      });
      if (res.ok) onUpdated();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <Card className="h-full animate-pulse">
        <CardContent className="pt-6 space-y-4">
          <div className="h-8 bg-slate-800/60 rounded w-1/2" />
          <div className="h-32 bg-slate-800/60 rounded" />
        </CardContent>
      </Card>
    );

  if (!complaint) return null;

  return (
    <Card className="h-full sticky top-6" noPadding>
      <CardHeader
        title={<span className="text-lg">{complaint.complaintNumber}</span>}
        subtitle={
          <span className="text-sm text-slate-500 mt-1">
            {complaint.customerName}
          </span>
        }
        action={
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800/90 rounded-full"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        }
      />

      <CardContent className="space-y-6">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Details
          </h4>
          <div className="bg-slate-800/60 p-3 rounded-lg text-sm text-slate-300">
            {complaint.description}
          </div>
          {complaint.returnedQty && (
            <div className="mt-2 text-sm text-slate-600">
              <span className="font-medium">Returned Qty:</span>{" "}
              {complaint.returnedQty}
            </div>
          )}
        </div>

        {complaint.workOrder && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Trace-Back
            </h4>
            <div className="border border-slate-700 rounded-lg p-3 space-y-3 bg-slate-800/60">
              <div className="text-sm font-medium">
                WO: {complaint.workOrder.woNumber}
              </div>

              <div className="text-xs space-y-1">
                <div className="text-slate-500 mb-1 font-medium">
                  Materials Consumed:
                </div>
                {complaint.workOrder.inventoryTransactions?.length > 0 ? (
                  complaint.workOrder.inventoryTransactions.map((tx: any) => (
                    <div
                      key={tx.id}
                      className="flex justify-between items-center bg-slate-800/60 p-1.5 rounded"
                    >
                      <span>{tx.item.name}</span>
                      <span className="font-medium">{tx.quantity}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 italic">
                    No consumption records
                  </div>
                )}
              </div>

              <div className="text-xs space-y-1">
                <div className="text-slate-500 mb-1 font-medium">
                  Production Logs:
                </div>
                {complaint.workOrder.productionLogs?.length > 0 ? (
                  <div className="bg-slate-800/60 p-1.5 rounded">
                    {complaint.workOrder.productionLogs.length} logs recorded.
                  </div>
                ) : (
                  <div className="text-slate-400 italic">
                    No production logs
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 pt-4 border-t border-slate-700">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Root Cause & CAPA
          </h4>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Root Cause (5-Why)
              </label>
              <textarea
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
                disabled={complaint.status === "CLOSED" || !canEdit}
                className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-slate-800/60 border-slate-700"
                rows={3}
                placeholder="Why did this happen?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Corrective/Preventive Action
              </label>
              <textarea
                value={capaAction}
                onChange={(e) => setCapaAction(e.target.value)}
                disabled={complaint.status === "CLOSED" || !canEdit}
                className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-slate-800/60 border-slate-700"
                rows={2}
                placeholder="How do we prevent recurrence?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Disposition
              </label>
              <select
                value={disposition}
                onChange={(e) => setDisposition(e.target.value)}
                disabled={complaint.status === "CLOSED" || !canEdit}
                className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-slate-800/60 border-slate-700"
              >
                <option value="">Select disposition...</option>
                <option value="REPLACED">Replaced / Sent New</option>
                <option value="CREDIT_NOTE">Credit Note Issued</option>
                <option value="REWORKED">Reworked</option>
                <option value="NO_ACTION">No Action / Customer Fault</option>
              </select>
            </div>
          </div>

          {complaint.status !== "CLOSED" && canEdit && (
            <button
              onClick={handleCloseComplaint}
              disabled={submitting}
              className="w-full mt-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? "Closing..." : "Close Complaint"}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function NewComplaintModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      customerName: formData.get("customerName"),
      workOrderId: formData.get("workOrderId") || undefined,
      batchNo: formData.get("batchNo") || undefined,
      type: formData.get("type"),
      severity: formData.get("severity"),
      description: formData.get("description"),
      returnedQty: formData.get("returnedQty") || undefined,
    };

    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) onCreated();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-slate-800/60 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/60">
          <h2 className="text-lg font-bold">New Complaint</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 hover:bg-slate-800/90 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Customer Name *
            </label>
            <input
              name="customerName"
              required
              className="w-full px-3 py-2 border rounded-lg bg-slate-800/60 border-slate-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Type *</label>
              <select
                name="type"
                required
                className="w-full px-3 py-2 border rounded-lg bg-slate-800/60 border-slate-600"
              >
                <option value="QUALITY">Quality Defect</option>
                <option value="DELIVERY">Delivery Issue</option>
                <option value="DAMAGE">Transit Damage</option>
                <option value="WRONG_ITEM">Wrong Item</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Severity *
              </label>
              <select
                name="severity"
                required
                className="w-full px-3 py-2 border rounded-lg bg-slate-800/60 border-slate-600"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Work Order ID (Trace)
              </label>
              <input
                name="workOrderId"
                placeholder="e.g. WO-..."
                className="w-full px-3 py-2 border rounded-lg bg-slate-800/60 border-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Batch No.
              </label>
              <input
                name="batchNo"
                className="w-full px-3 py-2 border rounded-lg bg-slate-800/60 border-slate-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Description *
            </label>
            <textarea
              name="description"
              required
              rows={3}
              className="w-full px-3 py-2 border rounded-lg bg-slate-800/60 border-slate-600"
            ></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Returned Qty (Optional)
            </label>
            <input
              type="number"
              step="any"
              name="returnedQty"
              className="w-full px-3 py-2 border rounded-lg bg-slate-800/60 border-slate-600"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-slate-500/10 text-slate-300 hover:bg-slate-500/20 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-bold"
            >
              {loading ? "Saving..." : "Log Complaint"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
