import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel, validateReason } from "@/lib/managerGate";
import { logAuditTx } from "@/lib/audit";

export const maxDuration = 60;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = user.name || user.email || "Admin";
  try {
    const { id } = await params;
    const gate = await requireManagerLevel(user);
    if (!gate.ok)
      return NextResponse.json({ error: gate.error }, { status: 403 });
    if (!user.isOwner && !canAny(user, ["people.edit", "hr.edit", "system.edit"]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { action, data } = body;
    if (!action || !data)
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );

    const grievance = await prisma.grievance.findUnique({ where: { id } });
    if (!grievance)
      return NextResponse.json(
        { error: "Grievance not found" },
        { status: 404 },
      );

    let result: any;
    if (action === "acknowledge") {
      if (grievance.stage !== "RAISED")
        return NextResponse.json(
          { error: `Cannot acknowledge from stage ${grievance.stage}` },
          { status: 400 },
        );
      result = await prisma.$transaction(async (tx) => {
        const updated = await tx.grievance.update({
          where: { id },
          data: {
            stage: "ACKNOWLEDGED",
            acknowledgedAt: new Date(),
            acknowledgedBy: actor,
          },
        });
        await logAuditTx(tx, {
          actor,
          action: "GRIEVANCE_ACKNOWLEDGED",
          entityType: "GRIEVANCE",
          entityId: id,
          details: grievance.grievanceNumber,
        });
        return updated;
      });
    } else if (action === "start-investigation") {
      if (grievance.stage !== "ACKNOWLEDGED")
        return NextResponse.json(
          { error: `Cannot investigate from stage ${grievance.stage}` },
          { status: 400 },
        );
      result = await prisma.$transaction(async (tx) => {
        const updated = await tx.grievance.update({
          where: { id },
          data: {
            stage: "INVESTIGATING",
            investigatedAt: new Date(),
            investigatedBy: actor,
          },
        });
        await logAuditTx(tx, {
          actor,
          action: "GRIEVANCE_INVESTIGATION",
          entityType: "GRIEVANCE",
          entityId: id,
          details: grievance.grievanceNumber,
        });
        return updated;
      });
    } else if (action === "resolve") {
      const reason = validateReason(data);
      if (!reason.ok)
        return NextResponse.json({ error: reason.error }, { status: 400 });
      if (grievance.stage !== "INVESTIGATING")
        return NextResponse.json(
          { error: `Cannot resolve from stage ${grievance.stage}` },
          { status: 400 },
        );
      result = await prisma.$transaction(async (tx) => {
        const updated = await tx.grievance.update({
          where: { id },
          data: {
            stage: "RESOLVED",
            resolution: reason.reason,
            resolvedBy: actor,
            resolvedAt: new Date(),
          },
        });
        await logAuditTx(tx, {
          actor,
          action: "GRIEVANCE_RESOLVED",
          entityType: "GRIEVANCE",
          entityId: id,
          details: `${grievance.grievanceNumber} · ${(reason.reason || "").slice(0, 80)}`,
        });
        return updated;
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("PATCH /api/grievances/[id] error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
