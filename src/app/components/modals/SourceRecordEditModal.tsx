"use client";

import { useState } from "react";
import { Edit2, X, Loader2, Save } from "lucide-react";

interface FieldSpec {
  key: string;
  label: string;
  type: "number" | "text" | "datetime" | "select";
  options?: { label: string; value: string }[];
  step?: string;
}

interface SourceRecordEditModalProps {
  entityType:
    | "ProductionLog"
    | "DowntimeLog"
    | "AttendanceLog"
    | "MovementLog"
    | "InventoryTransaction"
    | "QualityInspection"
    | "MaintenanceJob"
    | "ShiftHandover"
    | "ShiftCount"
    | "Tool"
    | "MaintenanceTool"
    | "PurchaseOrder"
    | "WorkOrder";
  entityId: string;
  title?: string;
  fields: FieldSpec[];
  initialValues: Record<string, any>;
  userRole?: string;
  onSaved: () => void;
}

export default function SourceRecordEditModal({
  entityType,
  entityId,
  title,
  fields,
  initialValues,
  userRole = "ADMIN",
  onSaved,
}: SourceRecordEditModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Format dates for datetime inputs if necessary
    const formatted: Record<string, any> = {};
    fields.forEach((f) => {
      let val = initialValues[f.key];
      if (f.type === "datetime" && val) {
        val = new Date(val).toISOString().slice(0, 16);
      }
      formatted[f.key] = val ?? "";
    });

    setFormValues(formatted);
    setReason("");
    setIsOpen(true);
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const updates: Record<string, any> = {};
      fields.forEach((f) => {
        let val = formValues[f.key];
        if (f.type === "number") {
          val = val !== "" ? Number(val) : 0;
        }
        updates[f.key] = val;
      });

      const res = await fetch("/api/admin/source-records/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          updates,
          reason,
        }),
      });

      if (res.ok) {
        setIsOpen(false);
        onSaved();
      } else {
        const err = await res.json();
        alert("Failed to edit record: " + (err.error || "Unknown error"));
      }
    } catch (e) {
      alert("Network error while saving edit");
    } finally {
      setSubmitting(false);
    }
  };

  if (userRole !== "ADMIN" && userRole !== "SUPERVISOR") {
    return null;
  }

  return (
    <>
      <button
        onClick={handleOpen}
        title={`Edit ${entityType}`}
        className="p-1 text-slate-400 hover:text-blue-500 hover:text-blue-400 rounded-lg hover:bg-slate-800/90 transition-colors cursor-pointer inline-flex items-center gap-1 text-xs"
      >
        <Edit2 className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 text-left text-white font-sans"
        >
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h3 className="text-lg font-black flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-500" />
                Edit {title || entityType}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    {f.label}
                  </label>

                  {f.type === "select" ? (
                    <select
                      value={formValues[f.key] ?? ""}
                      onChange={(e) =>
                        setFormValues({
                          ...formValues,
                          [f.key]: e.target.value,
                        })
                      }
                      className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-blue-500"
                    >
                      {f.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "datetime" ? (
                    <input
                      type="datetime-local"
                      value={formValues[f.key] ?? ""}
                      onChange={(e) =>
                        setFormValues({
                          ...formValues,
                          [f.key]: e.target.value,
                        })
                      }
                      className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500"
                    />
                  ) : (
                    <input
                      type={f.type}
                      step={f.step || (f.type === "number" ? "any" : undefined)}
                      value={formValues[f.key] ?? ""}
                      onChange={(e) =>
                        setFormValues({
                          ...formValues,
                          [f.key]: e.target.value,
                        })
                      }
                      className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                    />
                  )}
                </div>
              ))}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Reason for Edit (Audit Log)
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Correcting physical count mismatch"
                  className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-700 justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-800/60 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/30 flex items-center gap-1.5 cursor-pointer transition-all"
              >
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
