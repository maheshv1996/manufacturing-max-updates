"use client";

export default function MonthPicker({
  periods,
  current,
}: {
  periods: string[];
  current: string;
}) {
  return (
    <select
      defaultValue={current}
      onChange={(e) => {
        window.location.href = `/quality/cost-of-quality?period=${e.target.value}`;
      }}
      className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm font-bold"
    >
      {periods.map((m) => (
        <option key={m} value={m}>
          {new Date(
            Number(m.slice(0, 4)),
            Number(m.slice(5)) - 1,
            1,
          ).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        </option>
      ))}
    </select>
  );
}
