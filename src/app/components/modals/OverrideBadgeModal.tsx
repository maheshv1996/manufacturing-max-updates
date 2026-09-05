"use client";

import { useState, useEffect } from "react";
import { Edit2, RotateCcw, X, Loader2, Check } from "lucide-react";

interface OverrideBadgeModalProps {
  entityType: string;
  entityId: string;
  field: string;
  fieldLabel: string;
  currentCalculatedValue: number;
  existingOverride?: {
    value: number;
    note?: string;
    byName?: string;
  } | null;
  unit?: string;
  userRole?: string;
  onOverrideSaved: () => void;
}

export default function OverrideBadgeModal({
  entityType,
  entityId,
  field,
  fieldLabel,
  currentCalculatedValue,
  existingOverride,
  unit = "",
  userRole = "ADMIN",
  onOverrideSaved,
}: OverrideBadgeModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [valueInput, setValueInput] = useState<string>(
    existingOverride
      ? String(existingOverride.value)
      : String(currentCalculatedValue),
  );
  const [noteInput, setNoteInput] = useState<string>(
    existingOverride?.note || "",
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const isOverridden = Boolean(existingOverride);

  const handleSave = async () => {
    if (valueInput === "" || isNaN(Number(valueInput))) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          field,
          value: Number(valueInput),
          note: noteInput,
        }),
      });
      if (res.ok) {
        setIsOpen(false);
        onOverrideSaved();
      } else {
        const err = await res.json();
        alert("Failed to save override: " + (err.error || "Unknown error"));
      }
    } catch (e) {
      alert("Network error while saving override");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/overrides?entityType=${entityType}&entityId=${entityId}&field=${field}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        setIsOpen(false);
        onOverrideSaved();
      } else {
        alert("Failed to clear override");
      }
    } catch (e) {
      alert("Network error while clearing override");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Badge & Trigger Button */}
      <div className="inline-flex items-center gap-1.5 align-middle ml-1.5">
        {isOverridden && (
          <span
            title={`Overridden by ${existingOverride?.byName || "Admin"}: ${existingOverride?.note || "No note"}`}
            className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30"
          >
            overridden
          </span>
        )}
        {userRole === "ADMIN" && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setValueInput(
                existingOverride
                  ? String(existingOverride.value)
                  : String(currentCalculatedValue),
              );
              setNoteInput(existingOverride?.note || "");
              setIsOpen(true);
            }}
            type="button"
            title="Manual Override (Admin)"
            aria-label={`Manual override ${fieldLabel} (Admin)`}
            className="p-1 text-slate-400 hover:text-blue-500 hover:text-blue-400 rounded-lg hover:bg-slate-800/90 transition-colors cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="override-modal-title"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="bg-slate-800/60 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 text-left text-white"
          >
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h3 id="override-modal-title" className="text-lg font-black flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-500" />
                Manual Override: {fieldLabel}
              </h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close override modal"
                className="text-slate-400 hover:text-slate-600 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-800/60 p-3 rounded-xl text-xs space-y-1">
                <div>
                  <span className="text-slate-500">Calculated Value:</span>{" "}
                  <strong className="font-mono">
                    {currentCalculatedValue} {unit}
                  </strong>
                </div>
                {isOverridden && (
                  <div>
                    <span className="text-amber-500 font-bold">
                      Active Override:
                    </span>{" "}
                    <strong className="font-mono text-amber-400">
                      {existingOverride?.value} {unit}
                    </strong>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Manual Override Value ({unit || "Number"}) *
                </label>
                <input
                  type="number"
                  step="any"
                  value={valueInput}
                  onChange={(e) => setValueInput(e.target.value)}
                  className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-3.5 py-2.5 text-base font-bold font-mono text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Audit Reason / Note *
                </label>
                <textarea
                  rows={3}
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Reason for manual override (e.g., Sensor calibration drift adjustment)"
                  className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-700">
              {isOverridden && (
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={submitting}
                  className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear Override
                </button>
              )}

              <div className="flex-1 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-800/60 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={submitting || valueInput === ""}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/30 flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  {submitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Save Override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
