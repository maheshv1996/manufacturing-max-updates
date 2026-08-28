"use client";

import { useState } from "react";
import { X, UserCheck, Calendar } from "lucide-react";

export default function AssignModal({
  machine,
  operators,
  shifts,
  onClose,
  onSaved,
}: {
  machine: any;
  operators: any[];
  shifts: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [operatorId, setOperatorId] = useState(operators[0]?.id || "");
  const [shiftId, setShiftId] = useState(shifts[0]?.id || "");
  const [validTo, setValidTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorId || !shiftId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machineId: machine.id,
          operatorId,
          shiftId,
          validTo: validTo ? new Date(validTo).toISOString() : null,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to assign operator");
      }

      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-400" />
              Assign Operator
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Machine:{" "}
              <span className="font-semibold text-white">{machine.name}</span> (
              {machine.code})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="text-sm text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">
              Select Operator *
            </label>
            <select
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-blue-500"
            >
              {operators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.name} ({op.username || op.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">
              Select Shift *
            </label>
            <select
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-blue-500"
            >
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.startTime} - {s.endTime})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              Valid Until (Optional)
            </label>
            <input
              type="date"
              value={validTo}
              onChange={(e) => setValidTo(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/30 transition-all disabled:opacity-50"
            >
              {loading ? "Assigning..." : "Assign Operator"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
