"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  ShieldCheck,
  Cpu,
} from "lucide-react";
import Link from "next/link";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";

interface WorkOrderCard {
  id: string;
  woNumber: string;
  plannedQuantity: number;
  priority: number;
  status: string;
  product: { name: string; sku: string };
}

export default function KanbanBoardClient() {
  const [lanes, setLanes] = useState<{ [key: string]: WorkOrderCard[] }>({
    BACKLOG: [],
    STAGED: [],
    IN_PROGRESS: [],
    QUALITY_GATE: [],
    COMPLETED: [],
  });

  const fetchKanban = async () => {
    try {
      const res = await fetch("/api/ops/kanban");
      const data = await res.json();
      if (data?.success && data.lanes) {
        setLanes(data.lanes);
      }
    } catch (err) {
      logClientError(err, "KanbanBoardClient");
    }
  };

  useEffect(() => {
    fetchKanban();
  }, []);

  const handleMoveLane = async (woId: string, currentLane: string, nextLane: string) => {
    soundFx.playClick();

    const card = lanes[currentLane]?.find((c) => c.id === woId);
    if (!card) return;

    setLanes({
      ...lanes,
      [currentLane]: lanes[currentLane].filter((c) => c.id !== woId),
      [nextLane]: [card, ...(lanes[nextLane] || [])],
    });

    try {
      const res = await fetch("/api/ops/kanban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workOrderId: woId, targetLane: nextLane }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to move work order");
      soundFx.playSuccess();
      toast.success(`Moved ${card.woNumber} to ${nextLane.replace("_", " ")}`);
    } catch (err: any) {
      toast.error(err.message);
      fetchKanban();
    }
  };

  const laneMeta = [
    { key: "BACKLOG", title: "1. Backlog & Orders", color: "border-slate-500/30 bg-slate-950/40 text-slate-300", wipLimit: 15 },
    { key: "STAGED", title: "2. Tooling & Stock Ready", color: "border-blue-500/30 bg-blue-950/30 text-blue-300", wipLimit: 8 },
    { key: "IN_PROGRESS", title: "3. In Spindle Machining", color: "border-amber-500/30 bg-amber-950/30 text-amber-300", wipLimit: 6 },
    { key: "QUALITY_GATE", title: "4. Quality Inspection Gate", color: "border-purple-500/30 bg-purple-950/30 text-purple-300", wipLimit: 4 },
    { key: "COMPLETED", title: "5. Completed & Packaged", color: "border-emerald-500/30 bg-emerald-950/30 text-emerald-300", wipLimit: 50 },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-slate-950/40 border border-blue-500/20 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-mono font-bold border border-blue-500/30">
              LEAN MANUFACTURING PULL SYSTEM
            </span>
            <span className="text-xs text-white/50 font-mono">ISA-95 LEVEL 3 SHOPFLOOR EXECUTION</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Visual Shopfloor Kanban Board & WIP Sentinel
          </h1>
          <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
            Drag and advance work orders across active CNC machining cells, fixture setups, quality gates, and dispatch with built-in WIP bottleneck limits.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/ops/kiosk"
            className="px-4 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold flex items-center gap-1.5"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Open Touch Kiosk</span>
          </Link>

          <button
            onClick={fetchKanban}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-mono font-bold border border-white/10 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Refresh Board</span>
          </button>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {laneMeta.map((lane) => {
          const cards = lanes[lane.key] || [];
          const isOverWip = cards.length > lane.wipLimit;

          return (
            <div
              key={lane.key}
              className={`p-4 rounded-3xl border flex flex-col justify-between min-h-[620px] backdrop-blur-md ${lane.color}`}
            >
              <div className="space-y-3">
                {/* Column Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs text-white">{lane.title}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                      isOverWip ? "bg-red-500/30 text-red-200 border border-red-500/40" : "bg-white/10 text-white/80"
                    }`}>
                      {cards.length} / {lane.wipLimit} WIP
                    </span>
                  </div>
                </div>

                {isOverWip && (
                  <div className="p-2 rounded-xl bg-red-500/20 border border-red-500/30 text-[10px] font-mono text-red-200 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>WIP Limit Breached! Buffer bottleneck alert.</span>
                  </div>
                )}

                {/* Cards List */}
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {cards.map((card) => (
                    <div
                      key={card.id}
                      className="p-3.5 rounded-2xl bg-black/60 border border-white/10 hover:border-cyan-400/50 transition-all space-y-2.5 shadow-md group relative"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <span className="text-[10px] font-mono text-cyan-300 font-bold block">
                            {card.woNumber}
                          </span>
                          <span className="text-xs font-black text-white line-clamp-1">
                            {card.product.name}
                          </span>
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="text-[10px] font-mono text-white/50 space-y-1">
                        <div className="flex items-center justify-between">
                          <span>Batch Qty:</span>
                          <strong className="text-cyan-300">{card.plannedQuantity} pcs</strong>
                        </div>
                      </div>

                      {/* Lane Advancement Buttons */}
                      <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-1 text-[10px] font-mono">
                        <Link
                          href={`/ops/work-orders/${card.id}`}
                          className="text-white/40 hover:text-cyan-300 underline"
                        >
                          Traveler ➔
                        </Link>

                        <div className="flex items-center gap-1">
                          {lane.key === "BACKLOG" && (
                            <button
                              onClick={() => handleMoveLane(card.id, "BACKLOG", "STAGED")}
                              className="px-2 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border border-blue-500/30 flex items-center gap-0.5 cursor-pointer"
                            >
                              <span>Stage</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          )}

                          {lane.key === "STAGED" && (
                            <button
                              onClick={() => handleMoveLane(card.id, "STAGED", "IN_PROGRESS")}
                              className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 flex items-center gap-0.5 cursor-pointer"
                            >
                              <Play className="w-2.5 h-2.5" />
                              <span>Start</span>
                            </button>
                          )}

                          {lane.key === "IN_PROGRESS" && (
                            <button
                              onClick={() => handleMoveLane(card.id, "IN_PROGRESS", "QUALITY_GATE")}
                              className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30 flex items-center gap-0.5 cursor-pointer"
                            >
                              <ShieldCheck className="w-2.5 h-2.5" />
                              <span>Inspect</span>
                            </button>
                          )}

                          {lane.key === "QUALITY_GATE" && (
                            <button
                              onClick={() => handleMoveLane(card.id, "QUALITY_GATE", "COMPLETED")}
                              className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/30 flex items-center gap-0.5 cursor-pointer"
                            >
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>Pass & Complete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
