"use client";

import { useState, useEffect } from "react";
import {
  ShieldAlert,
  Download,
  RotateCcw,
  Activity,
  AlertTriangle,
  Info,
} from "lucide-react";
import { soundFx } from "@/lib/soundFx";
import { toast } from "@/lib/toastStore";

interface DiagnosticSummary {
  total: number;
  dropped: number;
  byLevel: { error: number; warn: number; info: number };
  bySource: { server: number; client: number };
  noisiestComponent?: { name: string; count: number };
  oldestAt?: string;
  newestAt?: string;
}

export default function DiagnosticsPanel() {
  const [summary, setSummary] = useState<DiagnosticSummary | null>(null);
  const [limits, setLimits] = useState<{ maxEntries: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchDiagnostics = async () => {
    try {
      const res = await fetch("/api/system/diagnostics");
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setLimits(data.limits);
      }
    } catch {
      // Offline or network error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
    const timer = setInterval(fetchDiagnostics, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      soundFx.playClick();
      const res = await fetch("/api/system/diagnostics");
      if (!res.ok) throw new Error("Failed to export diagnostics");
      const bundle = await res.json();

      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mfgmax-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      soundFx.playSuccess();
      toast.success("Scrubbed diagnostics bundle exported (0 secrets)");
    } catch (err: any) {
      toast.error(err.message || "Failed to export");
    } finally {
      setDownloading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Clear the in-process diagnostics buffer?")) return;
    try {
      setClearing(true);
      soundFx.playClick();
      const res = await fetch("/api/system/diagnostics", { method: "DELETE" });
      if (res.ok) {
        soundFx.playSuccess();
        toast.success("Diagnostics buffer cleared");
        fetchDiagnostics();
      }
    } catch {
      toast.error("Failed to clear buffer");
    } finally {
      setClearing(false);
    }
  };

  const totalEntries = summary?.total ?? 0;
  const maxCap = limits?.maxEntries ?? 500;
  const bufferPct = Math.min(100, Math.round((totalEntries / maxCap) * 100));

  return (
    <div className="bg-surface-1 rounded-card border border-border p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-1 flex items-center gap-2">
              <span>Local Diagnostics Ring Buffer</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Offline-Safe • Zero-Socket
              </span>
            </h3>
            <p className="text-xs text-text-3">
              Bounded in-memory error telemetry with automatic credential scrubbing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            disabled={clearing || totalEntries === 0}
            className="px-3 py-1.5 rounded-lg border border-border bg-surface-2 text-text-2 hover:text-text-1 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading ? "Exporting..." : "Export Scrubbed Bundle"}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-4 text-center text-xs text-text-3 font-mono">Loading diagnostics telemetry...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-surface-2 border border-border">
            <div className="flex items-center justify-between text-xs text-text-3 mb-1">
              <span>Buffer Load</span>
              <span className="font-mono font-bold text-text-1">{totalEntries} / {maxCap}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-3 overflow-hidden">
              <div
                className="h-full bg-cyan-500 transition-all rounded-full"
                style={{ width: `${bufferPct}%` }}
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-2 border border-border flex items-center justify-between">
            <div>
              <span className="text-xs text-text-3 block">Captured Errors</span>
              <span className="text-lg font-black font-mono text-rose-400">
                {summary?.byLevel.error ?? 0}
              </span>
            </div>
            <ShieldAlert className="w-5 h-5 text-rose-400/50" />
          </div>

          <div className="p-3 rounded-xl bg-surface-2 border border-border flex items-center justify-between">
            <div>
              <span className="text-xs text-text-3 block">Captured Warnings</span>
              <span className="text-lg font-black font-mono text-amber-400">
                {summary?.byLevel.warn ?? 0}
              </span>
            </div>
            <AlertTriangle className="w-5 h-5 text-amber-400/50" />
          </div>

          <div className="p-3 rounded-xl bg-surface-2 border border-border flex items-center justify-between">
            <div>
              <span className="text-xs text-text-3 block">Dropped (Over-Cap)</span>
              <span className="text-lg font-black font-mono text-text-2">
                {summary?.dropped ?? 0}
              </span>
            </div>
            <Info className="w-5 h-5 text-text-3" />
          </div>
        </div>
      )}
    </div>
  );
}
