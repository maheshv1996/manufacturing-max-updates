"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  Square,
  ExternalLink,
  Printer,
  CheckCircle2,
} from "lucide-react";
import { offlineFetchWrapper } from "@/lib/offlineSync";

export default function MyRoutineCard({
  role,
  userId,
}: {
  role: string;
  userId?: string;
}) {
  const router = useRouter();
  const [steps, setSteps] = useState<any[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchRoutine = async () => {
    try {
      const uParam = userId ? `&userId=${userId}` : "";
      const res = await fetch(`/api/routines?role=${role}${uParam}`);
      if (res.ok) {
        const json = await res.json();
        setSteps(json.steps || []);
        setCompletedIds(json.completedStepIds || []);
      }
    } catch (err) {
      logClientError("Failed to fetch routine:", err, "MyRoutineCard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutine();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, userId]);

  const toggleStep = async (stepId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId) return;

    const isDone = completedIds.includes(stepId);
    const updatedIds = isDone
      ? completedIds.filter((id) => id !== stepId)
      : [...completedIds, stepId];

    setCompletedIds(updatedIds);

    try {
      await offlineFetchWrapper("/api/routines/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          stepId,
          done: !isDone,
        }),
      });
    } catch (err) {
      logClientError("Failed to update routine progress:", err, "MyRoutineCard");
    }
  };

  const handleNavigate = (target: string) => {
    if (!target) return;
    if (target === "print-pack") {
      window.print();
    } else {
      router.push(target);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm animate-pulse">
        <div className="h-6 w-48 bg-slate-800/60 rounded mb-4" />
        <div className="h-4 w-full bg-slate-800/60 rounded" />
      </div>
    );
  }

  if (steps.length === 0) return null;

  const total = steps.length;
  const doneCount = steps.filter((s) => completedIds.includes(s.id)).length;
  const progressPct = Math.round((doneCount / total) * 100);

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
      {/* Header & Progress Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-4">
        <div>
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-500" />
            My Daily Routine
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Guided workflow for today â€¢ Resets daily
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-extrabold text-blue-400 font-mono">
            {doneCount}/{total} done ({progressPct}%)
          </span>
          <div className="w-32 bg-slate-800/60 h-2.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Routine Steps List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {steps.map((step) => {
          const isDone = completedIds.includes(step.id);

          return (
            <div
              key={step.id}
              onClick={() => handleNavigate(step.target)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 group ${
                isDone
                  ? "bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60 text-slate-400"
                  : "bg-slate-800/60 border-slate-600/80 hover:border-blue-400 hover:border-blue-500 text-white"
              }`}
            >
              <button
                type="button"
                onClick={(e) => toggleStep(step.id, e)}
                className="mt-0.5 shrink-0 text-slate-400 hover:text-emerald-500 transition-colors"
              >
                {isDone ? (
                  <CheckSquare className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Square className="w-5 h-5 text-slate-400 hover:text-blue-500" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {step.timeLabel && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-slate-800/60 text-slate-300 rounded">
                      â± {step.timeLabel}
                    </span>
                  )}
                </div>
                <div
                  className={`text-sm font-bold mt-1 group-hover:text-blue-400 transition-colors flex items-center justify-between gap-1 ${
                    isDone ? "line-through opacity-75" : ""
                  }`}
                >
                  <span className="truncate">{step.title}</span>
                  {step.target === "print-pack" ? (
                    <Printer className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  ) : (
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
