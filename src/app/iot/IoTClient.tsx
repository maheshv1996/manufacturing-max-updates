"use client";

import { useState, useEffect } from "react";
import { Play, Square, Activity, Cpu } from "lucide-react";

export default function IoTClient({ machines }: { machines: any[] }) {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(async () => {
        // Pick a random machine
        const machine = machines[Math.floor(Math.random() * machines.length)];
        if (!machine) return;

        // Generate random state
        const rand = Math.random();
        let state = "RUNNING";
        if (rand > 0.75 && rand <= 0.9) {
          state = "IDLE";
        } else if (rand > 0.9) {
          state = "FAULT";
        }

        const logMsg = `[${new Date().toLocaleTimeString()}] ${machine.code} -> ${state}`;

        try {
          const res = await fetch("/api/iot/ping", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              machineId: machine.id,
              state,
              cycleCount: Math.floor(Math.random() * 10),
            }),
          });

          if (res.ok) {
            setLogs((prev) => [logMsg, ...prev].slice(0, 50));
          } else {
            setLogs((prev) =>
              [
                `[${new Date().toLocaleTimeString()}] ${machine.code} -> FAILED TO PING`,
                ...prev,
              ].slice(0, 50),
            );
          }
        } catch (err) {
          setLogs((prev) =>
            [
              `[${new Date().toLocaleTimeString()}] ${machine.code} -> ERROR PINGING`,
              ...prev,
            ].slice(0, 50),
          );
        }
      }, 3000); // every 3 seconds
    }
    return () => clearInterval(interval);
  }, [isRunning, machines]);

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Cpu className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold text-slate-100">
              Telemetry Simulator
            </h2>
          </div>
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors ${
              isRunning
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30"
            }`}
          >
            {isRunning ? (
              <>
                <Square className="w-4 h-4" /> Stop Simulation
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Start Simulation
              </>
            )}
          </button>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-sm overflow-y-auto h-96">
          {logs.length === 0 ? (
            <div className="text-slate-600 flex items-center justify-center h-full">
              Simulation stopped. No telemetry data.
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 ${
                    log.includes("FAULT")
                      ? "text-red-400"
                      : log.includes("IDLE")
                        ? "text-amber-400"
                        : log.includes("RUNNING")
                          ? "text-emerald-400"
                          : "text-slate-400"
                  }`}
                >
                  <Activity className="w-3 h-3 flex-shrink-0 opacity-50" />
                  <span>{log}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
