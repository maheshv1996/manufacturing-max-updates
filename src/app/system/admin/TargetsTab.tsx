"use client";
import { useState, useEffect } from "react";
import { Loader2, Save } from "lucide-react";

export default function TargetsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [machines, setMachines] = useState<any[]>([]);

  const [oeeRules, setOeeRules] = useState({
    plannedCategories: [] as string[],
    excludePlanned: false,
  });

  const categories = [
    "MECHANICAL",
    "ELECTRICAL",
    "MATERIAL",
    "QUALITY",
    "OPERATOR",
  ];

  const [graceMinutes, setGraceMinutes] = useState<number>(10);
  const [countTolerance, setCountTolerance] = useState<number>(0);
  const [laborRatePerHour, setLaborRatePerHour] = useState<number>(150);
  const [machineRatePerHour, setMachineRatePerHour] = useState<number>(300);
  const [otDailyThresholdHours, setOtDailyThresholdHours] = useState<number>(9);
  const [otMultiplier, setOtMultiplier] = useState<number>(2);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/data").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]).then(([adminData, settingsData]) => {
      if (adminData.machines) {
        setMachines(adminData.machines);
      }
      if (settingsData.oeeRules) {
        setOeeRules({
          plannedCategories: settingsData.oeeRules.plannedCategories || [],
          excludePlanned: settingsData.oeeRules.excludePlanned || false,
        });
      }
      if (settingsData.graceMinutes !== undefined) {
        setGraceMinutes(settingsData.graceMinutes);
      }
      if (settingsData.countTolerance !== undefined) {
        setCountTolerance(settingsData.countTolerance);
      }
      if (settingsData.laborRatePerHour !== undefined) {
        setLaborRatePerHour(settingsData.laborRatePerHour);
      }
      if (settingsData.machineRatePerHour !== undefined) {
        setMachineRatePerHour(settingsData.machineRatePerHour);
      }
      if (settingsData.otDailyThresholdHours !== undefined) {
        setOtDailyThresholdHours(settingsData.otDailyThresholdHours);
      }
      if (settingsData.otMultiplier !== undefined) {
        setOtMultiplier(settingsData.otMultiplier);
      }
      setLoading(false);
    });
  }, []);

  const handleMachineChange = (index: number, field: string, value: number) => {
    const updated = [...machines];
    updated[index] = { ...updated[index], [field]: value };
    setMachines(updated);
  };

  const handleCategoryToggle = (cat: string) => {
    const current = oeeRules.plannedCategories;
    const isSelected = current.includes(cat);

    if (isSelected) {
      setOeeRules({
        ...oeeRules,
        plannedCategories: current.filter((c) => c !== cat),
      });
    } else {
      setOeeRules({ ...oeeRules, plannedCategories: [...current, cat] });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save global OEE rules and Settings
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oeeRules,
          graceMinutes,
          countTolerance,
          laborRatePerHour,
          machineRatePerHour,
          otDailyThresholdHours,
          otMultiplier,
        }),
      });

      // Save machine targets
      for (const m of machines) {
        await fetch(`/api/machines/${m.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            oeeTarget: Number(m.oeeTarget),
            oeeGoodThreshold: Number(m.oeeGoodThreshold),
            oeeWarningThreshold: Number(m.oeeWarningThreshold),
          }),
        });
      }
      alert("Costing rates, targets, and rules saved successfully.");
    } catch (e) {
      alert("Failed to save targets");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* OEE Rules */}
      <div className="max-w-2xl bg-slate-800/60 shadow-sm border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-6">OEE Rules</h2>

        <div className="space-y-6">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={oeeRules.excludePlanned}
              onChange={(e) =>
                setOeeRules({ ...oeeRules, excludePlanned: e.target.checked })
              }
              className="w-5 h-5 rounded border-slate-300"
            />
            <span className="font-medium">
              Exclude planned downtime from Availability calculation
            </span>
          </label>

          <div>
            <label className="block text-sm font-medium mb-3">
              Select Downtime Categories considered PLANNED:
            </label>
            <div className="flex flex-wrap gap-3">
              {categories.map((cat) => (
                <label
                  key={cat}
                  className="flex items-center gap-2 bg-slate-800/60 px-3 py-2 rounded border border-slate-600 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={oeeRules.plannedCategories.includes(cat)}
                    onChange={() => handleCategoryToggle(cat)}
                    className="rounded border-slate-300"
                  />
                  <span>{cat}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-700 space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-200 mb-1">
                Attendance Grace Minutes (Default: 10)
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Operators clocking in after shift start time + grace minutes
                will be marked as LATE.
              </p>
              <input
                type="number"
                min="0"
                max="60"
                value={graceMinutes}
                onChange={(e) =>
                  setGraceMinutes(parseInt(e.target.value, 10) || 0)
                }
                className="w-32 border border-slate-600 rounded-xl px-3 py-2 bg-transparent text-white font-bold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-200 mb-1">
                Shift WIP Handoff Count Tolerance (Default: 0)
              </label>
              <p className="text-xs text-slate-500 mb-2">
                The maximum allowed difference between outgoing and incoming
                operator WIP counts for auto-agreement.
              </p>
              <input
                type="number"
                min="0"
                max="100"
                value={countTolerance}
                onChange={(e) =>
                  setCountTolerance(parseInt(e.target.value, 10) || 0)
                }
                className="w-32 border border-slate-600 rounded-xl px-3 py-2 bg-transparent text-white font-bold font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-700">
              <div>
                <label className="block text-sm font-bold text-slate-200 mb-1">
                  Labor Rate (₹ / Hour)
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Standard hourly labor rate applied across logged operator work
                  hours. (Default: 150)
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={laborRatePerHour}
                    onChange={(e) =>
                      setLaborRatePerHour(parseFloat(e.target.value) || 0)
                    }
                    className="w-36 border border-slate-600 rounded-xl px-3 py-2 bg-transparent text-white font-bold font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-200 mb-1">
                  Machine Operating Rate (₹ / Hour)
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Standard hourly machine run cost applied across station
                  operating hours. (Default: 300)
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="25"
                    value={machineRatePerHour}
                    onChange={(e) =>
                      setMachineRatePerHour(parseFloat(e.target.value) || 0)
                    }
                    className="w-36 border border-slate-600 rounded-xl px-3 py-2 bg-transparent text-white font-bold font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-700">
              <div>
                <label className="block text-sm font-bold text-slate-200 mb-1">
                  OT Daily Threshold (Hours)
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Work beyond this many hours per day counts as overtime.
                  (Default: 9)
                </p>
                <input
                  type="number"
                  min="1"
                  max="24"
                  step="0.5"
                  value={otDailyThresholdHours}
                  onChange={(e) =>
                    setOtDailyThresholdHours(parseFloat(e.target.value) || 9)
                  }
                  className="w-32 border border-slate-600 rounded-xl px-3 py-2 bg-transparent text-white font-bold font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-200 mb-1">
                  OT Pay Multiplier
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  OT pay = OT hours × labor rate × this multiplier. (Default:
                  2)
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-400">×</span>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="0.5"
                    value={otMultiplier}
                    onChange={(e) =>
                      setOtMultiplier(parseFloat(e.target.value) || 2)
                    }
                    className="w-24 border border-slate-600 rounded-xl px-3 py-2 bg-transparent text-white font-bold font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Machine Targets */}
      <div className="bg-slate-800/60 shadow-sm border border-slate-700 rounded-lg p-6 overflow-x-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Machine Targets & Thresholds</h2>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded var-accent-bg"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Targets & Rules
          </button>
        </div>

        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-500">
              <th className="pb-3 font-medium">Machine</th>
              <th className="pb-3 font-medium">OEE Target (%)</th>
              <th className="pb-3 font-medium">Good Threshold (≥)</th>
              <th className="pb-3 font-medium">Warning Threshold (≥)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 divide-slate-800">
            {machines.map((m, idx) => (
              <tr key={m.id} className="hover:bg-slate-800/90/50">
                <td className="py-3 font-medium">
                  {m.name} ({m.code})
                </td>
                <td className="py-3">
                  <input
                    type="number"
                    value={m.oeeTarget ?? 85}
                    onChange={(e) =>
                      handleMachineChange(
                        idx,
                        "oeeTarget",
                        parseFloat(e.target.value),
                      )
                    }
                    className="w-24 border border-slate-600 rounded p-1.5 bg-transparent"
                  />
                </td>
                <td className="py-3">
                  <input
                    type="number"
                    value={m.oeeGoodThreshold ?? 85}
                    onChange={(e) =>
                      handleMachineChange(
                        idx,
                        "oeeGoodThreshold",
                        parseFloat(e.target.value),
                      )
                    }
                    className="w-24 border border-slate-600 rounded p-1.5 bg-transparent"
                  />
                </td>
                <td className="py-3">
                  <input
                    type="number"
                    value={m.oeeWarningThreshold ?? 70}
                    onChange={(e) =>
                      handleMachineChange(
                        idx,
                        "oeeWarningThreshold",
                        parseFloat(e.target.value),
                      )
                    }
                    className="w-24 border border-slate-600 rounded p-1.5 bg-transparent"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
