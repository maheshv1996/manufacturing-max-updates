import { prisma } from "./prisma";
import { logAudit } from "./audit";
import { DEPARTMENTS } from "./departments";

export const ACCESS_REVIEW_DAYS = 90; // Quarterly compliance cycle (ISO 27001 / SOC 2 / AS9100)

/**
 * Quarterly Access Review & Segregation of Duties Enforcement Engine.
 *
 * Automatically suspends active uncertified user accounts when an overdue review cycle closes.
 * Rotates session epochs and writes immutable audit entries.
 */
export async function runAccessReviewEnforcement(now: Date = new Date()) {
  const safeNow = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();

  const openCycle = await prisma.accessReviewCycle.findFirst({
    where: { status: "OPEN", dueDate: { lt: safeNow } },
    orderBy: { dueDate: "asc" },
    include: { certifications: { select: { userId: true, depts: true } } },
  });

  if (!openCycle) return { cycle: null, suspended: [] };
  if (openCycle.dueDate && openCycle.dueDate.getTime() > safeNow.getTime()) {
    return { cycle: openCycle, suspended: [] };
  }

  const certifiedIds = new Set(openCycle.certifications.map((c) => c.userId));

  // Find active users (excluding system owners)
  const activeUsers = await prisma.user.findMany({
    where: { isActive: true, isOwner: false },
    select: { id: true, name: true, username: true, employeeNumber: true, email: true },
  });

  const toSuspend = activeUsers.filter((u) => !certifiedIds.has(u.id));
  const suspended: { id: string; name: string; username: string }[] = [];

  for (const u of toSuspend) {
    try {
      await prisma.user.update({
        where: { id: u.id },
        data: { isActive: false, sessionEpoch: { increment: 1 } },
      });

      await logAudit({
        actor: "SYSTEM_ACCESS_SENTINEL",
        action: "ACCESS_SUSPENDED",
        entityType: "USER",
        entityId: u.id,
        severity: "SECURITY",
        details: `Auto-suspended ${u.name} — not certified in quarterly access review cycle "${openCycle.name}" (due ${openCycle.dueDate.toISOString().slice(0, 10)})`,
      });

      suspended.push({
        id: u.id,
        name: u.name,
        username: u.username || u.employeeNumber || u.email || u.id,
      });
    } catch (err) {
      console.error(`Failed to suspend uncertified user ${u.id}:`, err);
    }
  }

  // Close the expired cycle
  await prisma.accessReviewCycle.update({
    where: { id: openCycle.id },
    data: { status: "CLOSED", closedAt: safeNow },
  });

  return { cycle: openCycle, suspended };
}

/**
 * Fetches the comprehensive quarterly access review and disaster recovery compliance state.
 */
export async function getAccessReviewState(now: Date = new Date()) {
  const { suspended } = await runAccessReviewEnforcement(now);

  const cycle = await prisma.accessReviewCycle.findFirst({
    orderBy: { dueDate: "desc" },
    include: {
      certifications: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  const users = await prisma.user.findMany({
    where: { isActive: true },
    include: { role: { select: { name: true, permissions: true } } },
    orderBy: { name: "asc" },
  });

  const certified = new Set(cycle?.certifications.map((c) => c.userId) || []);
  const deptByPerm: Record<string, string> = Object.fromEntries(
    DEPARTMENTS.map((d) => [d.permissionKey, d.title]),
  );
  const titleByKey: Record<string, string> = Object.fromEntries(
    DEPARTMENTS.map((d) => [d.id, d.title]),
  );

  const rows = users
    .filter((u) => !u.isOwner)
    .map((u) => {
      const rolePerms: string[] = Array.isArray(u.role?.permissions)
        ? u.role.permissions
        : [];
      const cert = cycle?.certifications.find((c) => c.userId === u.id) || null;

      // Direct department resolution
      const rawDeptKeys: string[] = cert && Array.isArray(cert.depts)
        ? cert.depts
        : rolePerms.map((p) => deptByPerm[p]).filter(Boolean);

      const deptKeys = Array.from(new Set(rawDeptKeys));
      const depts = deptKeys.map((k) => titleByKey[k] || k).filter(Boolean);

      return {
        userId: u.id,
        name: u.name,
        username: u.username || u.employeeNumber || u.email || "",
        role: u.role?.name || "Standard Role",
        level: u.level,
        depts,
        deptKeys,
        certified: certified.has(u.id),
        certification: cert,
        isActive: u.isActive,
      };
    })
    .sort(
      (a, b) =>
        Number(a.certified) - Number(b.certified) ||
        a.name.localeCompare(b.name),
    );

  // Compliance Disaster Recovery & Restore Drill Audits
  const [drills, backupJobs] = await Promise.all([
    prisma.restoreDrill.findMany({
      include: { backupJob: { select: { startedAt: true, status: true } } },
      orderBy: { drillDate: "desc" },
      take: 50,
    }),
    prisma.backupJob.findMany({
      where: { status: "SUCCESS" },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
  ]);

  return {
    cycle,
    suspended,
    rows,
    drills,
    backupJobs,
    totals: {
      users: rows.length,
      certified: rows.filter((r) => r.certified).length,
      pending: rows.filter((r) => !r.certified).length,
      drills: drills.length,
      passes: drills.filter((d) => d.result === "PASS").length,
    },
  };
}
