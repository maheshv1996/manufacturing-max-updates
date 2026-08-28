import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import HubClient from "@/app/components/shared/HubClient";
import { prisma } from "@/lib/prisma";
import {
  Leaf,
  AlertTriangle,
  HeartPulse,
  ShieldAlert,
  Zap,
  Sparkles,
  ClipboardList,
  PlusCircle,
} from "lucide-react";
import { format } from "date-fns";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function EhsHub() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user || (!user.isOwner && !can(user, "ehs.view"))) {
    redirect("/login");
  }
  const [incidents, healthChecks, environmental, fireDrills, fiveSAudits] =
    await Promise.all([
      prisma.safetyIncident.findMany({
        orderBy: { reportedAt: "desc" },
        take: 200,
      }),
      prisma.healthCheckRecord.findMany({
        orderBy: { checkDate: "desc" },
        take: 100,
      }),
      prisma.environmentalRecord.findMany({
        orderBy: { recordedAt: "desc" },
        take: 100,
      }),
      prisma.fireDrillRecord.findMany({
        orderBy: { drillDate: "desc" },
        take: 100,
      }),
      prisma.fiveSAudit.findMany({ orderBy: { date: "desc" }, take: 100 }),
    ]);

  // P27 — monthly observation quota (digest flags managers below quota)
  const [managers, quotaSetting] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, level: "MANAGER" },
      include: { role: { select: { permissions: true } } },
    }),
    prisma.setting.findUnique({ where: { key: "ehsObservationQuota" } }),
  ]);
  const quota = Number(quotaSetting?.value || 4);
  const monthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  );
  const monthObs = incidents.filter(
    (i: any) =>
      ["NEAR_MISS", "HAZARD", "PPE_VIOLATION"].includes(i.type) &&
      new Date(i.reportedAt) >= monthStart,
  );
  const obsByName: Record<string, number> = {};
  monthObs.forEach((i: any) => {
    const n = (i.reportedBy || "").trim();
    if (n) obsByName[n] = (obsByName[n] || 0) + 1;
  });
  const quotaRows = managers.map((m: any) => ({
    name: m.name,
    count: obsByName[m.name] || 0,
    quota,
    missed: (obsByName[m.name] || 0) < quota,
  }));

  const openIncidents = incidents.filter(
    (i) => i.status === "OPEN" || i.status === "IN_INVESTIGATION",
  );
  const criticalIncidents = incidents.filter(
    (i) => i.severity === "CRITICAL" && i.status !== "CLOSED",
  );
  const healthChecksTotal = healthChecks.length;
  const nonCompliant = environmental.filter(
    (e) => e.complianceStatus !== "COMPLIANT",
  );

  const feed = incidents.slice(0, 8).map((i: any) => ({
    time: format(new Date(i.reportedAt), "MMM d"),
    title: (i.type || "INCIDENT") + " · " + i.location,
    detail: i.description.slice(0, 80),
    tone: (i.severity === "CRITICAL" || i.severity === "HIGH"
      ? "danger"
      : i.status === "CLOSED"
        ? "ok"
        : "warn") as any,
    href: "/system/safety",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="EHS — Environment, Health & Safety"
        description="Safety & incidents, occupational health, environmental compliance, fire response and lean culture."
        icon={<Leaf className="h-5 w-5 text-lime-500" />}
      />
      <HubClient
        kpis={[
          {
            label: "Open Incidents",
            value: openIncidents.length,
            icon: <AlertTriangle className="h-5 w-5 text-rose-500" />,
            tone: openIncidents.length ? "text-rose-500" : undefined,
            hint: "critical: " + criticalIncidents.length,
          },
          {
            label: "Health Checks",
            value: healthChecksTotal,
            icon: <HeartPulse className="h-5 w-5 text-emerald-500" />,
            hint: "records",
          },
          {
            label: "Environmental Records",
            value: environmental.length,
            icon: <Leaf className="h-5 w-5 text-lime-500" />,
            hint: "non-compliant: " + nonCompliant.length,
          },
          {
            label: "Fire Drills",
            value: fireDrills.length,
            icon: <Zap className="h-5 w-5 text-orange-500" />,
            hint: "conducted",
          },
          {
            label: "5S Audits",
            value: fiveSAudits.length,
            icon: <Sparkles className="h-5 w-5 text-sky-500" />,
            hint: "workplace org",
          },
        ]}
        quickActions={[
          {
            label: "Report Incident",
            href: "/system/safety",
            icon: <PlusCircle className="h-4 w-4" />,
            primary: true,
          },
          {
            label: "Safety Board",
            href: "/system/safety",
            icon: <ShieldAlert className="h-4 w-4" />,
          },
          {
            label: "EHS Programs",
            href: "/system/ehs",
            icon: <Leaf className="h-4 w-4" />,
          },
          {
            label: "5S",
            href: "/system/fives",
            icon: <Sparkles className="h-4 w-4" />,
          },
        ]}
        sections={[
          {
            id: "incidents",
            title: "Safety & Incident Investigation",
            icon: <AlertTriangle className="h-4 w-4 text-rose-500" />,
            open: true,
            body: (
              <div className="space-y-2">
                {incidents.length === 0 ? (
                  <p className="text-sm text-emerald-500">
                    ✓ No incidents logged.
                  </p>
                ) : (
                  incidents.slice(0, 7).map((i: any) => (
                    <a
                      key={i.id}
                      href="/system/safety"
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-1 truncate">
                          {i.type} · {i.location}
                        </p>
                        <p className="text-xs text-text-3 truncate">
                          {i.description.slice(0, 70)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            i.severity === "CRITICAL"
                              ? "bg-rose-500/10 text-rose-500"
                              : i.severity === "HIGH"
                                ? "bg-orange-500/10 text-orange-500"
                                : "bg-amber-500/10 text-amber-500"
                          }`}
                        >
                          {i.severity}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            i.status === "CLOSED"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-sky-500/10 text-sky-500"
                          }`}
                        >
                          {i.status}
                        </span>
                      </div>
                    </a>
                  ))
                )}
              </div>
            ),
          },
          {
            id: "health",
            title: "Occupational Health",
            icon: <HeartPulse className="h-4 w-4 text-emerald-500" />,
            body: (
              <div className="space-y-2">
                <a
                  href="/system/ehs"
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                >
                  <span className="text-sm font-medium text-text-1">
                    Health Check Records
                  </span>
                  <span className="text-xs font-semibold text-emerald-500">
                    {healthChecks.length} total →
                  </span>
                </a>
                {healthChecks.slice(0, 4).map((h: any) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-1 truncate">
                        {h.employeeName}
                      </p>
                      <p className="text-xs text-text-3">
                        {format(new Date(h.checkDate), "MMM d, yyyy")} ·{" "}
                        {h.conductedBy || "Occupational Health"}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        h.fitnessStatus === "FIT"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : h.fitnessStatus === "FIT_WITH_NOTES"
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-rose-500/10 text-rose-500"
                      }`}
                    >
                      {h.fitnessStatus}
                    </span>
                  </div>
                ))}
              </div>
            ),
          },
          {
            id: "environment",
            title: "Environmental Compliance",
            icon: <Leaf className="h-4 w-4 text-lime-500" />,
            body: (
              <div className="space-y-2">
                {environmental.slice(0, 5).map((e: any) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-1 truncate">
                        {e.title}
                      </p>
                      <p className="text-xs text-text-3 truncate">
                        {e.description || e.permitNumber || ""}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold shrink-0 ${
                        e.complianceStatus === "COMPLIANT"
                          ? "text-lime-500"
                          : "text-rose-500"
                      }`}
                    >
                      {e.complianceStatus}
                    </span>
                  </div>
                ))}
              </div>
            ),
          },
          {
            id: "fire",
            title: "Fire & Emergency Response",
            icon: <Zap className="h-4 w-4 text-orange-500" />,
            body: (
              <div className="space-y-2">
                {fireDrills.length === 0 ? (
                  <p className="text-sm text-text-3">No fire drills logged.</p>
                ) : (
                  fireDrills.slice(0, 5).map((f: any) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-1 truncate">
                          Drill ·{" "}
                          {f.drillDate
                            ? format(new Date(f.drillDate), "MMM d, yyyy")
                            : ""}
                        </p>
                        <p className="text-xs text-text-3">
                          {f.participants} participants · {f.durationMin ?? "—"}{" "}
                          min · {f.location}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          f.passed
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-rose-500/10 text-rose-500"
                        }`}
                      >
                        {f.passed ? "PASS" : "FAIL"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            ),
          },
          {
            id: "fives",
            title: "5S & Lean Culture",
            icon: <Sparkles className="h-4 w-4 text-sky-500" />,
            body: (
              <div className="space-y-2">
                <a
                  href="/system/fives"
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                >
                  <span className="text-sm font-medium text-text-1">
                    5S Audit Scores
                  </span>
                  <span className="text-xs font-semibold text-sky-500">
                    {fiveSAudits.length} audits →
                  </span>
                </a>
                <a
                  href="/system/kaizen"
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                >
                  <span className="text-sm font-medium text-text-1">
                    Kaizen Board
                  </span>
                  <span className="text-xs font-semibold text-sky-500">
                    Open →
                  </span>
                </a>
                <a
                  href="/system/ideas"
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                >
                  <span className="text-sm font-medium text-text-1">
                    Idea Box
                  </span>
                  <span className="text-xs font-semibold text-sky-500">
                    Open →
                  </span>
                </a>
              </div>
            ),
          },
          {
            id: "quota",
            title: "Monthly Observation Quota (managers)",
            icon: <ClipboardList className="h-4 w-4 text-sky-500" />,
            body: (
              <div className="space-y-2">
                {quotaRows.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No managers on record — quota is {quota} observations/month.
                  </p>
                ) : (
                  quotaRows.map((r: any) => (
                    <div
                      key={r.name}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-1 truncate">
                          {r.name}
                        </p>
                        <div className="h-1.5 w-40 rounded-full bg-slate-700/60 mt-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${r.missed ? "bg-rose-500" : "bg-emerald-500"}`}
                            style={{
                              width: `${Math.min(100, (r.count / r.quota) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.missed ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"}`}
                      >
                        {r.count}/{r.quota} {r.missed ? "missed" : "✓"}
                      </span>
                    </div>
                  ))
                )}
                <p className="text-[11px] text-text-3 pt-1">
                  Near-misses, hazards and PPE violations logged by each manager
                  count — missed quotas surface in the morning digest.
                </p>
              </div>
            ),
          },
        ]}
        feed={feed}
        feedTitle="Incident Feed"
        feedIcon={<ClipboardList className="h-4 w-4 text-rose-500" />}
        feedEmpty="No incidents reported."
      />
    </div>
  );
}
