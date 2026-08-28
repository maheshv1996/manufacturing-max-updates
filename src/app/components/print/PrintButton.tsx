"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-200 bg-slate-800/60 border border-slate-700 rounded-xl hover:bg-slate-800/90 transition-colors shadow-sm no-print"
      title="Print Report"
    >
      <Printer className="w-4 h-4" />
      <span className="hidden sm:inline">Print</span>
    </button>
  );
}
