"use client";

import { useRouter } from "next/navigation";

export default function YearPicker({ year }: { year: number }) {
  const router = useRouter();
  const years = [year - 1, year, year + 1];

  return (
    <select
      value={year}
      onChange={(e) =>
        router.push(`/reports/quality-calendar?year=${e.target.value}`)
      }
      className="bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-blue-500 print:hidden"
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  );
}
