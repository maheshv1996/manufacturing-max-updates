"use client";

import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Settings2,
  Eye,
  EyeOff,
  RotateCcw,
} from "lucide-react";

export interface DashboardWidgetConfig {
  id: string;
  title: string;
  category: "operations" | "quality" | "supply" | "maintenance" | "energy";
  enabled: boolean;
  order: number;
}

const DEFAULT_WIDGETS: DashboardWidgetConfig[] = [
  { id: "oee_live", title: "Live Factory OEE", category: "operations", enabled: true, order: 1 },
  { id: "active_wos", title: "Active Work Orders", category: "operations", enabled: true, order: 2 },
  { id: "machine_health", title: "Machine Center Health", category: "maintenance", enabled: true, order: 3 },
  { id: "quality_pass", title: "First Pass Quality (FPY)", category: "quality", enabled: true, order: 4 },
  { id: "energy_kwh", title: "Real-Time Power & Carbon", category: "energy", enabled: true, order: 5 },
  { id: "mrp_shortages", title: "MRP Critical Shortages", category: "supply", enabled: true, order: 6 },
];

export interface CustomizableWidgetGridProps {
  children?: React.ReactNode;
  onConfigChange?: (widgets: DashboardWidgetConfig[]) => void;
}

export default function CustomizableWidgetGrid({
  children,
  onConfigChange,
}: CustomizableWidgetGridProps) {
  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>(DEFAULT_WIDGETS);
  const [isCustomizing, setIsCustomizing] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("mfg_dashboard_widgets");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWidgets(parsed);
          onConfigChange?.(parsed);
        }
      }
    } catch {}
  }, []);

  const toggleWidget = (id: string) => {
    const updated = widgets.map((w) =>
      w.id === id ? { ...w, enabled: !w.enabled } : w
    );
    setWidgets(updated);
    try {
      localStorage.setItem("mfg_dashboard_widgets", JSON.stringify(updated));
    } catch {}
    onConfigChange?.(updated);
  };

  const resetWidgets = () => {
    setWidgets(DEFAULT_WIDGETS);
    try {
      localStorage.setItem("mfg_dashboard_widgets", JSON.stringify(DEFAULT_WIDGETS));
    } catch {}
    onConfigChange?.(DEFAULT_WIDGETS);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-blue-400" />
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-300">
            Plant Command Tiles
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {isCustomizing && (
            <button
              onClick={resetWidgets}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white px-2 py-1 rounded-lg border border-slate-700 bg-slate-800/40 cursor-pointer transition-all"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Layout
            </button>
          )}
          <button
            onClick={() => setIsCustomizing(!isCustomizing)}
            className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
              isCustomizing
                ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20"
                : "bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-700"
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>{isCustomizing ? "Done Customizing" : "Customize Tiles"}</span>
          </button>
        </div>
      </div>

      {isCustomizing && (
        <div className="p-4 rounded-2xl glass-card border border-blue-500/30 bg-blue-950/20 animate-in fade-in duration-150 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-300">
              Toggle visibility of operational intelligence cards:
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              {widgets.filter((w) => w.enabled).length} of {widgets.length} active
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {widgets.map((widget) => (
              <button
                key={widget.id}
                onClick={() => toggleWidget(widget.id)}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  widget.enabled
                    ? "bg-slate-800/90 border-slate-600 text-white shadow-sm"
                    : "bg-slate-900/40 border-slate-800 text-slate-500 opacity-60 hover:opacity-100"
                }`}
              >
                <span className="truncate mr-2">{widget.title}</span>
                {widget.enabled ? (
                  <Eye className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
