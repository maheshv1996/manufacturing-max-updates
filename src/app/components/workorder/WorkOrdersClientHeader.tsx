"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Filter } from "lucide-react";
import { Product, Machine } from "@/lib/data";
import PageHeader from "@/app/components/shared/PageHeader";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Select } from "@/app/components/ui/Select";

function getLocalDateTimeString(d = new Date()) {
  const pad = (n: number) => (n < 10 ? "0" + n : n);
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getFutureDateTimeString(daysAhead = 3) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return getLocalDateTimeString(d);
}

interface Props {
  products: Product[];
  machines: Machine[];
  activeStatus: string;
}

export default function WorkOrdersClientHeader({
  products,
  machines,
  activeStatus,
}: Props) {
  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [productId, setProductId] = useState(
    products.length > 0 ? products[0].id : "",
  );
  const [machineId, setMachineId] = useState(
    machines.length > 0 ? machines[0].id : "",
  );
  const [plannedQuantity, setPlannedQuantity] = useState("1000");
  const [plannedStartDate, setPlannedStartDate] = useState(
    getLocalDateTimeString(),
  );
  const [plannedEndDate, setPlannedEndDate] = useState(
    getFutureDateTimeString(3),
  );
  const [trackingMode, setTrackingMode] = useState("BATCH");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [promisedDispatchDate, setPromisedDispatchDate] = useState(
    getFutureDateTimeString(5),
  );

  const filterOptions = [
    { label: "All", value: "ALL" },
    { label: "Planned", value: "PLANNED" },
    { label: "In Progress", value: "IN_PROGRESS" },
    { label: "Completed", value: "COMPLETED" },
    { label: "On Hold", value: "ON_HOLD" },
  ];

  const handleStatusFilter = (statusVal: string) => {
    if (statusVal === "ALL") {
      router.push("/ops/work-orders");
    } else {
      router.push(`/ops/work-orders?status=${statusVal}`);
    }
  };

  const openModal = () => {
    setFormError(null);
    setPlannedQuantity("1000");
    setPlannedStartDate(getLocalDateTimeString());
    setPlannedEndDate(getFutureDateTimeString(3));
    setPromisedDispatchDate(getFutureDateTimeString(5));
    setCustomerName("");
    setCustomerEmail("");
    setTrackingMode("BATCH");
    if (products.length > 0 && !productId) setProductId(products[0].id);
    if (machines.length > 0 && !machineId) setMachineId(machines[0].id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (!submitting) {
      setIsModalOpen(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !productId ||
      !plannedQuantity ||
      !plannedStartDate ||
      !plannedEndDate
    ) {
      setFormError("Please fill in all required fields.");
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      const response = await fetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          machineId: machineId || null,
          plannedQuantity: Number(plannedQuantity),
          trackingMode,
          plannedStartDate,
          plannedEndDate,
          customerName: customerName || null,
          customerEmail: customerEmail || null,
          promisedDispatchDate: promisedDispatchDate || plannedEndDate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create work order");
      }

      setIsModalOpen(false);
      router.refresh();
    } catch (err) {
      logClientError("Error creating work order:", err, "WorkOrdersClientHeader");
      setFormError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Work Orders"
        description="Production Scheduling & Work Order Management"
      >
        <Button onClick={openModal}>
          <Plus className="w-4 h-4 mr-2" />
          New Work Order
        </Button>
      </PageHeader>

      {/* FILTER BUTTONS ROW */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span className="text-xs font-semibold text-text-3 uppercase tracking-wider flex items-center gap-1 mr-2">
          <Filter className="w-3.5 h-3.5" /> Status:
        </span>
        {filterOptions.map((opt) => (
          <Button
            key={opt.value}
            variant={activeStatus === opt.value ? "primary" : "ghost"}
            size="sm"
            onClick={() => handleStatusFilter(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* NEW WORK ORDER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-border rounded-card max-w-lg w-full shadow-modal max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between border-b border-border p-5 sticky top-0 bg-surface-1 z-10">
              <h3 className="text-lg font-semibold text-text-1">
                Create New Work Order
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={closeModal}
                disabled={submitting}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-danger-soft text-danger text-sm rounded-control border border-danger/20">
                  {formError}
                </div>
              )}

              <Select
                label="Product *"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                required
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </Select>

              <Select
                label="Assigned Machine (Optional)"
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.code})
                  </option>
                ))}
              </Select>

              <Input
                label="Planned Quantity *"
                type="number"
                min="1"
                value={plannedQuantity}
                onChange={(e) => setPlannedQuantity(e.target.value)}
                required
              />

              <Select
                label="Tracking Mode *"
                value={trackingMode}
                onChange={(e) => setTrackingMode(e.target.value)}
                required
              >
                <option value="BATCH">BATCH (Default bulk tracking)</option>
                <option value="SERIAL">
                  SERIAL (Aerospace mode - every unit tracked)
                </option>
              </Select>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Customer / Client Name"
                  placeholder="e.g. Boeing Defense"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
                <Input
                  label="Customer Email (Optional)"
                  type="email"
                  placeholder="e.g. client@company.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>

              <Input
                label="Promised Dispatch Date"
                type="datetime-local"
                value={promisedDispatchDate}
                onChange={(e) => setPromisedDispatchDate(e.target.value)}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Planned Start Date *"
                  type="datetime-local"
                  value={plannedStartDate}
                  onChange={(e) => setPlannedStartDate(e.target.value)}
                  required
                />
                <Input
                  label="Planned End Date *"
                  type="datetime-local"
                  value={plannedEndDate}
                  onChange={(e) => setPlannedEndDate(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-6">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={submitting}>
                  Create Work Order
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
