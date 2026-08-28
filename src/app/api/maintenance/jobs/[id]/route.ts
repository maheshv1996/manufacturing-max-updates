import { getUserFromHeaders, can } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      action,
      rootCause,
      countermeasure,
      partsUsed,
      costRupees,
      laborHours,
    } = body;

    const headerList = await headers();
    const actor = headerList.get("x-user-name") || "Admin";
    const user = getUserFromHeaders(headerList);

    const job = await (prisma as any).maintenanceJob.findUnique({
      where: { id },
      include: { machine: { select: { name: true } } },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Start/Close require elevated role (maintenance / production / system managers, or owner)
    const isElevated =
      user.isOwner ||
      can(user, "system.edit") ||
      can(user, "ops.edit") ||
      can(user, "maintenance.edit");

    if (action === "START") {
      if (!isElevated) {
        return NextResponse.json(
          { error: "Insufficient role" },
          { status: 403 },
        );
      }
      if (job.status !== "OPEN") {
        return NextResponse.json({ error: "Job is not OPEN" }, { status: 400 });
      }

      // P26 — Permit-to-work gate: a permit exists for this job, so it must be
      // APPROVED and within its validity window before any work can start.
      const permits = await (prisma as any).permitToWork.findMany({
        where: { maintenanceJobId: id },
      });
      if (permits.length > 0) {
        const now = new Date();
        const valid = permits.find(
          (p: any) =>
            p.status === "APPROVED" &&
            p.validFrom <= now &&
            p.validUntil >= now,
        );
        if (!valid) {
          const pending = permits.filter((p: any) => p.status === "PENDING");
          const expired = permits.filter(
            (p: any) =>
              p.status === "EXPIRED" ||
              (p.status === "APPROVED" && p.validUntil < now),
          );
          const voided = permits.filter((p: any) => p.status === "VOID");
          if (pending.length > 0) {
            return NextResponse.json(
              {
                error: `PERMIT_REQUIRED: ${pending.length} permit-to-work still awaiting the 3 approvals (EHS + Maintenance + Production) — work cannot start`,
              },
              { status: 400 },
            );
          }
          if (expired.length > 0) {
            return NextResponse.json(
              {
                error:
                  "PERMIT_EXPIRED: the permit-to-work for this job has expired — raise a fresh permit before starting work",
              },
              { status: 400 },
            );
          }
          if (voided.length > 0) {
            return NextResponse.json(
              {
                error:
                  "PERMIT_VOIDED: the permit-to-work for this job was voided — raise a fresh permit before starting work",
              },
              { status: 400 },
            );
          }
        }
      }

      const updated = await (prisma as any).maintenanceJob.update({
        where: { id },
        data: { status: "IN_PROGRESS" },
        include: { machine: { select: { id: true, name: true, code: true } } },
      });

      await logAudit({
        actor,
        action: "MAINTENANCE_JOB_START",
        entityType: "MAINTENANCE_JOB",
        entityId: id,
        details: `Started maintenance job on ${job.machine.name}`,
      });

      return NextResponse.json({ job: updated });
    }

    if (action === "CLOSE") {
      if (!isElevated) {
        return NextResponse.json(
          {
            error: "Insufficient role: manager approval required to close jobs",
          },
          { status: 403 },
        );
      }
      if (job.status !== "IN_PROGRESS") {
        return NextResponse.json(
          { error: "Job is not IN_PROGRESS" },
          { status: 400 },
        );
      }

      // P28 — RCA gate: a BREAKDOWN that ran longer than 1 hour cannot be closed
      // without a root cause AND a countermeasure. The clock starts at openedAt
      // (the moment the machine went down).
      const durationMs = Date.now() - new Date(job.openedAt).getTime();
      const overOneHour = durationMs > 60 * 60 * 1000;
      if (job.type === "BREAKDOWN" && overOneHour) {
        if (!rootCause || !rootCause.trim()) {
          return NextResponse.json(
            {
              error: `RCA_REQUIRED: this breakdown ran ${(durationMs / 3600000).toFixed(1)}h (>1h) — root cause analysis is mandatory before closing`,
            },
            { status: 400 },
          );
        }
        if (!countermeasure || !countermeasure.trim()) {
          return NextResponse.json(
            {
              error: `RCA_REQUIRED: root cause provided but a countermeasure (preventive action) is mandatory for breakdowns >1h`,
            },
            { status: 400 },
          );
        }
      }

      const updated = await (prisma as any).maintenanceJob.update({
        where: { id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closedBy: actor,
          rootCause: rootCause || null,
          countermeasure: countermeasure || null,
          partsUsed: partsUsed || null,
          costRupees: costRupees ? Number(costRupees) : null,
          laborHours: laborHours ? Number(laborHours) : null,
        },
        include: { machine: { select: { id: true, name: true, code: true } } },
      });

      await logAudit({
        actor,
        action: "MAINTENANCE_JOB_CLOSE",
        entityType: "MAINTENANCE_JOB",
        entityId: id,
        details: `Closed maintenance job on ${job.machine.name}. Root cause: ${rootCause || "N/A"}. Countermeasure: ${countermeasure || "N/A"}. Cost: ₹${costRupees || 0}. Labor: ${laborHours || 0}h`,
      });

      return NextResponse.json({ job: updated });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 },
    );
  } catch (error: any) {
    console.error("PATCH /api/maintenance/jobs/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
