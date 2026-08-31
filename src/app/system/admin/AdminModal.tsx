"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

type AdminModalProps = {
  entity: string;
  initialData: any | null;
  onClose: () => void;
  onSaved: () => void;
  metadata?: any;
};

export default function AdminModal({
  entity,
  initialData,
  onClose,
  onSaved,
  metadata,
}: AdminModalProps) {
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hardcoded options for simplicity in dropdowns for this example.
  // In a real app, these would be fetched or passed as props.
  const downtimeCategories = [
    "MECHANICAL",
    "ELECTRICAL",
    "MATERIAL",
    "QUALITY",
    "OPERATOR",
  ];
  const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const roles = ["ADMIN", "SUPERVISOR", "OPERATOR"];
  const levels = ["WORKER", "MANAGER"];
  const workOrderStatuses = ["PLANNED", "IN_PROGRESS", "COMPLETED", "ON_HOLD"];

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      // Set defaults based on entity
      const defaults: any = { isActive: true };
      if (entity === "users") {
        defaults.role = "OPERATOR";
        defaults.level = "WORKER";
      }
      if (entity === "machines") defaults.idealCycleTimeSeconds = 60;
      if (entity === "downtimeReasons") defaults.category = "MECHANICAL";
      if (entity === "defectCodes") defaults.severity = "MEDIUM";
      if (entity === "workOrders") {
        defaults.status = "PLANNED";
        defaults.plannedQuantity = 1000;
        defaults.plannedStartDate = new Date().toISOString().split("T")[0];
        defaults.plannedEndDate = new Date(Date.now() + 86400000 * 7)
          .toISOString()
          .split("T")[0];
      }
      setFormData(defaults);
    }
  }, [entity, initialData]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Some basic conversions
    const submitData = { ...formData };
    if (entity === "machines" && submitData.idealCycleTimeSeconds) {
      submitData.idealCycleTimeSeconds = parseFloat(
        submitData.idealCycleTimeSeconds,
      );
    }
    if (entity === "products" && submitData.targetCycleTimeSeconds) {
      submitData.targetCycleTimeSeconds = parseFloat(
        submitData.targetCycleTimeSeconds,
      );
    }
    if (entity === "workOrders") {
      if (submitData.plannedQuantity)
        submitData.plannedQuantity = parseInt(submitData.plannedQuantity, 10);
      if (submitData.setupTimeMinutes)
        submitData.setupTimeMinutes = parseFloat(submitData.setupTimeMinutes);
      else submitData.setupTimeMinutes = null;
      if (submitData.cycleTimeSeconds)
        submitData.cycleTimeSeconds = parseFloat(submitData.cycleTimeSeconds);
      else submitData.cycleTimeSeconds = null;
      if (submitData.plannedStartDate)
        submitData.plannedStartDate = new Date(
          submitData.plannedStartDate,
        ).toISOString();
      if (submitData.plannedEndDate)
        submitData.plannedEndDate = new Date(
          submitData.plannedEndDate,
        ).toISOString();
    }

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity,
          action: initialData ? "update" : "create",
          data: submitData,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to save");
      }

      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderFields = () => {
    switch (entity) {
      case "plants":
        return (
          <>
            <Field label="Name" field="name" type="text" />
            <Field label="Code" field="code" type="text" />
            <Field label="City" field="city" type="text" />
          </>
        );
      case "machines":
        return (
          <>
            <Field label="Name" field="name" type="text" />
            <Field label="Code" field="code" type="text" />
            {metadata?.plants && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Plant
                </label>
                <select
                  required
                  value={formData.plantId || ""}
                  onChange={(e) => handleChange("plantId", e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="" disabled>
                    Select Plant
                  </option>
                  {metadata.plants.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {metadata?.lines && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Line
                </label>
                <select
                  value={formData.lineId || ""}
                  onChange={(e) => handleChange("lineId", e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">No Line</option>
                  {metadata.lines.map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Field
              label="Ideal Cycle Time (s)"
              field="idealCycleTimeSeconds"
              type="number"
              step="0.1"
            />
          </>
        );
      case "users":
        return (
          <>
            <Field label="Name" field="name" type="text" />
            <Field
              label="Employee No."
              field="employeeNumber"
              type="text"
              inputMode="numeric"
              required={!initialData}
            />
            <Field label="Username" field="username" type="text" />
            <Field label="Email" field="email" type="email" />
            <SelectField label="Role" field="role" options={roles} />
            <SelectField label="Level" field="level" options={levels} />
            {!initialData && (
              <Field label="Temporary Password" field="password" type="text" />
            )}
            <div className="mb-4 flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                id="mustChangePassword"
                checked={formData.mustChangePassword || false}
                onChange={(e) =>
                  handleChange("mustChangePassword", e.target.checked)
                }
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
              />
              <label
                htmlFor="mustChangePassword"
                className="text-sm font-medium text-slate-300"
              >
                Must change password on next login
              </label>
            </div>
          </>
        );
      case "products":
        return (
          <>
            <Field label="SKU" field="sku" type="text" />
            <Field label="Name" field="name" type="text" />
            <Field label="Description" field="description" type="text" />
            <Field
              label="Target Cycle Time (s)"
              field="targetCycleTimeSeconds"
              type="number"
              step="0.1"
            />
          </>
        );
      case "lines":
        return (
          <>
            <Field label="Name" field="name" type="text" />
            {metadata?.plants && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Plant
                </label>
                <select
                  required
                  value={formData.plantId || ""}
                  onChange={(e) => handleChange("plantId", e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="" disabled>
                    Select Plant
                  </option>
                  {metadata.plants.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        );
      case "shifts":
        return (
          <>
            <Field label="Name" field="name" type="text" />
            <Field label="Start Time (HH:MM)" field="startTime" type="text" />
            <Field label="End Time (HH:MM)" field="endTime" type="text" />
          </>
        );
      case "downtimeReasons":
        return (
          <>
            <Field label="Code" field="code" type="text" />
            <Field label="Description" field="description" type="text" />
            <Field label="Telugu Name (Optional)" field="nameTe" type="text" />
            <Field label="Hindi Name (Optional)" field="nameHi" type="text" />
            <SelectField
              label="Category"
              field="category"
              options={downtimeCategories}
            />
          </>
        );
      case "defectCodes":
        return (
          <>
            <Field label="Code" field="code" type="text" />
            <Field label="Description" field="description" type="text" />
            <Field label="Telugu Name (Optional)" field="nameTe" type="text" />
            <Field label="Hindi Name (Optional)" field="nameHi" type="text" />
            <SelectField
              label="Severity"
              field="severity"
              options={severities}
            />
          </>
        );
      case "workOrders":
        return (
          <>
            <Field label="WO Number" field="woNumber" type="text" />
            {metadata?.plants && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Plant
                </label>
                <select
                  required
                  value={formData.plantId || ""}
                  onChange={(e) => handleChange("plantId", e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="" disabled>
                    Select Plant
                  </option>
                  {metadata.plants.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {metadata?.products && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Product
                </label>
                <select
                  required
                  value={formData.productId || ""}
                  onChange={(e) => handleChange("productId", e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="" disabled>
                    Select Product
                  </option>
                  {metadata.products.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Field
              label="Planned Quantity"
              field="plannedQuantity"
              type="number"
            />
            <SelectField
              label="Status"
              field="status"
              options={workOrderStatuses}
            />
            <Field
              label="Planned Start Date"
              field="plannedStartDate"
              type="date"
            />
            <Field
              label="Planned End Date"
              field="plannedEndDate"
              type="date"
            />
            <Field
              label="Setup Time (Minutes) - Override"
              field="setupTimeMinutes"
              type="number"
              step="0.1"
            />
            <Field
              label="Cycle Time (Seconds) - Override"
              field="cycleTimeSeconds"
              type="number"
              step="0.1"
            />
          </>
        );
      case "operations":
        return (
          <>
            <Field label="Code (e.g. OP10)" field="code" type="text" />
            <Field label="Name" field="name" type="text" />
            <Field
              label="Default Cycle Time (s)"
              field="defaultCycleTimeSeconds"
              type="number"
              step="0.1"
            />
          </>
        );
      case "routingSteps":
        return (
          <>
            <Field label="Product ID" field="productId" type="text" />
            <Field label="Operation ID" field="operationId" type="text" />
            <Field label="Sequence (seq)" field="seq" type="number" />
            <Field label="Station Name" field="stationName" type="text" />
            <Field
              label="Std Cycle Time Override (s)"
              field="standardCycleTimeSeconds"
              type="number"
              step="0.1"
            />

            <div className="mb-4">
              <label className="flex items-center space-x-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={!!formData.isHoldPoint}
                  onChange={(e) =>
                    handleChange("isHoldPoint", e.target.checked)
                  }
                  className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm font-medium">Is Hold Point?</span>
              </label>
            </div>

            {formData.isHoldPoint && (
              <Field
                label="Hold Authority (e.g., DSA, CEMILAC, CUSTOMER QA)"
                field="holdAuthority"
                type="text"
              />
            )}
          </>
        );
      default:
        return null;
    }
  };

  // Helper for text/number inputs
  const Field = ({
    label,
    field,
    type,
    step,
    required = true,
    inputMode,
  }: {
    label: string;
    field: string;
    type: string;
    step?: string;
    required?: boolean;
    inputMode?: "numeric" | "text";
  }) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-slate-300 mb-1">
        {label}
      </label>
      <input
        type={type}
        step={step}
        required={required}
        inputMode={inputMode}
        value={formData[field] || ""}
        onChange={(e) => handleChange(field, e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
      />
    </div>
  );

  // Helper for selects
  const SelectField = ({
    label,
    field,
    options,
  }: {
    label: string;
    field: string;
    options: string[];
  }) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-slate-300 mb-1">
        {label}
      </label>
      <select
        required
        value={formData[field] || ""}
        onChange={(e) => handleChange(field, e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
      >
        <option value="" disabled>
          Select {label}
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50">
          <h3 className="text-lg font-bold text-white capitalize">
            {initialData ? "Edit" : "Add"}{" "}
            {entity.replace(/([A-Z])/g, " $1").trim()}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          {renderFields()}

          {entity !== "workOrders" && entity !== "routingSteps" && (
            <div className="mb-6 flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive ?? true}
                onChange={(e) => handleChange("isActive", e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
              />
              <label
                htmlFor="isActive"
                className="text-sm font-medium text-slate-300"
              >
                Is Active
              </label>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
