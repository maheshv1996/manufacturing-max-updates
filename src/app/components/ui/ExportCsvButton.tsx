"use client";

import { Download } from "lucide-react";
import { exportToCsv } from "@/lib/exportUtils";
import { soundFx } from "@/lib/soundFx";
import { toast } from "@/lib/toastStore";

export default function ExportCsvButton({
  data,
  filename,
  label = "Export CSV",
}: {
  data: Record<string, any>[];
  filename: string;
  label?: string;
}) {
  const handleExport = () => {
    if (!data || data.length === 0) {
      toast.error("No data available to export");
      return;
    }
    exportToCsv(data, filename);
    soundFx.playClick();
    toast.success(`Exported ${data.length} records to ${filename}.csv`);
  };

  return (
    <button
      onClick={handleExport}
      className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-mono font-bold border border-white/10 transition-colors flex items-center gap-2 cursor-pointer shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
    >
      <Download className="w-3.5 h-3.5 text-cyan-400" />
      <span>{label}</span>
    </button>
  );
}
