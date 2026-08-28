import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import HubClient from "@/app/components/shared/HubClient";
import { prisma } from "@/lib/prisma";
import {
  Wrench,
  AlertTriangle,
  CalendarRange,
  Zap,
  Cog,
  ClipboardList,
  Hammer,
} from "lucide-react";
import { format } from "date-fns";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function MaintenanceHub() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user || (!user.isOwner && !can(user, "maintenance.view"))) {
    redirect("/login");
  }

  const [jobs, pmRules, spares, utilityReadings] = await Promise.all([
    prisma.maintenanceJob.findMany({
      orderBy: { openedAt: "desc" },
      take: 200,
      include: { machine: true },
    }),
    prisma.pMRule.findMany({ take: 100, include: { machine: true } }),
    prisma.sparePart.findMany({ take: 100 }),
    prisma.utilityReading.findMany({ orderBy: { readAt: "desc" }, take: 100 }),
  ]);

  const openJobs = jobs.filter(
    (j) => j.status === "OPEN" || j.status === "IN_PROGRESS",
  );
  const breakdowns = jobs.filter(
    (j) => j.type === "BREAKDOWN" && j.status !== "CLOSED",
  );
  const criticalJobs = jobs.filter(
    (j) => j.priority === "CRITICAL" && j.status !== "CLOSED",
  );
  const lowSpares = spares.filter((s) => s.currentQty <= s.minQty);
  const utilityCount = utilityReadings.length;

  const feed = jobs.slice(0, 8).map((j: any) => ({
    time: format(new Date(j.openedAt), "MMM d"),
    title:
      (j.type === "BREAKDOWN" ? "Breakdown" : "PM") +
      " · " +
      (j.machine?.name || j.machineId),
    detail: j.description.slice(0, 70),
    tone: (j.priority === "CRITICAL" || j.priority === "HIGH"
      ? "danger"
      : j.status === "CLOSED"
        ? "ok"
        : "warn") as any,
    href: "/system/maintenance",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance & Utilities"
        description="Breakdown response, preventive/predictive maintenance, utilities and spares management."
        icon={<Wrench className="h-5 w-5 text-orange-500" />}
      />
      <HubClient
        kpis={[
          {
            label: "Open Jobs",
            value: openJobs.length,
            icon: <Wrench className="h-5 w-5 text-orange-500" />,
            hint: "on the board",
          },
          {
            label: "Open Breakdowns",
            value: breakdowns.length,
            icon: <AlertTriangle className="h-5 w-5 text-rose-500" />,
            tone: breakdowns.length ? "text-rose-500" : undefined,
            hint: "critical: " + criticalJobs.length,
          },
          {
            label: "PM Rules",
            value: pmRules.length,
            icon: <CalendarRange className="h-5 w-5 text-sky-500" />,
            hint: "schedules",
          },
          {
            label: "Low Spares",
            value: lowSpares.length,
            icon: <Cog className="h-5 w-5 text-amber-500" />,
            tone: lowSpares.length ? "text-amber-500" : undefined,
            hint: "reorder",
          },
          {
            label: "Utility Readings",
            value: utilityCount,
            icon: <Zap className="h-5 w-5 text-yellow-500" />,
            hint: "metered",
          },
        ]}
        quickActions={[
          {
            label: "Job Board",
            href: "/system/maintenance",
            icon: <Wrench className="h-4 w-4" />,
            primary: true,
          },
          {
            label: "PM Schedule",
            href: "/system/maintenance",
            icon: <CalendarRange className="h-4 w-4" />,
          },
          {
            label: "Utilities",
            href: "/system/utilities",
            icon: <Zap className="h-4 w-4" />,
          },
          {
            label: "Spares",
            href: "/supply/spares",
            icon: <Cog className="h-4 w-4" />,
          },
        ]}
        sections={[
          {
            id: "jobs",
            title: "Breakdown & Maintenance Job Board",
            icon: <Hammer className="h-4 w-4 text-orange-500" />,
            open: true,
            body: (
              <div className="space-y-2">
                {jobs.length === 0 ? (
                  <p className="text-sm text-text-3">No maintenance jobs.</p>
                ) : (
                  jobs.slice(0, 7).map((j: any) => (
                    <a
                      key={j.id}
                      href="/system/maintenance"
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-1 truncate">
                          {j.type} · {j.machine?.name || j.machineId}
                        </p>
                        <p className="text-xs text-text-3 truncate">
                          {j.description.slice(0, 70)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            j.priority === "CRITICAL"
                              ? "bg-rose-500/10 text-rose-500"
                              : j.priority === "HIGH"
                                ? "bg-orange-500/10 text-orange-500"
                                : j.priority === "MEDIUM"
                                  ? "bg-amber-500/10 text-amber-500"
                                  : "bg-sky-500/10 text-sky-500"
                          }`}
                        >
                          {j.priority}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            j.status === "CLOSED"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-sky-500/10 text-sky-500"
                          }`}
                        >
                          {j.status}
                        </span>
                      </div>
                    </a>
                  ))
                )}
              </div>
            ),
          },
          {
            id: "pm",
            title: "Preventive / Predictive Maintenance",
            icon: <CalendarRange className="h-4 w-4 text-sky-500" />,
            body: (
              <div className="space-y-2">
                {pmRules.length === 0 ? (
                  <p className="text-sm text-text-3">No PM rules configured.</p>
                ) : (
                  pmRules.slice(0, 6).map((r: any) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-1 truncate">
                          {r.title}
                        </p>
                        <p className="text-xs text-text-3">
                          Every {r.intervalDays ?? "—"} days ·{" "}
                          {r.machine?.name || r.machineId}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-sky-500 shrink-0">
                        {r.isActive === false ? "PAUSED" : "ACTIVE"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            ),
          },
          {
            id: "spares",
            title: "Spares Management",
            icon: <Cog className="h-4 w-4 text-amber-500" />,
            body: (
              <div className="space-y-2">
                {spares.length === 0 ? (
                  <p className="text-sm text-text-3">No spare parts.</p>
                ) : (
                  spares.slice(0, 6).map((s: any) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-1 truncate">
                          {s.name} · {s.sku}
                        </p>
                        <p className="text-xs text-text-3">
                          {s.machineCode || "General"} · {s.location || "—"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`text-sm font-bold ${s.currentQty <= s.minQty ? "text-rose-500" : "text-text-1"}`}
                        >
                          {s.currentQty}
                        </p>
                        <p className="text-xs text-text-3">min {s.minQty}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ),
          },
          {
            id: "utilities",
            title: "Utilities (Power, Air, HVAC)",
            icon: <Zap className="h-4 w-4 text-yellow-500" />,
            body: (
              <div className="space-y-2">
                <a
                  href="/system/utilities"
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                >
                  <span className="text-sm font-medium text-text-1">
                    Utility Meter Readings
                  </span>
                  <span className="text-xs font-semibold text-yellow-500">
                    {utilityCount} readings →
                  </span>
                </a>
                {utilityReadings.slice(0, 4).map((u: any) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-1 truncate">
                        {u.utilityType}
                        {u.meterName ? " · " + u.meterName : ""}
                      </p>
                      <p className="text-xs text-text-3">
                        {format(new Date(u.readAt), "MMM d, HH:mm")}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-text-1 shrink-0">
                      {u.reading} {u.unit}
                    </span>
                  </div>
                ))}
              </div>
            ),
          },
        ]}
        feed={feed}
        feedTitle="Maintenance Feed"
        feedIcon={<ClipboardList className="h-4 w-4 text-orange-500" />}
        feedEmpty="No maintenance activity yet."
      />
    </div>
  );
}
