import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import HubClient from "@/app/components/shared/HubClient";
import { prisma } from "@/lib/prisma";
import {
  Gauge,
  CalendarRange,
  AlertTriangle,
  PackageOpen,
  Ruler,
  ShieldCheck,
  ClipboardList,
  ArrowDownToLine,
} from "lucide-react";
import { format } from "date-fns";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function MetrologyHub() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user || (!user.isOwner && !can(user, "metrology.view"))) {
    redirect("/login");
  }
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [tools, issues] = await Promise.all([
    prisma.calibratedTool.findMany({
      orderBy: { expiresAt: "asc" },
      take: 200,
    }),
    prisma.instrumentIssue.findMany({
      orderBy: { issuedAt: "desc" },
      take: 100,
    }),
  ]);

  const expired = tools.filter(
    (t) => t.status === "EXPIRED" || t.expiresAt < now,
  );
  const expiring = tools.filter(
    (t) => t.status !== "EXPIRED" && t.expiresAt >= now && t.expiresAt <= soon,
  );
  const ok = tools.filter((t) => t.expiresAt > soon);
  const out = issues.filter((i) => !i.returnedAt);

  const feed = issues.slice(0, 8).map((i: any) => ({
    time: format(new Date(i.issuedAt), "MMM d"),
    title: (i.calibratedTool?.name || "Tool") + " → " + i.issuedToName,
    detail:
      "Issued by " + i.issuedBy + (i.returnedAt ? " · returned" : " · out"),
    tone: (i.returnedAt ? "ok" : "warn") as any,
    href: "/system/admin?tab=metrology",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Instrumentation & Metrology"
        description="Tool crib — instrument master register, issue/return logs, custody, calibration scheduling and quarantine."
        icon={<Gauge className="h-5 w-5 text-teal-500" />}
      />
      <HubClient
        kpis={[
          {
            label: "Instruments",
            value: tools.length,
            icon: <Gauge className="h-5 w-5 text-teal-500" />,
            hint: "master register",
          },
          {
            label: "Calibrated (OK)",
            value: ok.length,
            icon: <ShieldCheck className="h-5 w-5 text-emerald-500" />,
            hint: ">30 days",
          },
          {
            label: "Expiring < 30d",
            value: expiring.length,
            icon: <CalendarRange className="h-5 w-5 text-amber-500" />,
            tone: expiring.length ? "text-amber-500" : undefined,
            hint: "recalibrate soon",
          },
          {
            label: "Expired",
            value: expired.length,
            icon: <AlertTriangle className="h-5 w-5 text-rose-500" />,
            tone: expired.length ? "text-rose-500" : undefined,
            hint: "quarantine",
          },
          {
            label: "Issued Out",
            value: out.length,
            icon: <PackageOpen className="h-5 w-5 text-sky-500" />,
            hint: "with operators",
          },
        ]}
        quickActions={[
          {
            label: "Tool Crib Manager",
            href: "/system/admin?tab=metrology",
            icon: <Gauge className="h-4 w-4" />,
            primary: true,
          },
          {
            label: "Calibration Register",
            href: "/reports/calibration-register",
            icon: <CalendarRange className="h-4 w-4" />,
          },
          {
            label: "Gage R&R (MSA)",
            href: "/quality/grr",
            icon: <Ruler className="h-4 w-4" />,
          },
        ]}
        sections={[
          {
            id: "register",
            title: "Instrument Master Register",
            icon: <Gauge className="h-4 w-4 text-teal-500" />,
            open: true,
            body: (
              <div className="space-y-2">
                {tools.length === 0 ? (
                  <p className="text-sm text-text-3">
                    No instruments registered.
                  </p>
                ) : (
                  tools.slice(0, 7).map((t: any) => {
                    const status =
                      t.status === "EXPIRED" || t.expiresAt < now
                        ? "EXPIRED"
                        : t.expiresAt <= soon
                          ? "EXPIRING_SOON"
                          : "OK";
                    return (
                      <a
                        key={t.id}
                        href="/system/admin?tab=metrology"
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-1 truncate">
                            {t.name} · {t.serialNumber}
                          </p>
                          <p className="text-xs text-text-3">
                            Cert {t.certNumber || "—"} · expires{" "}
                            {format(new Date(t.expiresAt), "MMM d, yyyy")}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            status === "EXPIRED"
                              ? "bg-rose-500/10 text-rose-500"
                              : status === "EXPIRING_SOON"
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-emerald-500/10 text-emerald-500"
                          }`}
                        >
                          {status}
                        </span>
                      </a>
                    );
                  })
                )}
              </div>
            ),
          },
          {
            id: "quarantine",
            title: "Quarantine Cage — Out of Calibration",
            icon: <AlertTriangle className="h-4 w-4 text-rose-500" />,
            body: (
              <div className="space-y-2">
                {expired.length === 0 ? (
                  <p className="text-sm text-emerald-500">
                    ✓ No instruments in quarantine.
                  </p>
                ) : (
                  expired.map((t: any) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-rose-500/5 border border-rose-500/20"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-1 truncate">
                          {t.name} · {t.serialNumber}
                        </p>
                        <p className="text-xs text-text-3">
                          Expired {format(new Date(t.expiresAt), "MMM d, yyyy")}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-rose-500 shrink-0">
                        BLOCKED
                      </span>
                    </div>
                  ))
                )}
                <p className="text-xs text-text-3 mt-2">
                  Expired instruments are hard-blocked from quality inspections
                  (CALIBRATION_BLOCKED audit).
                </p>
              </div>
            ),
          },
          {
            id: "issues",
            title: "Issue / Return Log",
            icon: <ArrowDownToLine className="h-4 w-4 text-sky-500" />,
            body: (
              <div className="space-y-2">
                {issues.slice(0, 6).map((i: any) => (
                  <div
                    key={i.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-1 truncate">
                        {i.calibratedTool?.name || "Tool"} → {i.issuedToName}
                      </p>
                      <p className="text-xs text-text-3">
                        Issued {format(new Date(i.issuedAt), "MMM d")} ·{" "}
                        {i.returnedAt
                          ? "returned " +
                            format(new Date(i.returnedAt), "MMM d")
                          : "due " +
                            format(new Date(i.expectedReturnAt), "MMM d")}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        i.returnedAt
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-amber-500/10 text-amber-500"
                      }`}
                    >
                      {i.returnedAt ? "RETURNED" : "OUT"}
                    </span>
                  </div>
                ))}
              </div>
            ),
          },
        ]}
        feed={feed}
        feedTitle="Custody Feed"
        feedIcon={<ClipboardList className="h-4 w-4 text-teal-500" />}
        feedEmpty="No instrument movements yet."
      />
    </div>
  );
}
