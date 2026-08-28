"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Filter } from "lucide-react";

export default function SpcFilterClient({
  machines,
  characteristics,
  currentMachineId,
  currentCharacteristic,
}: {
  machines: { id: string; name: string; code: string }[];
  characteristics: string[];
  currentMachineId: string;
  currentCharacteristic: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilters = (machineId: string, char: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (machineId) params.set("machineId", machineId);
    if (char) params.set("characteristic", char);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-end no-print mb-4">
      <div className="flex-1 w-full">
        <label className="block text-sm font-medium text-slate-400 mb-1">
          Machine
        </label>
        <select
          value={currentMachineId}
          onChange={(e) => updateFilters(e.target.value, currentCharacteristic)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-violet-500 focus:outline-none"
        >
          <option value="" disabled>
            Select Machine
          </option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.code})
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 w-full">
        <label className="block text-sm font-medium text-slate-400 mb-1">
          Characteristic
        </label>
        <select
          value={currentCharacteristic}
          onChange={(e) => updateFilters(currentMachineId, e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-violet-500 focus:outline-none"
        >
          <option value="" disabled>
            Select Characteristic
          </option>
          {characteristics.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 pt-2 sm:pt-0">
        <div className="flex items-center justify-center p-2.5 bg-slate-800 rounded-lg border border-slate-700">
          <Filter className="w-5 h-5 text-slate-400" />
        </div>
      </div>
    </div>
  );
}
