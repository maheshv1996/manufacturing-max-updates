import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import HubClient from "@/app/components/shared/HubClient";
import { prisma } from "@/lib/prisma";
import {
  FlaskConical,
  FolderKanban,
  FileSignature,
  Ruler,
  Beaker,
  PlusCircle,
  ListChecks,
  ClipboardList,
} from "lucide-react";
import { format } from "date-fns";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function EngineeringHub() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user || (!user.isOwner && !can(user, "engineering.view"))) {
    redirect("/login");
  }
  const [projects, ecos, campaigns, faiReports] = await Promise.all([
    prisma.project.findMany({ orderBy: { updatedAt: "desc" }, take: 200 }),
    prisma.eco.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.testCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.faiReport.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  const openProjects = projects.filter(
    (p) => p.status === "OPEN" || p.status === "IN_PROGRESS",
  );
  const openEcos = ecos.filter((e) => e.status === "DRAFT");
  const runningCampaigns = campaigns.filter((c) => c.status === "RUNNING");
  const faiOpen = faiReports.filter((f) => f.status === "IN_PROGRESS");

  const feed = [
    ...ecos.slice(0, 5).map((e) => ({
      time: format(new Date(e.createdAt), "MMM d"),
      title: e.ecoNumber + " · " + e.title,
      detail: e.description.slice(0, 90),
      tone: (e.status === "APPROVED"
        ? "ok"
        : e.status === "REJECTED"
          ? "danger"
          : "info") as any,
      href: "/eco",
    })),
    ...campaigns.slice(0, 4).map((c) => ({
      time: format(new Date(c.createdAt), "MMM d"),
      title: c.campaignNumber + " · " + c.title,
      detail: "Status: " + c.status,
      tone: (c.status === "RUNNING" ? "warn" : "ok") as any,
      href: "/rnd",
    })),
  ].slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Engineering & R&D"
        description="Design, process engineering, configuration management, prototyping and validation."
        icon={<FlaskConical className="h-5 w-5 text-cyan-500" />}
      />
      <HubClient
        kpis={[
          {
            label: "Open Projects",
            value: openProjects.length,
            icon: <FolderKanban className="h-5 w-5 text-cyan-500" />,
            hint: "active",
          },
          {
            label: "Open ECOs",
            value: openEcos.length,
            icon: <FileSignature className="h-5 w-5 text-sky-500" />,
            hint: "awaiting approval",
          },
          {
            label: "Running Campaigns",
            value: runningCampaigns.length,
            icon: <Beaker className="h-5 w-5 text-purple-500" />,
            hint: "R&D lab",
          },
          {
            label: "FAI In Progress",
            value: faiOpen.length,
            icon: <Ruler className="h-5 w-5 text-emerald-500" />,
            hint: "first articles",
          },
        ]}
        quickActions={[
          {
            label: "New ECO",
            href: "/eco",
            icon: <PlusCircle className="h-4 w-4" />,
            primary: true,
          },
          {
            label: "Projects Board",
            href: "/projects",
            icon: <FolderKanban className="h-4 w-4" />,
          },
          {
            label: "R&D Lab",
            href: "/rnd",
            icon: <Beaker className="h-4 w-4" />,
          },
          {
            label: "FAI Register",
            href: "/fai",
            icon: <Ruler className="h-4 w-4" />,
          },
          {
            label: "Routings",
            href: "/system/admin?tab=routingSteps",
            icon: <ListChecks className="h-4 w-4" />,
          },
        ]}
        sections={[
          {
            id: "projects",
            title: "Product Design & Programs",
            icon: <FolderKanban className="h-4 w-4 text-cyan-500" />,
            open: true,
            body: (
              <div className="space-y-2">
                {openProjects.length === 0 ? (
                  <p className="text-sm text-text-3">No open projects.</p>
                ) : (
                  openProjects.slice(0, 6).map((p: any) => (
                    <a
                      key={p.id}
                      href="/projects"
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-1 truncate">
                          {p.name}
                        </p>
                        <p className="text-xs text-text-3 truncate">
                          {p.code} · {p.clientName}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-cyan-500 shrink-0">
                        {Math.round(p.completionPercentage)}%
                      </span>
                    </a>
                  ))
                )}
              </div>
            ),
          },
          {
            id: "eco",
            title: "Configuration Management (ECO / ECN)",
            icon: <FileSignature className="h-4 w-4 text-sky-500" />,
            body: (
              <div className="space-y-2">
                {ecos.slice(0, 6).map((e: any) => (
                  <a
                    key={e.id}
                    href="/eco"
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-1 truncate">
                        {e.ecoNumber} · {e.title}
                      </p>
                      <p className="text-xs text-text-3 truncate">
                        Raised by {e.raisedBy}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        e.status === "APPROVED"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : e.status === "REJECTED"
                            ? "bg-rose-500/10 text-rose-500"
                            : e.status === "IMPLEMENTED"
                              ? "bg-sky-500/10 text-sky-500"
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
            id: "rnd",
            title: "Prototyping & R&D Lab",
            icon: <Beaker className="h-4 w-4 text-purple-500" />,
            body: (
              <div className="space-y-2">
                {campaigns.slice(0, 5).map((c: any) => (
                  <a
                    key={c.id}
                    href="/rnd"
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-1 truncate">
                        {c.campaignNumber} · {c.title}
                      </p>
                      <p className="text-xs text-text-3">
                        Cost: ₹{c.testCostRupees.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-purple-500">
                      {c.status}
                    </span>
                  </a>
                ))}
              </div>
            ),
          },
          {
            id: "fai",
            title: "Testing & Validation (FAI)",
            icon: <Ruler className="h-4 w-4 text-emerald-500" />,
            body: (
              <div className="space-y-2">
                {faiReports.slice(0, 5).map((f: any) => (
                  <a
                    key={f.id}
                    href="/fai"
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-1 truncate">
                        {f.faiNumber}
                      </p>
                      <p className="text-xs text-text-3 truncate">
                        {f.product?.name || f.productId}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-500">
                      {f.status}
                    </span>
                  </a>
                ))}
              </div>
            ),
          },
        ]}
        feed={feed}
        feedTitle="Recent Activity"
        feedIcon={<ClipboardList className="h-4 w-4 text-cyan-500" />}
        feedEmpty="No engineering activity yet."
      />
    </div>
  );
}
