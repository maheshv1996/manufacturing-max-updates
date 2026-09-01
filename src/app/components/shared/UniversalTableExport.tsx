"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Printer } from "lucide-react";

export interface UniversalTableExportProps {
  data: any[];
  fileName?: string;
  columns?: { key: string; label: string; format?: (val: any) => string }[];
}

export default function UniversalTableExport({
  data = [],
  fileName = "export-data",
  columns,
}: UniversalTableExportProps) {
  const [isExporting, setIsExporting] = useState(false);

  // Extract columns dynamically if not supplied
  const effectiveColumns: { key: string; label: string; format?: (val: any) => string }[] =
    columns && columns.length > 0
      ? columns
      : data.length > 0
      ? Object.keys(data[0])
          .filter((k) => typeof data[0][k] !== "object" || data[0][k] === null)
          .map((k) => ({
            key: k,
            label: k.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()),
          }))
      : [];

  const exportCSV = () => {
    if (!data || data.length === 0) return;
    setIsExporting(true);
    try {
      const headers = effectiveColumns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(",");
      const rows = data.map((item) =>
        effectiveColumns
          .map((col) => {
            const raw = col.format ? col.format(item[col.key]) : item[col.key];
            const str = raw === null || raw === undefined ? "" : String(raw);
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(",")
      );
      const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${fileName}-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsExporting(false);
    }
  };

  const exportJSON = () => {
    if (!data || data.length === 0) return;
    setIsExporting(true);
    try {
      const jsonString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
      const link = document.createElement("a");
      link.setAttribute("href", jsonString);
      link.setAttribute("download", `${fileName}-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="no-print flex items-center gap-2 flex-wrap">
      <button
        onClick={exportCSV}
        disabled={isExporting || data.length === 0}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-all cursor-pointer disabled:opacity-50"
        title="Export to CSV / Excel Spreadsheet"
      >
        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
        <span>Export CSV</span>
      </button>

      <button
        onClick={exportJSON}
        disabled={isExporting || data.length === 0}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-all cursor-pointer disabled:opacity-50"
        title="Download Raw JSON Schema"
      >
        <Download className="w-3.5 h-3.5 text-cyan-400" />
        <span>JSON</span>
      </button>

      <button
        onClick={handlePrint}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-all cursor-pointer"
        title="Print / Save Formatted PDF"
      >
        <Printer className="w-3.5 h-3.5 text-amber-400" />
        <span>Print PDF</span>
      </button>
    </div>
  );
}
