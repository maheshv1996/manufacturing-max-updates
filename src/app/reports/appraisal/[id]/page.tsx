import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";
import { Award } from "lucide-react";

export const dynamic = "force-dynamic";

function bar(pct: number, tone: string) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className="w-12 text-right text-xs font-bold">{pct}%</span>
    </div>
  );
}

export default async function AppraisalPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "people.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const { id } = await params;
  const sp = await searchParams;
  const period = sp.period || new Date().toISOString().slice(0, 7);

  const appraisal = await prisma.performanceAppraisal.findUnique({
    where: { userId_period: { userId: id, period } },
    include: { user: { select: { name: true, employeeNumber: true } } },
  });
  if (!appraisal) notFound();

  const scoreColor =
    appraisal.score >= 90
      ? "text-emerald-700"
      : appraisal.score >= 80
        ? "text-sky-700"
        : appraisal.score >= 70
          ? "text-amber-700"
          : "text-rose-700";
  const grade =
    appraisal.score >= 90
      ? "A — Outstanding"
      : appraisal.score >= 80
        ? "B — Above average"
        : appraisal.score >= 70
          ? "C — Meets expectation"
          : "D — Needs improvement";

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 font-sans print:p-0 print:max-w-full">
      <div className="flex items-center justify-between mb-6 print:mb-4">
        <div className="flex items-center gap-3">
          <Award className="w-5 h-5 text-amber-500" />
          <h1 className="text-lg font-semibold text-slate-100">
            Performance Appraisal — {appraisal.user.name}
          </h1>
        </div>
        <PrintButton />
      </div>

      <div className="bg-white text-slate-900 rounded-lg shadow-lg p-8 print:shadow-none print:rounded-none print:p-0 space-y-6">
        {/* Letterhead */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
          <div>
            <div className="text-xl font-bold uppercase tracking-wide">
              Manufacturing Max
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              Annual / Periodic Performance Appraisal · Live-Data Basis
            </div>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div className="font-semibold text-sm text-slate-900">{period}</div>
            <div>
              APP-{appraisal.user.employeeNumber || appraisal.userId.slice(-6)}-
              {period.replace("-", "")}
            </div>
          </div>
        </div>

        {/* Identity */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <span className="text-slate-500">Employee:</span>{" "}
            <span className="font-bold">{appraisal.user.name}</span>
          </div>
          <div>
            <span className="text-slate-500">Employee No.:</span>{" "}
            <span className="font-bold">
              {appraisal.user.employeeNumber || "—"}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Period:</span> {period}
          </div>
          <div>
            <span className="text-slate-500">Reviewed by:</span>{" "}
            {appraisal.reviewedByName || "—"}{" "}
            {appraisal.reviewedAt
              ? `· ${new Date(appraisal.reviewedAt).toLocaleDateString("en-IN")}`
              : ""}
          </div>
        </div>

        {/* Auto metrics */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">
            Live-data components (auto-computed from MES)
          </h2>
          <div className="space-y-3 text-sm">
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold">
                  Efficiency{" "}
                  <span className="text-slate-400 font-normal">
                    (standard hrs vs actual — 40%)
                  </span>
                </span>
              </div>
              {bar(appraisal.efficiencyPct, "bg-sky-500")}
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold">
                  Quality{" "}
                  <span className="text-slate-400 font-normal">
                    (100 − scrap rate — 40%)
                  </span>
                </span>
              </div>
              {bar(appraisal.qualityPct, "bg-emerald-500")}
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold">
                  Attendance{" "}
                  <span className="text-slate-400 font-normal">
                    (present / scheduled — 20%)
                  </span>
                </span>
              </div>
              {bar(appraisal.attendancePct, "bg-amber-500")}
            </div>
          </div>
        </div>

        {/* Score */}
        <div className="flex items-center justify-between rounded-xl border-2 border-slate-900 p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 font-bold">
              Weighted auto score
            </p>
            <p className={`text-4xl font-black ${scoreColor}`}>
              {appraisal.score}
              <span className="text-base font-bold text-slate-400"> / 100</span>
            </p>
            <p className="text-sm font-semibold mt-1">{grade}</p>
          </div>
          <div className="text-center">
            <p className="text-xs uppercase tracking-wide text-slate-500 font-bold mb-1">
              Manager rating
            </p>
            <p className="text-3xl font-black text-amber-600">
              {appraisal.managerRating || "—"}
              <span className="text-base text-slate-400"> / 5</span>
            </p>
          </div>
        </div>

        {/* Manager comments */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-2">
            Manager comments
          </h2>
          <div className="rounded-lg border border-slate-300 p-4 min-h-[80px] text-sm leading-relaxed whitespace-pre-wrap">
            {appraisal.managerComments || "No comments recorded."}
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 pt-6 text-sm">
          <div className="text-center">
            <div className="border-t border-slate-500 pt-1">Employee</div>
          </div>
          <div className="text-center">
            <div className="border-t border-slate-500 pt-1">
              Reviewing Manager ·{" "}
              {appraisal.reviewedByName || "________________"}
            </div>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 border-t border-slate-200 pt-2">
          Computer-generated appraisal. Data source: MES production logs,
          quality records and attendance register for {period}. Disputes may be
          raised within 7 days to the department head.
        </p>
      </div>
    </main>
  );
}
