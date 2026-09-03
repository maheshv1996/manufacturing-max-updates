import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders, can } from "@/lib/permissions";
import PageHeader from "@/app/components/shared/PageHeader";
import { Users } from "lucide-react";
import { catalogByDepartment, ROLE_CATALOG } from "@/lib/roleCatalog";

export const metadata: Metadata = {
  title: "Role Catalog",
};
export const dynamic = "force-dynamic";

const PERM_LABEL: Record<string, string> = {
  "ops.view": "Ops view", "ops.edit": "Ops edit", "ops.approve": "Ops approve",
  "supply.view": "Supply view", "supply.edit": "Supply edit", "supply.approve": "Supply approve",
  "commercial.view": "Comm view", "commercial.edit": "Comm edit", "commercial.approve": "Comm approve",
  "people.view": "People view", "people.edit": "People edit", "people.approve": "People approve",
  "system.view": "System view", "system.edit": "System edit", "system.approve": "System approve",
  "quality.view": "Quality view", "quality.edit": "Quality edit", "quality.approve": "Quality approve",
  "metrology.view": "Metro view", "metrology.edit": "Metro edit", "metrology.approve": "Metro approve",
  "engineering.view": "Eng view", "engineering.edit": "Eng edit", "engineering.approve": "Eng approve",
  "finance.view": "Finance view", "finance.edit": "Finance edit", "finance.approve": "Finance approve",
  "ehs.view": "EHS view", "ehs.edit": "EHS edit", "ehs.approve": "EHS approve",
  "maintenance.view": "Maint view", "maintenance.edit": "Maint edit", "maintenance.approve": "Maint approve",
  "projects.view": "Projects view", "projects.edit": "Projects edit", "projects.approve": "Projects approve",
  "exec.view": "Exec view", "exec.edit": "Exec edit", "exec.approve": "Exec approve",
  "legal.view": "Legal view", "legal.edit": "Legal edit",
  "risk.view": "Risk view", "risk.edit": "Risk edit",
  "brand.view": "Brand view", "brand.edit": "Brand edit",
  "sustainability.view": "Sustain view", "sustainability.edit": "Sustain edit",
  "users.manage": "User mgmt", "terminal.use": "Terminal", "reports.print": "Print",
  "records.edit": "Record edit", "kpi.override": "KPI override", "audit.view": "Audit view",
};

export default async function RoleCatalogPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id || (!user.isOwner && !can(user, "system.view"))) {
    redirect("/login");
  }

  const codes = ROLE_CATALOG.map((r) => r.code);
  const [roleRows, roleCounts] = await Promise.all([
    prisma.role.findMany({
      where: { name: { in: codes } },
      select: { id: true, name: true, permissions: true },
    }),
    prisma.user.groupBy({
      by: ["roleId"],
      _count: { _all: true },
    }),
  ]);
  const permsByRole = new Map(roleRows.map((r) => [r.name, r.permissions]));
  const countsByRoleId = new Map(roleCounts.map((c) => [c.roleId, c._count._all]));

  const groups = catalogByDepartment();
  const totalRoles = ROLE_CATALOG.length;
  const totalPerms = new Set(ROLE_CATALOG.flatMap((r) => r.perms)).size;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Role Catalog"
        description="Every role a real organisation runs, grouped by department with grade ladders and the permissions each one needs. Seeded as assignable roles — assign users in System Admin. Detail: docs/ROLES_RESPONSIBILITIES.md."
        icon={<Users className="h-5 w-5 text-sky-500" />}
        iconTone="sky"
        badge={{ label: `${totalRoles} ROLES · ${groups.length} DEPARTMENTS · ${totalPerms} PERM KEYS`, tone: "live" }}
      />

      <div className="space-y-8">
        {groups.map((g) => {
          const groupUsers = g.roles.reduce((s, r) => {
            const roleId = roleRows.find((rr) => rr.name === r.code)?.id;
            return s + (roleId ? countsByRoleId.get(roleId) || 0 : 0);
          }, 0);
          return (
            <section key={g.department}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-white tracking-wide uppercase">{g.label}</h2>
                <span className="text-[11px] text-slate-500">
                  {g.roles.length} role{g.roles.length === 1 ? "" : "s"} · {groupUsers} assigned
                </span>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {g.roles.map((r) => {
                  const stored = permsByRole.get(r.code);
                  const assigned = roleRows.find((rr) => rr.name === r.code)?.id;
                  const users = assigned ? countsByRoleId.get(assigned) || 0 : 0;
                  const livePerms = stored || r.perms;
                  return (
                    <div key={r.code} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] text-slate-500 border border-white/10 rounded px-1.5 py-0.5">{r.code}</span>
                        <h3 className="text-sm font-semibold text-white">{r.title}</h3>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {r.discipline} · {r.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {(r.grades || []).map((gd) => (
                          <span key={gd} className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10 text-slate-300">
                            {gd}
                          </span>
                        ))}
                        {!r.grades && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-slate-600">
                            single-grade
                          </span>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto ${users > 0 ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "bg-white/5 text-slate-500 border border-white/10"}`}>
                          {users} user{users === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {livePerms.map((p) => (
                          <span key={p} className="text-[10px] text-slate-400 bg-slate-800/70 border border-white/5 rounded px-1.5 py-0.5">
                            {PERM_LABEL[p] || p}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}