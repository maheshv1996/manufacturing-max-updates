import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";
import DispatchDigestButton from "./DispatchDigestButton";
import { getComplianceFlags } from "@/lib/complianceDigest";
import {
  computeCalibrationStatus,
  computeVendorStatus,
} from "@/lib/calibration";
import { AlertTriangle, Gauge, ShieldCheck, Activity } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export default async function ComplianceDigestReport() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "system.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const now = new Date();
  const { flags, criticalCount, warningCount } = await getComplianceFlags(now);

  const [calibratedToolsDb, specialProcessVendorsDb, logs] = await Promise.all([
    prisma.calibratedTool.findMany(),
    prisma.specialProcessVendor.findMany(),
    prisma.complianceDigestLog.findMany({
      orderBy: { generatedAt: "desc" },
      take: 10,
    }),
  ]);

  const expiredTools = calibratedToolsDb.filter(
    (t) => computeCalibrationStatus(t.expiresAt) === "EXPIRED",
  ).length;
  const expiringTools = calibratedToolsDb.filter(
    (t) => computeCalibrationStatus(t.expiresAt) === "EXPIRING_SOON",
  ).length;
  const expiredVendors = specialProcessVendorsDb.filter(
    (v) => computeVendorStatus(v.expiresAt) === "EXPIRED",
  ).length;

  const [openNcrCount, pendingEcoCount, lowStockMaterials] = await Promise.all([
    (prisma as any).ncrReport.count({ where: { status: "OPEN" } }),
    prisma.eco.count({ where: { status: "DRAFT" } }),
    (prisma as any).rawMaterial
      .findMany({ where: { isActive: true } })
      .then(
        (mats: any[]) =>
          mats.filter((m) => m.currentStock <= m.minStock).length,
      ),
  ]);

  const byCategory = flags.reduce<Record<string, typeof flags>>((acc, f) => {
    (acc[f.category] = acc[f.category] || []).push(f);
    return acc;
  }, {});

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 font-sans print:p-0 print:max-w-full">
      <div className="flex items-center justify-between mb-6 print:mb-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-7 h-7 text-rose-600 print:hidden" />
          <div>
            <h1 className="text-2xl font-extrabold text-white print:text-black">
              Daily Compliance Digest
            </h1>
            <p className="text-xs text-slate-500 print:text-gray-600 mt-0.5">
              Generated: {now.toLocaleString()} · {criticalCount} critical ·{" "}
              {warningCount} warning
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DispatchDigestButton />
          <PrintButton />
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 print:grid-cols-4">
        <div className="p-4 rounded-xl border bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800">
          <div className="text-xs font-bold uppercase tracking-wider text-rose-400">
            Critical
          </div>
          <div className="text-3xl font-black font-mono text-rose-400 mt-1">
            {criticalCount}
          </div>
        </div>
        <div className="p-4 rounded-xl border bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Warning
          </div>
          <div className="text-3xl font-black font-mono text-amber-400 mt-1">
            {warningCount}
          </div>
        </div>
        <div className="p-4 rounded-xl border bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800/60">
          <div className="text-xs font-bold uppercase tracking-wider text-orange-400">
            Calibration
          </div>
          <div className="text-3xl font-black font-mono text-orange-400 mt-1">
            {expiredTools + expiredVendors}
          </div>
          <div className="text-[11px] text-orange-500/80 mt-1">
            {expiredTools} tools · {expiredVendors} vendors
          </div>
        </div>
        <div className="p-4 rounded-xl border bg-indigo-100 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-400">
            Quality
          </div>
          <div className="text-3xl font-black font-mono text-indigo-400 mt-1">
            {openNcrCount + pendingEcoCount}
          </div>
          <div className="text-[11px] text-indigo-500/80 mt-1">
            {openNcrCount} open NCRs · {pendingEcoCount} draft ECOs
          </div>
        </div>
      </div>

      {/* Flags by category */}
      {flags.length === 0 ? (
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700 p-10 text-center text-slate-400">
          No compliance flags today — everything is green across the corporate
          registers.
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(byCategory).map(([category, items]) => (
            <div
              key={category}
              className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-hidden print:border print:border-gray-300"
            >
              <div className="px-5 py-3 bg-slate-800/60 print:bg-gray-100 border-b border-slate-600 print:border-gray-300 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 print:text-gray-700">
                  {category}
                </h3>
                <span className="text-xs font-bold text-slate-400">
                  {items.length}
                </span>
              </div>
              <div className="divide-y divide-slate-100 divide-slate-800 print:divide-gray-200">
                {items.map((f) => (
                  <div
                    key={f.id}
                    className="px-5 py-3 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white print:text-black">
                        {f.label}
                      </div>
                      {f.detail && (
                        <div className="text-xs text-slate-400 print:text-gray-600">
                          {f.detail}
                        </div>
                      )}
                    </div>
                    <span
                      className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider text-white ${
                        f.severity === "critical"
                          ? "bg-rose-600"
                          : "bg-amber-500"
                      }`}
                    >
                      {f.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Metrology + quality details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 print:grid-cols-3">
        <div className="p-4 rounded-xl border border-slate-600 bg-slate-800/60 print:border-gray-300">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-teal-400 mb-2">
            <Gauge className="w-4 h-4" /> Metrology
          </div>
          <div className="space-y-1 text-sm text-slate-600 text-slate-300 print:text-gray-700">
            <div>
              Expired tools:{" "}
              <strong className="text-rose-500">{expiredTools}</strong>
            </div>
            <div>
              Expiring &lt; 30 days:{" "}
              <strong className="text-amber-500">{expiringTools}</strong>
            </div>
            <div>
              Expired vendor certs:{" "}
              <strong className="text-rose-500">{expiredVendors}</strong>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-600 bg-slate-800/60 print:border-gray-300">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-400 mb-2">
            <ShieldCheck className="w-4 h-4" /> Quality
          </div>
          <div className="space-y-1 text-sm text-slate-600 text-slate-300 print:text-gray-700">
            <div>
              Open NCRs:{" "}
              <strong className="text-indigo-500">{openNcrCount}</strong>
            </div>
            <div>
              Draft ECOs pending:{" "}
              <strong className="text-amber-500">{pendingEcoCount}</strong>
            </div>
            <div>
              Raw materials below min:{" "}
              <strong className="text-amber-500">{lowStockMaterials}</strong>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-600 bg-slate-800/60 print:border-gray-300">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-sky-400 mb-2">
            <Activity className="w-4 h-4" /> Dispatch Log
          </div>
          {logs.length === 0 ? (
            <div className="text-sm text-slate-400 italic">
              No dispatches yet — use &quot;Dispatch to Owner&quot; above.
            </div>
          ) : (
            <div className="space-y-1.5">
              {logs.map((l) => (
                <div
                  key={l.id}
                  className="text-xs text-slate-600 text-slate-300 print:text-gray-700 flex justify-between gap-2"
                >
                  <span>{new Date(l.generatedAt).toLocaleString()}</span>
                  <span className="font-bold">
                    {l.criticalCount} crit / {l.warningCount} warn
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-[10px] text-slate-400 mt-6 print:mt-4 print:text-gray-400">
        Manufacturing MAX · Daily Compliance Digest · Action required list for
        management review · Confidential
      </p>
    </main>
  );
}
