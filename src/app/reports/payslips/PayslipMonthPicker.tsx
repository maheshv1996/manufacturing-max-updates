"use client";

import { useRouter } from "next/navigation";

export default function PayslipMonthPicker({
  months,
  current,
}: {
  months: string[];
  current: string;
}) {
  const router = useRouter();

  return (
    <select
      value={current}
      onChange={(e) =>
        router.push(
          `/reports/payslips?month=${encodeURIComponent(e.target.value)}`,
        )
      }
      className="bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-blue-500 print:hidden"
    >
      {months.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </select>
  );
}
