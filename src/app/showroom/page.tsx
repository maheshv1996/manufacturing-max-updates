"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Factory, AlertTriangle, ArrowUp } from "lucide-react";

const ThreeHero = dynamic(() => import("../components/shared/ThreeHero"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-slate-950 z-0"></div>,
});

const Counter = ({ to, duration = 1 }: { to: number; duration?: number }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    const start = count;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);

      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(start + (to - start) * easeOut));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [to, duration]); // Intentionally not including 'count' in deps to avoid loop

  return <span>{count}</span>;
};

// Fake Data Generators
const generateOEE = () => Math.floor(75 + Math.random() * 20);
const generateStatus = () => {
  const r = Math.random();
  if (r > 0.8) return "error";
  if (r > 0.6) return "warning";
  return "success";
};

export default function ShowroomPage() {
  const [oee, setOee] = useState(85);
  const [availability, setAvailability] = useState(92);
  const [performance, setPerformance] = useState(88);
  const [quality, setQuality] = useState(98);

  const [machines, setMachines] = useState([
    { id: "M1", name: "CNC-01", status: "success", yield: 99 },
    { id: "M2", name: "CNC-02", status: "warning", yield: 85 },
    { id: "M3", name: "Lathe-01", status: "success", yield: 95 },
    { id: "M4", name: "Mill-01", status: "error", yield: 60 },
  ]);

  const [alerts, setAlerts] = useState([
    { id: 1, message: "Material low on CNC-01", time: "Just now" },
  ]);

  useEffect(() => {
    // Loop random data updates every 3 seconds
    const interval = setInterval(() => {
      setOee(generateOEE());
      setAvailability(Math.floor(85 + Math.random() * 15));
      setPerformance(Math.floor(80 + Math.random() * 20));
      setQuality(Math.floor(95 + Math.random() * 5));

      setMachines((prev) =>
        prev.map((m) => ({
          ...m,
          status: Math.random() > 0.8 ? generateStatus() : m.status,
          yield: Math.min(
            100,
            Math.max(50, m.yield + Math.floor((Math.random() - 0.5) * 10)),
          ),
        })),
      );

      if (Math.random() > 0.6) {
        setAlerts((prev) => {
          const newAlerts = [
            {
              id: Date.now(),
              message: `Event on ${machines[Math.floor(Math.random() * machines.length)].name}: Status updated`,
              time: "Just now",
            },
            ...prev,
          ].slice(0, 3);
          return newAlerts;
        });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-200 overflow-hidden relative">
      {/* Cinematic Background */}
      <ThreeHero dimmed={true} />

      {/* Showroom UI Overlay */}
      <div className="relative z-10 max-w-7xl mx-auto p-8 h-screen flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="bg-slate-900/60 backdrop-blur-2xl border border-slate-700/50 rounded-3xl p-8 shadow-[0_0_60px_rgba(59,130,246,0.15)] flex flex-col gap-8"
        >
          {/* Header */}
          <div className="flex justify-between items-center border-b border-slate-800/50 pb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                <Factory className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white tracking-tight">
                  Live Command Center
                </h1>
                <p className="text-slate-400">Automated Showroom Demo</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="font-bold text-sm">SYSTEM ACTIVE</span>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-4 gap-6">
            {[
              {
                label: "OEE",
                value: oee,
                color: "text-blue-400",
                bg: "bg-blue-500/10",
                border: "border-blue-500/20",
              },
              {
                label: "Availability",
                value: availability,
                color: "text-emerald-400",
                bg: "bg-emerald-500/10",
                border: "border-emerald-500/20",
              },
              {
                label: "Performance",
                value: performance,
                color: "text-amber-400",
                bg: "bg-amber-500/10",
                border: "border-amber-500/20",
              },
              {
                label: "Quality",
                value: quality,
                color: "text-purple-400",
                bg: "bg-purple-500/10",
                border: "border-purple-500/20",
              },
            ].map((kpi, idx) => (
              <div
                key={idx}
                className={`p-6 rounded-2xl border ${kpi.border} ${kpi.bg} backdrop-blur-sm relative overflow-hidden group`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <h3 className="text-slate-300 font-medium mb-2">{kpi.label}</h3>
                <div className="flex items-end gap-2">
                  <span
                    className={`text-5xl font-black tabular-nums ${kpi.color}`}
                  >
                    <Counter to={kpi.value} />%
                  </span>
                  <span className="text-sm text-emerald-400 flex items-center mb-1">
                    <ArrowUp className="w-4 h-4" /> 2%
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Lower Section */}
          <div className="grid grid-cols-3 gap-6 flex-1">
            {/* Machine Status */}
            <div className="col-span-2 bg-slate-950/50 rounded-2xl border border-slate-800 p-6 flex flex-col gap-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" /> Machine Status
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {machines.map((m) => (
                  <div
                    key={m.id}
                    className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex justify-between items-center"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          m.status === "success"
                            ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"
                            : m.status === "warning"
                              ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]"
                              : "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]"
                        } animate-pulse`}
                      ></div>
                      <span className="font-bold text-slate-200">{m.name}</span>
                    </div>
                    <span className="text-slate-400 tabular-nums">
                      Yield: {m.yield}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerts Feed */}
            <div className="bg-slate-950/50 rounded-2xl border border-slate-800 p-6 flex flex-col gap-4 overflow-hidden">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" /> Live Alerts
              </h3>
              <div className="flex flex-col gap-3">
                <AnimatePresence initial={false}>
                  {alerts.map((alert) => (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, x: 20, height: 0 }}
                      animate={{ opacity: 1, x: 0, height: "auto" }}
                      exit={{ opacity: 0, x: -20, height: 0 }}
                      className="p-3 rounded-lg bg-rose-950/30 border border-rose-900/50 text-sm"
                    >
                      <div className="font-medium text-rose-200">
                        {alert.message}
                      </div>
                      <div className="text-rose-400/50 text-xs mt-1">
                        {alert.time}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
