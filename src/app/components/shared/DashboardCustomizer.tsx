"use client";

import { useState } from "react";
import { Settings2, X, Check, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface KpiCustomizerConfig {
  id: string;
  label: string;
  visible: boolean;
}

export interface SectionCustomizerConfig {
  id: string;
  label: string;
  visible: boolean;
}

export default function DashboardCustomizer({
  currentKpis,
  currentSections,
  onSave,
}: {
  currentKpis: KpiCustomizerConfig[];
  currentSections: SectionCustomizerConfig[];
  onSave: (
    kpis: KpiCustomizerConfig[],
    sections: SectionCustomizerConfig[],
  ) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [kpis, setKpis] = useState(currentKpis);
  const [sections, setSections] = useState(currentSections);

  const toggleKpi = (id: string) => {
    setKpis(kpis.map((k) => (k.id === id ? { ...k, visible: !k.visible } : k)));
  };

  const toggleSection = (id: string) => {
    setSections(
      sections.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s)),
    );
  };

  const handleSave = () => {
    onSave(kpis, sections);
    setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 transition-all shadow-sm group"
      >
        <Settings2 className="w-3.5 h-3.5 group-hover:rotate-45 transition-transform" />
        Customize Layout
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Settings2 className="w-5 h-5 text-blue-400" />
                    Personalize Workspace
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Toggle widgets on or off. The dashboard will automatically
                    fluidly adapt to fill empty space.
                  </p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* KPI Cards */}
                <div>
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4">
                    KPI Metric Cards
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {kpis.map((k) => (
                      <button
                        key={k.id}
                        onClick={() => toggleKpi(k.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border text-sm font-bold transition-all ${
                          k.visible
                            ? "bg-blue-500/10 border-blue-500/30 text-blue-100"
                            : "bg-slate-800 border-slate-700 text-slate-500"
                        }`}
                      >
                        <span className="uppercase truncate pr-2">
                          {k.label}
                        </span>
                        {k.visible ? (
                          <Check className="w-4 h-4 text-blue-400 shrink-0" />
                        ) : (
                          <EyeOff className="w-4 h-4 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Main Sections */}
                {sections.length > 0 && (
                  <div>
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4">
                      Dashboard Sections
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {sections.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => toggleSection(s.id)}
                          className={`flex items-center justify-between p-4 rounded-xl border text-sm font-bold transition-all ${
                            s.visible
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-100"
                              : "bg-slate-800 border-slate-700 text-slate-500"
                          }`}
                        >
                          <span className="capitalize">{s.label}</span>
                          {s.visible ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-slate-800 bg-slate-900 flex justify-end gap-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                >
                  <Check className="w-4 h-4" /> Save Layout
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
