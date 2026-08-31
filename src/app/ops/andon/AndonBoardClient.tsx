"use client";


import { logClientError } from "@/lib/clientLogger";
import { useEffect, useState } from "react";
import {
  Maximize,
  Minimize,
  Activity,
  AlertTriangle,
  PauseCircle,
  Wrench,
} from "lucide-react";

interface MachineAndon {
  id: string;
  name: string;
  code: string;
  plantName: string;
  status: "RUNNING" | "DOWN" | "IDLE" | "SETUP";
  downtimeReason: string | null;
  downtimeMinutes: number;
  workOrderNumber: string | null;
  productName: string | null;
  goodQuantity: number;
  plannedQuantity: number;
  iotEnabled?: boolean;
  currentState?: string;
}

export default function AndonBoardClient() {
  const [machines, setMachines] = useState<MachineAndon[]>([]);
  const [time, setTime] = useState<Date>(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fetchAndonData = async () => {
    try {
      const res = await fetch("/api/andon");
      if (res.ok) {
        const data = await res.json();
        setMachines(data);
      }
    } catch (err) {
      logClientError("Failed to fetch Andon data:", err, "page");
    }
  };

  useEffect(() => {
    fetchAndonData();
    const interval = setInterval(fetchAndonData, 10000); // 10s poll
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const clockInterval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        logClientError("Error attempting to enable fullscreen:", err, "page");
      });
      setIsFullscreen(true);
      const header = document.querySelector("header");
      if (header) header.style.display = "none";
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
      const header = document.querySelector("header");
      if (header) header.style.display = "";
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      const header = document.querySelector("header");
      if (header) header.style.display = isFull ? "none" : "";
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const plantName =
    machines.length > 0 ? machines[0].plantName : "Plant Network";
  const runningCount = machines.filter((m) => m.status === "RUNNING").length;
  const downCount = machines.filter((m) => m.status === "DOWN").length;
  const setupCount = machines.filter((m) => m.status === "SETUP").length;
  const idleCount = machines.filter((m) => m.status === "IDLE").length;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-2">
            LIVE ANDON BOARD
          </h1>
          <p className="text-xl text-slate-400 font-medium">{plantName}</p>
        </div>

        <div className="flex items-center gap-6">
          {/* Summary Chips */}
          <div className="flex gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-950/50 border border-emerald-800 text-emerald-400">
              <Activity className="w-6 h-6" />
              <span className="text-2xl font-bold">{runningCount}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <span className="text-2xl font-bold">{downCount}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-950/50 border border-amber-800 text-amber-400">
              <PauseCircle className="w-6 h-6" />
              <span className="text-2xl font-bold">{idleCount}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-950/50 border border-violet-800 text-violet-400">
              <Wrench className="w-6 h-6" />
              <span className="text-2xl font-bold">{setupCount}</span>
            </div>
          </div>

          <div className="text-4xl font-bold text-blue-400 tabular-nums">
            {time.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? (
              <Minimize className="w-6 h-6" />
            ) : (
              <Maximize className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Machine Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {machines.map((machine) => {
          const isDown = machine.status === "DOWN";
          const isRunning = machine.status === "RUNNING";
          const isSetup = machine.status === "SETUP";
          const isIdle = machine.status === "IDLE";
          const over15Min = isDown && machine.downtimeMinutes >= 15;

          let bgClass = "bg-slate-900 border-slate-700";
          let statusTextClass = "text-slate-400";

          if (isDown) {
            bgClass = over15Min
              ? "bg-rose-950 border-rose-600 animate-pulse"
              : "bg-rose-950/80 border-rose-700";
            statusTextClass = "text-rose-400";
          } else if (isRunning) {
            bgClass = "bg-emerald-950/40 border-emerald-800";
            statusTextClass = "text-emerald-400";
          } else if (isSetup) {
            bgClass = "bg-violet-950/40 border-violet-800";
            statusTextClass = "text-violet-400";
          } else if (isIdle) {
            bgClass = "bg-amber-950/40 border-amber-800";
            statusTextClass = "text-amber-400";
          }

          const progressPct =
            machine.plannedQuantity > 0
              ? Math.min(
                  100,
                  (machine.goodQuantity / machine.plannedQuantity) * 100,
                )
              : 0;

          return (
            <div
              key={machine.id}
              className={`rounded-3xl border-2 p-6 flex flex-col justify-between shadow-2xl transition-all ${bgClass}`}
              style={{ minHeight: "320px" }}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-4xl font-black text-white tracking-tight mb-1">
                    {machine.code}
                  </h2>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl text-slate-300 font-bold">
                      {machine.name}
                    </h3>
                    {machine.iotEnabled && (
                      <span className="px-2 py-1 text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 rounded flex items-center gap-1 uppercase tracking-wider">
                        <Activity className="w-3 h-3" /> IoT
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className={`text-3xl font-black uppercase tracking-widest px-4 py-2 rounded-xl border-2 bg-slate-950/50 ${statusTextClass}`}
                >
                  {machine.status}
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-end">
                {isDown && (
                  <div className="bg-rose-900/50 rounded-2xl p-4 border border-rose-700">
                    <p className="text-xl font-bold text-rose-200 mb-2 uppercase tracking-wide">
                      {machine.downtimeReason || "Unknown Reason"}
                    </p>
                    <p className="text-3xl font-black text-rose-400">
                      Down for {machine.downtimeMinutes} min
                    </p>
                  </div>
                )}

                {isRunning && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-lg font-bold text-emerald-200 truncate">
                        {machine.workOrderNumber} • {machine.productName}
                      </p>
                    </div>
                    <div>
                      <div className="flex justify-between text-xl font-bold text-emerald-100 mb-2">
                        <span>Output: {machine.goodQuantity}</span>
                        <span>Target: {machine.plannedQuantity}</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-6 overflow-hidden border border-slate-700">
                        <div
                          className="bg-emerald-500 h-6 transition-all duration-1000"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {isSetup && (
                  <div className="text-center py-6">
                    <p className="text-2xl font-bold text-violet-400/80 animate-pulse">
                      JOB SETUP IN PROGRESS
                    </p>
                  </div>
                )}

                {isIdle && (
                  <div className="text-center py-6">
                    <p className="text-2xl font-bold text-amber-400/80">
                      AWAITING JOB SETUP
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
