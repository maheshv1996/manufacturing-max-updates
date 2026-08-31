import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  ArrowRight,
  DollarSign,
} from "lucide-react";
import NewProjectModal from "./NewProjectModal";

export const dynamic = "force-dynamic";

const TYPE_COLORS: Record<string, string> = {
  KAIZEN: "bg-purple-900/60 border-purple-700 text-purple-300",
  DMAIC: "bg-blue-900/60 border-blue-700 text-blue-300",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-slate-700 text-slate-300",
  IN_PROGRESS: "bg-emerald-900/60 text-emerald-300",
  COMPLETED: "bg-teal-900/60 text-teal-300",
  ON_HOLD: "bg-amber-900/60 text-amber-300",
};

const PHASES = ["DEFINE", "MEASURE", "ANALYZE", "IMPROVE", "CONTROL"] as const;

function PhaseProgressBar({ phase, type }: { phase: string; type: string }) {
  if (type !== "DMAIC") return null;
  const idx = PHASES.indexOf(phase as (typeof PHASES)[number]);
  return (
    <div className="flex gap-1 mt-3">
      {PHASES.map((p, i) => (
        <div key={p} className="flex-1 flex flex-col items-center gap-1">
          <div
            className={`h-1.5 w-full rounded-full transition-colors ${i <= idx ? "bg-blue-500" : "bg-slate-700"}`}
          />
          <span
            className={`text-[9px] font-bold uppercase ${i === idx ? "text-blue-400" : "text-slate-600"}`}
          >
            {p.slice(0, 3)}
          </span>
        </div>
      ))}
    </div>
  );
}

async function getKaizenData() {
  const projects = await prisma.improvementProject.findMany({
    include: {
      machine: { select: { name: true, code: true } },
      rcaRecord: true,
      actionItems: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  const machines = await prisma.machine.findMany({
    select: { id: true, name: true, code: true },
    orderBy: { code: "asc" },
  });
  return { projects, machines };
}

export default async function KaizenPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "system.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const { projects, machines } = await getKaizenData();

  const open = projects.filter(
    (p) => p.status === "OPEN" || p.status === "IN_PROGRESS",
  ).length;
  const completed = projects.filter((p) => p.status === "COMPLETED").length;
  const totalSavings = projects.reduce(
    (s, p) => s + (p.expectedAnnualSavings || 0),
    0,
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* ── Header ── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-600 rounded-xl shadow-lg shadow-purple-600/30">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight">
                Continuous Improvement
              </h1>
            </div>
            <p className="text-slate-400 text-sm">
              Kaizen events · DMAIC projects · 5 Whys root-cause analysis
            </p>
          </div>
          <NewProjectModal machines={machines} />
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-900/40 rounded-xl">
              <Clock className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-0.5">Active Projects</p>
              <p className="text-4xl font-black text-white">{open}</p>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 flex items-center gap-4">
            <div className="p-3 bg-teal-900/40 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-teal-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-0.5">Completed</p>
              <p className="text-4xl font-black text-white">{completed}</p>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 flex items-center gap-4">
            <div className="p-3 bg-emerald-900/40 rounded-xl">
              <DollarSign className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-0.5">
                Expected Annual Savings
              </p>
              <p className="text-4xl font-black text-emerald-400">
                ${totalSavings.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* ── Project Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {projects.map((proj) => {
            const doneActions = proj.actionItems.filter(
              (a) => a.status === "DONE",
            ).length;
            const totalActions = proj.actionItems.length;
            return (
              <Link
                key={proj.id}
                href={`/system/kaizen/${proj.id}`}
                className="block bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-2xl p-6 transition-all hover:shadow-lg hover:shadow-slate-900 group"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase border ${TYPE_COLORS[proj.type]}`}
                    >
                      {proj.type}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold ${STATUS_COLORS[proj.status]}`}
                    >
                      {proj.status.replace("_", " ")}
                    </span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0 mt-0.5" />
                </div>

                <h3 className="font-bold text-white text-base leading-snug mb-2 line-clamp-2">
                  {proj.title}
                </h3>

                <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                  <span>👤 {proj.ownerName}</span>
                  {proj.machine && <span>🔧 {proj.machine.code}</span>}
                  {proj.expectedAnnualSavings && (
                    <span className="text-emerald-500 font-semibold">
                      ${proj.expectedAnnualSavings.toLocaleString()}/yr
                    </span>
                  )}
                </div>

                {proj.type === "DMAIC" && (
                  <PhaseProgressBar phase={proj.phase} type={proj.type} />
                )}

                {totalActions > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>Actions</span>
                      <span>
                        {doneActions}/{totalActions}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all"
                        style={{
                          width: `${totalActions > 0 ? (doneActions / totalActions) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
