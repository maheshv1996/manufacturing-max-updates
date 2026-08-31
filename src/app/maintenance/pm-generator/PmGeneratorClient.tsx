"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  Wrench,
  CheckCircle2,
} from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";

interface PmScheduleItem {
  machineId: string;
  code: string;
  name: string;
  runningHours: number;
  nextPmHours: number;
  hoursRemaining: number;
  tasks: string[];
  dueStatus: string;
}

export default function PmGeneratorClient() {
  const [schedules, setSchedules] = useState<PmScheduleItem[]>([]);

  const fetchSchedules = async () => {
    try {
      const res = await fetch("/api/maintenance/pm-generator");
      const data = await res.json();
      if (data?.success && data.schedules) {
        setSchedules(data.schedules);
      }
    } catch (err) {
      logClientError(err, "PmGeneratorClient");
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleGeneratePm = async (machineId: string, code: string) => {
    soundFx.playClick();
    try {
      const res = await fetch("/api/maintenance/pm-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId, machineCode: code }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to generate PM");
      soundFx.playSuccess();
      toast.success(data.message);
      fetchSchedules();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-950/40 via-blue-950/30 to-slate-950/40 border border-amber-500/20 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-mono font-bold border border-amber-500/30 flex items-center gap-1">
              <Wrench className="w-3 h-3" />
              <span>SPINDLE-HOUR PM ENGINE</span>
            </span>
            <span className="text-xs text-white/50 font-mono">AUTOMATED PREVENTIVE MAINTENANCE</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Preventive Maintenance Schedule & Auto-Generator
          </h1>
          <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
            Tracks real-time CNC spindle runtime hours and automatically triggers 250h, 500h, and 1,000h scheduled service checklists to avoid catastrophic tool and bearing failures.
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schedules.map((item) => (
          <div
            key={item.machineId}
            className="p-5 rounded-3xl bg-white/[0.02] border border-white/10 hover:border-amber-500/40 transition-all flex flex-col justify-between gap-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono text-cyan-300 font-bold block">{item.code}</span>
                  <h3 className="font-black text-sm text-white">{item.name}</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500/20 text-amber-200 border border-amber-500/30">
                  {item.hoursRemaining}h to PM
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1 font-mono text-[10px]">
                <div className="flex items-center justify-between text-white/60">
                  <span>Runtime: {item.runningHours}h</span>
                  <span>Target: {item.nextPmHours}h</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-amber-400 rounded-full"
                    style={{ width: `${(item.runningHours / item.nextPmHours) * 100}%` }}
                  />
                </div>
              </div>

              {/* Checklist */}
              <div className="space-y-1.5 pt-2">
                <span className="text-[10px] font-mono font-bold text-white/50 uppercase">Mandatory Service Items:</span>
                {item.tasks.map((t, idx) => (
                  <div key={idx} className="text-[11px] text-white/70 flex items-start gap-1.5 leading-tight">
                    <CheckCircle2 className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-end">
              <button
                onClick={() => handleGeneratePm(item.machineId, item.code)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Issue PM Work Order</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
