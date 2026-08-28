"use client";

import { useState } from "react";
import { Zap, Plus, Save } from "lucide-react";
import { format } from "date-fns";

export default function EnergyTab({
  energyData,
  defaultCost,
}: {
  energyData: any[];
  defaultCost: number;
}) {
  const [showModal, setShowModal] = useState(false);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [kwh, setKwh] = useState("");
  const [cost, setCost] = useState(defaultCost.toString());
  const [isSaving, setIsSaving] = useState(false);

  const totalCost = (parseFloat(kwh) || 0) * (parseFloat(cost) || 0);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/energy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: new Date(date).toISOString(),
          totalKwh: parseFloat(kwh),
          unitCostPerKwh: parseFloat(cost),
          totalCost: totalCost,
        }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        alert("Failed to save energy reading.");
      }
    } catch (e) {
      alert("Error saving energy reading.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Zap className="w-6 h-6 text-cyan-500" />
          Energy Tracking
        </h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Log Daily Meter Reading
        </button>
      </div>

      {/* Chart mock / Data list */}
      <div className="bg-slate-800/60 rounded-2xl border border-slate-700 p-6">
        <h3 className="font-bold text-slate-200 mb-4">Last 30 Days readings</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="text-xs uppercase bg-slate-800/60 text-slate-500 font-bold">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Date</th>
                <th className="px-4 py-3 text-right">Consumed (kWh)</th>
                <th className="px-4 py-3 text-right">Unit Rate (â‚¹/kWh)</th>
                <th className="px-4 py-3 text-right rounded-tr-lg">
                  Total Cost (â‚¹)
                </th>
              </tr>
            </thead>
            <tbody>
              {energyData.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No energy readings logged yet.
                  </td>
                </tr>
              ) : (
                energyData.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-700 hover:bg-slate-800/90/50"
                  >
                    <td className="px-4 py-3 font-medium text-white">
                      {format(new Date(r.date), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-cyan-400 font-bold">
                      {r.totalKwh.toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">
                      â‚¹{r.unitCostPerKwh.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-rose-400 font-bold">
                      â‚¹
                      {r.totalCost.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800/60 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/60">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyan-500" />
                Log Energy Reading
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  kWh Consumed
                </label>
                <input
                  type="number"
                  value={kwh}
                  onChange={(e) => setKwh(e.target.value)}
                  placeholder="e.g. 1450"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Unit Rate (â‚¹/kWh)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 font-mono"
                />
              </div>

              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-600">
                <div className="flex justify-between items-center text-sm font-bold text-slate-300">
                  <span>Total Calculated Cost:</span>
                  <span className="text-lg text-rose-400 font-black">
                    â‚¹{totalCost.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-800/60 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 text-slate-400 hover:text-white transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !kwh || !cost || !date}
                className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Saving..." : "Save Reading"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
