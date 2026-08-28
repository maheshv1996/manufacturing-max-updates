import { prisma } from "./prisma";
import { logAudit } from "./audit";
import { DEPARTMENTS } from "./departments";

export const ACCESS_REVIEW_DAYS = 90; // quarterly

/**
 * P30 — Quarterly access review.
 *
 * runAccessReviewEnforcement() suspends any ACTIVE user who was not certified
 * in the current OPEN cycle once its due date has passed. Each suspension is
 * audited (ACCESS_SUSPENDED) and the cycle closes. This mirrors the app's
 * on-read enforcement pattern (permits auto-expire, backups auto-purge).
 */
export async function runAccessReviewEnforcement(now: Date = new Date()) {
  // Enforce the most-overdue OPEN cycle first (dueDate ascending → earliest deadline)
  const openCycle = await prisma.accessReviewCycle.findFirst({
    where: { status: "OPEN", dueDate: { lt: now } },
    orderBy: { dueDate: "asc" },
    include: { certifications: { select: { userId: true } } },
  });

  if (!openCycle) return { cycle: null, suspended: [] };
  if (openCycle.dueDate > now) return { cycle: openCycle, suspended: [] };

  const certifiedIds = new Set(openCycle.certifications.map((c) => c.userId));
  const uncertified = await prisma.user.findMany({
    where: { isActive: true },
  });
  const toSuspend = uncertified.filter(
    (u) => !certifiedIds.has(u.id) && !u.isOwner,
  );

  const suspended: { id: string; name: string; username: string }[] = [];
  for (const u of toSuspend) {
    await prisma.user.update({
      where: { id: u.id },
      data: { isActive: false, sessionEpoch: { increment: 1 } },
    });
    await logAudit({
      actor: "SYSTEM_AUTO",
      action: "ACCESS_SUSPENDED",
      entityType: "USER",
      entityId: u.id,
      details: `Auto-suspended ${u.name} — not certified in access review "${openCycle.name}" (due ${openCycle.dueDate.toLocaleDateString()})`,
    });
    suspended.push({
      id: u.id,
      name: u.name,
      username: u.username || u.employeeNumber || u.id,
    });
  }

  if (toSuspend.length > 0 || openCycle.dueDate < now) {
    await prisma.accessReviewCycle.update({
      where: { id: openCycle.id },
      data: { status: "CLOSED", closedAt: now },
    });
  }

  return { cycle: openCycle, suspended };
}

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
  const deptByPerm = Object.fromEntries(
    DEPARTMENTS.map((d) => [d.permissionKey, d.title]),
  );
  const titleByKey = Object.fromEntries(
    DEPARTMENTS.map((d) => [d.id, d.title]),
  );

  const rows = users
    .filter((u) => !u.isOwner) // owners are above the review
    .map((u) => {
      const rolePerms: string[] = Array.isArray(u.role?.permissions)
        ? u.role.permissions
        : [];
      const cert = cycle?.certifications.find((c) => c.userId === u.id) || null;
      // Certified rows show exactly what was certified; uncertified rows show what they currently hold
      const deptKeys = cert
        ? cert.depts || []
        : rolePerms.filter((p) => deptByPerm[p]);
      const depts = deptKeys.map((k) => titleByKey[k]).filter(Boolean);
      return {
        userId: u.id,
        name: u.name,
        username: u.username || u.employeeNumber || u.email || "",
        role: u.role?.name || "—",
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

  const drills = await prisma.restoreDrill.findMany({
    include: { backupJob: { select: { startedAt: true, status: true } } },
    orderBy: { drillDate: "desc" },
  });

  const backupJobs = await prisma.backupJob.findMany({
    where: { status: "SUCCESS" },
    orderBy: { startedAt: "desc" },
    take: 20,
  });

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
