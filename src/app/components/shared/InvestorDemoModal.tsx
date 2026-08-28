"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, DollarSign, Zap, ArrowRight, X } from "lucide-react";
import { soundFx } from "@/lib/soundFx";
import { toast } from "@/lib/toastStore";

export default function InvestorDemoModal() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  // ROI Calculator Sliders
  const [machinesCount, setMachinesCount] = useState(12);
  const [downtimeHoursPerMonth, setDowntimeHoursPerMonth] = useState(24);
  const [hourlyDowntimeCost, setHourlyDowntimeCost] = useState(250);
  const [scrapCostMonthly, setScrapCostMonthly] = useState(15000);

  // Computed ROI
  const downtimeReductionPct = 0.45; // 45% reduction via predictive RUL
  const scrapReductionPct = 0.35; // 35% reduction via automated quality & FAI
  const annualDowntimeSavings = Math.round(
    machinesCount *
      (downtimeHoursPerMonth * 12) *
      hourlyDowntimeCost *
      (downtimeReductionPct / 5),
  );
  const annualScrapSavings = Math.round(
    scrapCostMonthly * 12 * scrapReductionPct,
  );
  const totalAnnualSavings = annualDowntimeSavings + annualScrapSavings;
  const estimatedPaybackMonths = Math.max(
    1.8,
    Math.min(6.5, 48000 / (totalAnnualSavings / 12)),
  ).toFixed(1);

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      soundFx.playSuccess();
    };
    window.addEventListener("open-investor-modal", handleOpen);
    return () => window.removeEventListener("open-investor-modal", handleOpen);
  }, []);

  if (!isOpen) return null;

  const demoTours = [
    {
      title: "1. 3D Digital Twin & Shopfloor MES",
      desc: "Physics-based workcell simulation, PLC ladder logic, and glove-operated tablet kiosk.",
      href: "/digital-twin/cell",
      color: "from-blue-500 to-indigo-600",
      tag: "OIP + MES",
    },
    {
      title: "2. Autonomous Industrial Multi-Agent Hub",
      desc: "Goal-driven specialized agents with autonomous tool execution across diagnostics, SCM, and AS9102 QA.",
      href: "/ai/agents",
      color: "from-purple-500 to-pink-600",
      tag: "Agentic Swarm",
    },
    {
      title: "3. ISA-95 UNS & Edge Automation",
      desc: "Unified Namespace (UMH), Node-RED visual flows, and MQTT Sparkplug B protocol.",
      href: "/iot/uns",
      color: "from-cyan-500 to-teal-600",
      tag: "UMH + Sparkplug",
    },
    {
      title: "4. Aerospace Quality & 360° Genealogy",
      desc: "Heat lot traceability, AS9102 First Article Inspection, and visual ECO approvals.",
      href: "/quality/genealogy",
      color: "from-emerald-500 to-green-600",
      tag: "AS9102 Trace",
    },
  ];

  const triggerShockSimulation = () => {
    soundFx.playWarning();
    toast.warning(
      "⚡ SIMULATED EVENT: Spindle Bearing Temperature Spike detected on CNC-02 (44.2°C). Automated Node-RED Edge Rule dispatched priority maintenance.",
    );
  };

  return (
    <div className="fixed inset-0 z-[160] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
      <div
        className="bg-surface-1 rounded-3xl shadow-2xl w-full max-w-4xl border-2 border-cyan-500/40 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-border bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 font-mono">
                  EXECUTIVE & INVESTOR DECK
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 font-mono">
                  HOT MVP LIVE
                </span>
              </div>
              <h2 className="text-xl font-black text-white">
                Apex Smart Manufacturing Enterprise Max
              </h2>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-xl hover:bg-surface-2 text-text-3 hover:text-text-1 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-8 space-y-8 overflow-y-auto flex-1">
          {/* Key Value Proposition & Market Traction Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-surface-2 border border-border/80 text-center">
              <span className="text-[10px] text-text-3 uppercase font-mono block">
                Plant OEE vs Avg
              </span>
              <span className="text-2xl font-black font-mono text-emerald-400">
                87.4%
              </span>
              <span className="text-[10px] text-text-3 block mt-0.5">
                +22% vs Industry 65%
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-surface-2 border border-border/80 text-center">
              <span className="text-[10px] text-text-3 uppercase font-mono block">
                Predictive Downtime
              </span>
              <span className="text-2xl font-black font-mono text-cyan-400">
                36 hrs
              </span>
              <span className="text-[10px] text-text-3 block mt-0.5">
                $72,000 saved / mo
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-surface-2 border border-border/80 text-center">
              <span className="text-[10px] text-text-3 uppercase font-mono block">
                Sparkplug B Savings
              </span>
              <span className="text-2xl font-black font-mono text-purple-400">
                86.4%
              </span>
              <span className="text-[10px] text-text-3 block mt-0.5">
                Report-by-exception
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-surface-2 border border-border/80 text-center">
              <span className="text-[10px] text-text-3 uppercase font-mono block">
                Quality First Yield
              </span>
              <span className="text-2xl font-black font-mono text-pink-400">
                99.6%
              </span>
              <span className="text-[10px] text-text-3 block mt-0.5">
                AS9102 compliant
              </span>
            </div>
          </div>

          {/* Interactive ROI & Payback Calculator */}
          <div className="p-6 rounded-3xl bg-slate-950 border border-cyan-500/30 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-extrabold text-base text-white">
                    Interactive Factory ROI & Payback Model
                  </h3>
                </div>
                <p className="text-xs text-text-3">
                  Simulate customer economic savings based on machine fleet size
                </p>
              </div>

              <div className="text-right font-mono">
                <span className="text-[10px] text-text-3 uppercase block">
                  Annual Unlocked Value
                </span>
                <span className="text-2xl font-black text-emerald-400">
                  ${totalAnnualSavings.toLocaleString()} / yr
                </span>
                <span className="text-xs text-cyan-300 font-bold block">
                  Payback: {estimatedPaybackMonths} Months
                </span>
              </div>
            </div>

            {/* Sliders Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between font-mono">
                  <span className="text-text-3">CNC Fleet</span>
                  <span className="text-white font-bold">
                    {machinesCount} Units
                  </span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="50"
                  value={machinesCount}
                  onChange={(e) => setMachinesCount(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between font-mono">
                  <span className="text-text-3">Downtime / Mo</span>
                  <span className="text-white font-bold">
                    {downtimeHoursPerMonth} hrs
                  </span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="60"
                  value={downtimeHoursPerMonth}
                  onChange={(e) =>
                    setDowntimeHoursPerMonth(Number(e.target.value))
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between font-mono">
                  <span className="text-text-3">Hourly Rate</span>
                  <span className="text-white font-bold">
                    ${hourlyDowntimeCost} / hr
                  </span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="500"
                  step="25"
                  value={hourlyDowntimeCost}
                  onChange={(e) =>
                    setHourlyDowntimeCost(Number(e.target.value))
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between font-mono">
                  <span className="text-text-3">Monthly Scrap</span>
                  <span className="text-white font-bold">
                    ${scrapCostMonthly.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min="2000"
                  max="50000"
                  step="1000"
                  value={scrapCostMonthly}
                  onChange={(e) => setScrapCostMonthly(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Guided 1-Click Investor Demo Tours */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-text-1">
                Interactive 1-Click Guided Demo Tours
              </h3>
              <button
                onClick={triggerShockSimulation}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-rose-400" />
                Simulate Thermal Shock Event
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {demoTours.map((tour, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setIsOpen(false);
                    soundFx.playClick();
                    router.push(tour.href);
                  }}
                  className="p-5 rounded-2xl bg-surface-2 hover:bg-surface-3 border border-border/80 hover:border-cyan-500/50 text-left transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-text-1 group-hover:text-cyan-300 transition-colors">
                        {tour.title}
                      </span>
                      <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300">
                        {tour.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-3 leading-relaxed">
                      {tour.desc}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 pt-3 group-hover:translate-x-1 transition-transform">
                    <span>Launch Live Interactive Suite</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-border/80 bg-slate-950 text-xs text-text-3 flex items-center justify-between font-mono">
          <span>Enterprise Aerospace MES & IIoT Platform</span>
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Close Deck
          </button>
        </div>
      </div>

      {/* Backdrop */}
      <div
        className="absolute inset-0 z-[-1]"
        onClick={() => setIsOpen(false)}
      />
    </div>
  );
}
