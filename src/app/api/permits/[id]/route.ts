import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";
import { getUserFromHeaders, can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const APPROVAL_SLOTS: Record<
  string,
  { key: string; perm: (u: any) => boolean; label: string }
> = {
  "approve-ehs": {
    key: "ehs",
    perm: (u) => can(u, "ehs.edit") || can(u, "system.edit"),
    label: "EHS Manager",
  },
  "approve-maint": {
    key: "maint",
    perm: (u) => can(u, "maintenance.edit") || can(u, "system.edit"),
    label: "Maintenance Manager",
  },
  "approve-prod": {
    key: "prod",
    perm: (u) => can(u, "ops.edit") || can(u, "system.edit"),
    label: "Production Manager",
  },
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, reason } = body;

    const headerList = await headers();
    const actor = headerList.get("x-user-name") || "Admin";
    const user = getUserFromHeaders(headerList);

    const permit = await (prisma as any).permitToWork.findUnique({
      where: { id },
      include: {
        maintenanceJob: { include: { machine: { select: { name: true } } } },
      },
    });
    if (!permit) {
      return NextResponse.json({ error: "Permit not found" }, { status: 404 });
    }

    if (action === "VOID") {
      if (!can(user, "ehs.edit") && !can(user, "system.edit")) {
        return NextResponse.json(
          { error: "Insufficient role: EHS edit permission required" },
          { status: 403 },
        );
      }
      if (permit.status !== "PENDING" && permit.status !== "APPROVED") {
        return NextResponse.json(
          { error: "Permit is not voidable in its current state" },
          { status: 400 },
        );
      }
      const updated = await (prisma as any).permitToWork.update({
        where: { id },
        data: {
          status: "VOID",
          voidedAt: new Date(),
          voidedBy: actor,
          adjustmentHistory: {
            action: "VOID",
            by: actor,
            at: new Date().toISOString(),
            reason: reason || "",
          },
        },
        include: {
          maintenanceJob: {
            include: {
              machine: { select: { id: true, name: true, code: true } },
            },
          },
        },
      });
      await logAudit({
        actor,
        action: "PERMIT_VOID",
        entityType: "PERMIT_TO_WORK",
        entityId: id,
        details: `Voided ${permit.type} permit ${permit.permitNo} for ${permit.maintenanceJob.machine.name}. Reason: ${reason || "N/A"}`,
      });
      return NextResponse.json({ permit: updated });
    }

    const slot = APPROVAL_SLOTS[action];
    if (!slot) {
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 },
      );
    }
    if (permit.status === "VOID" || permit.status === "EXPIRED") {
      return NextResponse.json(
        { error: `Permit is ${permit.status} and cannot be approved` },
        { status: 400 },
      );
    }
    if (!slot.perm(user)) {
      return NextResponse.json(
        { error: `Insufficient role: ${slot.label} approval required` },
        { status: 403 },
      );
    }
    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: `A reason is required for ${slot.label} approval` },
        { status: 400 },
      );
    }

    const slotField: Record<
      string,
      { by: string; at: string; reason: string }
    > = {
      ehs: {
        by: "ehsApprovedBy",
        at: "ehsApprovedAt",
        reason: "ehsApprovedReason",
      },
      maint: {
        by: "maintApprovedBy",
        at: "maintApprovedAt",
        reason: "maintApprovedReason",
      },
      prod: {
        by: "prodApprovedBy",
        at: "prodApprovedAt",
        reason: "prodApprovedReason",
      },
    };
    const f = slotField[slot.key];
    if (permit[f.by]) {
      return NextResponse.json(
        { error: `${slot.label} has already approved this permit` },
        { status: 400 },
      );
    }

    const now = new Date();
    const data: any = {
      [f.by]: actor,
      [f.at]: now,
      [f.reason]: reason.trim(),
    };

    const next: Record<string, string | null> = {
      ehs: permit.ehsApprovedBy,
      maint: permit.maintApprovedBy,
      prod: permit.prodApprovedBy,
    };
    next[slot.key] = actor;
    const allApproved = ["ehs", "maint", "prod"].every((k) => next[k]);
    if (allApproved) {
      data.status = "APPROVED";
    }

    const updated = await (prisma as any).permitToWork.update({
      where: { id },
      data,
      include: {
        maintenanceJob: {
          include: {
            machine: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    await logAudit({
      actor,
      action: allApproved ? "PERMIT_APPROVED" : "PERMIT_APPROVAL_SIGNED",
      entityType: "PERMIT_TO_WORK",
      entityId: id,
      details: allApproved
        ? `${slot.label} approval completed — ${permit.type} permit ${permit.permitNo} APPROVED (${permit.maintenanceJob.machine.name}). Reason: ${reason.trim()}`
        : `${slot.label} signed ${permit.type} permit ${permit.permitNo} (${permit.maintenanceJob.machine.name}). Reason: ${reason.trim()} — awaiting remaining approvals`,
    });

    return NextResponse.json({ permit: updated });
  } catch (error: any) {
    console.error("PATCH /api/permits/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
