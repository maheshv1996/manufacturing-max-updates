import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import { requireManagerLevel, validateReason } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireManagerLevel(user);
  if (!gate.ok)
    return NextResponse.json({ error: gate.error }, { status: 403 });

  try {
    const { workOrderId, operatorId, machineId, reason } = await req.json();
    if (!workOrderId || !operatorId) {
      return NextResponse.json(
        { error: "workOrderId and operatorId required" },
        { status: 400 },
      );
    }
    const reasonCheck = validateReason({ reason });
    if (!reasonCheck.ok)
      return NextResponse.json({ error: reasonCheck.error }, { status: 400 });

    const [wo, operator] = await Promise.all([
      prisma.workOrder.findUnique({ where: { id: workOrderId } }),
      prisma.user.findUnique({ where: { id: operatorId } }),
    ]);
    if (!wo)
      return NextResponse.json(
        { error: "Work order not found" },
        { status: 404 },
      );
    if (!operator)
      return NextResponse.json(
        { error: "Operator not found" },
        { status: 404 },
      );

    const existing = await prisma.assignmentOverride.findFirst({
      where: { workOrderId, operatorId },
    });
    if (existing)
      return NextResponse.json({
        success: true,
        record: existing,
        deduped: true,
      });

    const record = await prisma.assignmentOverride.create({
      data: {
        workOrderId,
        operatorId,
        machineId: machineId ?? null,
        assignedBy: user.name ?? "Manager",
        reason: reasonCheck.reason ?? "",
      },
    });
    await logAudit({
      actor: user.name || "Admin",
      action: "ASSIGN_OVERRIDE",
      entityType: "WORK_ORDER",
      entityId: wo.id,
      details: `${wo.woNumber} → ${operator.name} (skill override: ${reasonCheck.reason})`,
    });
    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error("POST /api/operator/assign-override error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
