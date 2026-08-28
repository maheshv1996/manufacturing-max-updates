import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import HubClient from "@/app/components/shared/HubClient";
import { prisma } from "@/lib/prisma";
import {
  Cpu,
  Cog,
  Users,
  Server,
  HeartPulse,
  ShieldCheck,
  FileUp,
  FolderOpen,
  ListChecks,
  UserCog,
} from "lucide-react";
import { format } from "date-fns";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function SystemHub() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user || (!user.isOwner && !can(user, "system.view"))) {
    redirect("/login");
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [userCount, machineCount, auditEvents, recentAudits] =
    await Promise.all([
      prisma.user.count(),
      prisma.machine.count(),
      prisma.auditLog.count({ where: { at: { gte: since } } }),
      prisma.auditLog.findMany({ orderBy: { at: "desc" }, take: 8 }),
    ]);

  const feed = recentAudits.map((a) => ({
    time: format(new Date(a.at), "MMM d HH:mm"),
    title: a.action,
    detail:
      (a.actor || "system") + (a.details ? " · " + a.details.slice(0, 60) : ""),
    tone: (a.action.includes("BLOCKED") || a.action.includes("FAILED")
      ? "danger"
      : "info") as any,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="IT & Systems"
        description="ERP/MES administration, infrastructure & networks, cybersecurity, and data backups."
        icon={<Cpu className="h-5 w-5 text-rose-500" />}
      />
      <HubClient
        kpis={[
          {
            label: "Users & Roles",
            value: userCount,
            icon: <Users className="h-5 w-5 text-rose-500" />,
            hint: "active accounts",
          },
          {
            label: "Machines",
            value: machineCount,
            icon: <Server className="h-5 w-5 text-cyan-500" />,
            hint: "registered",
          },
          {
            label: "Audit Events",
            value: auditEvents,
            icon: <ListChecks className="h-5 w-5 text-amber-500" />,
            hint: "last 7 days",
          },
          {
            label: "System Modules",
            value: 6,
            icon: <Cog className="h-5 w-5 text-emerald-500" />,
            hint: "admin, infra, health…",
          },
        ]}
        quickActions={[
          {
            label: "Admin Console",
            href: "/system/admin",
            icon: <Cog className="h-4 w-4" />,
            primary: true,
          },
          {
            label: "System Health",
            href: "/system/health",
            icon: <HeartPulse className="h-4 w-4" />,
          },
          {
            label: "Data Import",
            href: "/system/import",
            icon: <FileUp className="h-4 w-4" />,
          },
          {
            label: "Infrastructure",
            href: "/system/infrastructure",
            icon: <FolderOpen className="h-4 w-4" />,
          },
        ]}
        sections={[
          {
            id: "admin",
            title: "ERP / MES Administration",
            icon: <UserCog className="h-4 w-4" />,
            open: true,
            body: (
              <div className="space-y-3 text-sm">
                <p className="text-slate-400">
                  Master data, users & roles, routing, work orders, audit trail
                  and branding all live in the Admin Console. The Data Import
                  wizard bulk-loads products, customers, suppliers and BOMs.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: "Users & Permissions",
                      href: "/system/admin?tab=users",
                      icon: <ShieldCheck className="h-4 w-4 text-rose-400" />,
                    },
                    {
                      label: "Machines",
                      href: "/system/admin?tab=machines",
                      icon: <Server className="h-4 w-4 text-cyan-400" />,
                    },
                    {
                      label: "Audit Trail",
                      href: "/system/admin?tab=audit",
                      icon: <ListChecks className="h-4 w-4 text-amber-400" />,
                    },
                    {
                      label: "Metrology & Vendors",
                      href: "/system/admin?tab=metrology",
                      icon: <Cog className="h-4 w-4 text-emerald-400" />,
                    },
                  ].map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      className="flex items-center gap-2.5 rounded-xl bg-slate-800/60 border border-slate-700 px-3 py-2.5 text-slate-300 hover:text-white hover:border-slate-600 hover:bg-slate-800/90 transition-all"
                    >
                      {l.icon}
                      <span className="font-medium">{l.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            ),
          },
          {
            id: "resilience",
            title: "Resilience & Data",
            icon: <HeartPulse className="h-4 w-4" />,
            body: (
              <div className="space-y-2 text-sm text-slate-400">
                <p>
                  System Health shows uptime, database size, disk headroom, last
                  backup and the LAN address with a QR code for shop-floor
                  tablets. Backup jobs and restore flows live under Data &
                  Backups.
                </p>
              </div>
            ),
          },
        ]}
        feed={feed}
        feedTitle="Recent Audit Activity"
        feedIcon={<ListChecks className="h-4 w-4 text-amber-400" />}
        feedEmpty="No audit events this week."
      />
    </div>
  );
}
