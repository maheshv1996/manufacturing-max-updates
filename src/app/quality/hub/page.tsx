import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import HubClient from "@/app/components/shared/HubClient";
import { prisma } from "@/lib/prisma";
import {
  ShieldCheck,
  ClipboardX,
  FileCheck2,
  ListChecks,
  Ruler,
  AlertTriangle,
  ClipboardList,
  TrendingUp,
  PlusCircle,
} from "lucide-react";
import { format } from "date-fns";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function QualityHub() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user || (!user.isOwner && !can(user, "quality.view"))) {
    redirect("/login");
  }
  const [ncrs, eightD, ppaps, faiReports, complaints] = await Promise.all([
    prisma.ncrReport.findMany({ orderBy: { raisedAt: "desc" }, take: 100 }),
    prisma.eightDReport.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.ppapSubmission.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.faiReport.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.customerComplaint.findMany({
      orderBy: { raisedAt: "desc" },
      take: 100,
    }),
    prisma.qualityInspection.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const openNcrs = ncrs.filter((n) => n.status === "OPEN");
  const open8d = eightD.filter((e) => e.status !== "CLOSED");
  const ppapPending = ppaps.filter(
    (p) => p.status === "SUBMITTED" || p.status === "IN_PROGRESS",
  );
  const faiOpen = faiReports.filter((f) => f.status === "IN_PROGRESS");
  const openComplaints = complaints.filter((c) => c.status !== "CLOSED");
  const criticalNcrs = ncrs.filter(
    (n) => n.severity === "CRITICAL" && n.status === "OPEN",
  );

  const feed = [
    ...ncrs.slice(0, 5).map((n: any) => ({
      time: format(new Date(n.raisedAt), "MMM d"),
      title: n.ncrNumber + " · " + n.description.slice(0, 48),
      detail:
        "Severity " + n.severity + " · " + (n.disposition || "No disposition"),
      tone: (n.severity === "CRITICAL"
        ? "danger"
        : n.severity === "HIGH"
          ? "warn"
          : "info") as any,
      href: "/mrb",
    })),
    ...eightD.slice(0, 4).map((e: any) => ({
      time: format(new Date(e.createdAt), "MMM d"),
      title:
        e.reportNumber +
        " · " +
        (e.problemStatement || e.title || "").slice(0, 48),
      detail: "Status: " + e.status,
      tone: (e.severity === "CRITICAL" ? "danger" : "warn") as any,
      href: "/quality/8d",
    })),
  ].slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quality Hub"
        description="IQC, IPQC, FQC, NDT, NCR/MRB, 8D/CAPA, PPAP and QMS audits — one command centre."
        icon={<ShieldCheck className="h-5 w-5 text-emerald-500" />}
      />
      <HubClient
        kpis={[
          {
            label: "Open NCRs",
            value: openNcrs.length,
            icon: <ClipboardX className="h-5 w-5 text-rose-500" />,
            tone: openNcrs.length ? "text-rose-500" : undefined,
            hint: "critical: " + criticalNcrs.length,
          },
          {
            label: "Open 8D / CAPA",
            value: open8d.length,
            icon: <FileCheck2 className="h-5 w-5 text-orange-500" />,
            hint: "problem solving",
          },
          {
            label: "PPAP Pending",
            value: ppapPending.length,
            icon: <ListChecks className="h-5 w-5 text-sky-500" />,
            hint: "awaiting action",
          },
          {
            label: "Open Complaints",
            value: openComplaints.length,
            icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
            hint: "customer quality",
          },
        ]}
        quickActions={[
          {
            label: "Raise NCR",
            href: "/mrb",
            icon: <PlusCircle className="h-4 w-4" />,
            primary: true,
          },
          {
            label: "New 8D",
            href: "/quality/8d",
            icon: <FileCheck2 className="h-4 w-4" />,
          },
          {
            label: "PPAP & Control Plans",
            href: "/quality/ppap",
            icon: <ListChecks className="h-4 w-4" />,
          },
          {
            label: "Gage R&R",
            href: "/quality/grr",
            icon: <Ruler className="h-4 w-4" />,
          },
          {
            label: "QMS Audits",
            href: "/system/qms",
            icon: <ClipboardList className="h-4 w-4" />,
          },
        ]}
        sections={[
          {
            id: "ncr",
            title: "NCR / MRB — Non-Conformance Board",
            icon: <ClipboardX className="h-4 w-4 text-rose-500" />,
            open: true,
            body: (
              <div className="space-y-2">
                {ncrs.length === 0 ? (
                  <p className="text-sm text-text-3">No NCRs logged.</p>
                ) : (
                  ncrs.slice(0, 7).map((n: any) => (
                    <a
                      key={n.id}
                      href="/mrb"
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-1 truncate">
                          {n.ncrNumber}
                        </p>
                        <p className="text-xs text-text-3 truncate">
                          {n.description.slice(0, 70)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            n.severity === "CRITICAL"
                              ? "bg-rose-500/10 text-rose-500"
                              : n.severity === "HIGH"
                                ? "bg-orange-500/10 text-orange-500"
                                : "bg-amber-500/10 text-amber-500"
                          }`}
                        >
                          {n.severity}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            n.status === "CLOSED"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-sky-500/10 text-sky-500"
                          }`}
                        >
                          {n.status}
                        </span>
                      </div>
                    </a>
                  ))
                )}
              </div>
            ),
          },
          {
            id: "8d",
            title: "8D / CAPA — Problem Solving",
            icon: <FileCheck2 className="h-4 w-4 text-orange-500" />,
            body: (
              <div className="space-y-2">
                {eightD.slice(0, 5).map((e: any) => (
                  <a
                    key={e.id}
                    href="/quality/8d"
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-1 truncate">
                        {e.reportNumber}
                      </p>
                      <p className="text-xs text-text-3 truncate">
                        {(e.problemStatement || e.title || "").slice(0, 70)}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        e.status === "CLOSED"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : e.status === "CRITICAL"
                            ? "bg-rose-500/10 text-rose-500"
                            : "bg-amber-500/10 text-amber-500"
                      }`}
                    >
                      {e.status}
                    </span>
                  </a>
                ))}
              </div>
            ),
          },
          {
            id: "ppap",
            title: "PPAP & Control Plans",
            icon: <ListChecks className="h-4 w-4 text-sky-500" />,
            body: (
              <div className="space-y-2">
                {ppaps.slice(0, 5).map((p: any) => (
                  <a
                    key={p.id}
                    href="/quality/ppap"
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-1 truncate">
                        {p.ppapNumber} · {p.product?.name || p.productId}
                      </p>
                      <p className="text-xs text-text-3">
                        Level {p.submissionLevel} · Rev {p.revision}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        p.status === "APPROVED"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : p.status === "REJECTED"
                            ? "bg-rose-500/10 text-rose-500"
                            : "bg-amber-500/10 text-amber-500"
                      }`}
                    >
                      {p.status}
                    </span>
                  </a>
                ))}
              </div>
            ),
          },
          {
            id: "spc",
            title: "In-Process QC & SPC",
            icon: <TrendingUp className="h-4 w-4 text-emerald-500" />,
            body: (
              <div className="space-y-2">
                <a
                  href="/ops/spc"
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                >
                  <span className="text-sm font-medium text-text-1">
                    SPC Control Charts
                  </span>
                  <span className="text-xs font-semibold text-emerald-500">
                    Live →
                  </span>
                </a>
                <a
                  href="/fai"
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                >
                  <span className="text-sm font-medium text-text-1">
                    First Article Inspections
                  </span>
                  <span className="text-xs font-semibold text-emerald-500">
                    {faiOpen.length} open →
                  </span>
                </a>
                <a
                  href="/certs"
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                >
                  <span className="text-sm font-medium text-text-1">
                    Incoming QC — Material Certs
                  </span>
                  <span className="text-xs font-semibold text-emerald-500">
                    Register →
                  </span>
                </a>
                <a
                  href="/reports/special-process-vendors"
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                >
                  <span className="text-sm font-medium text-text-1">
                    NDT — Special Process Vendors
                  </span>
                  <span className="text-xs font-semibold text-emerald-500">
                    Register →
                  </span>
                </a>
              </div>
            ),
          },
        ]}
        feed={feed}
        feedTitle="Quality Feed"
        feedIcon={<ShieldCheck className="h-4 w-4 text-emerald-500" />}
        feedEmpty="No quality events yet."
      />
    </div>
  );
}
