"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { format, addDays, subDays, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";

export default function ClientReportControls({
  initialDate,
}: {
  initialDate: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Date format: YYYY-MM-DD
  const currentDate = searchParams.get("date") || initialDate;

  const navigateDate = (dateStr: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("date", dateStr);
    router.push(`/reports/daily?${params.toString()}`);
  };

  const handlePrevDay = () => {
    const newDate = format(subDays(parseISO(currentDate), 1), "yyyy-MM-dd");
    navigateDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = format(addDays(parseISO(currentDate), 1), "yyyy-MM-dd");
    navigateDate(newDate);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="print:hidden mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg">
      <div className="flex items-center gap-4">
        <button
          onClick={handlePrevDay}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center">
          <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Report Date
          </span>
          <input
            type="date"
            value={currentDate}
            onChange={(e) => navigateDate(e.target.value)}
            className="bg-transparent text-white font-bold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 text-center"
          />
        </div>

        <button
          onClick={handleNextDay}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <button
        onClick={handlePrint}
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-md shadow-blue-600/20 transition-colors"
      >
        <Printer className="w-5 h-5" />
        Download PDF
      </button>
    </div>
  );
}
