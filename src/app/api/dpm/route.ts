import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel, validateReason } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";

export const maxDuration = 60;

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    !user.isOwner &&
    !canAny(user, ["ops.view", "system.view", "exec.view"])
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(dayStart.getTime() + 86400000);

    // Today's plan: WOs whose plan window covers today, or active WOs.
    const planned = await prisma.workOrder.findMany({
      where: {
        status: { in: ["PLANNED", "IN_PROGRESS"] },
        plannedStartDate: { lte: dayEnd },
      },
      include: {
        product: { select: { sku: true, name: true } },
        productionLogs: {
          select: { goodQuantity: true, scrapQuantity: true, startTime: true },
        },
      },
      orderBy: { plannedStartDate: "asc" },
      take: 50,
    });

    const rows = planned.map((wo) => {
      // Daily plan: assume plan spreads evenly across the planned window; the
      // nominal "today share" is plannedQuantity / planned days.
      const days = Math.max(
        1,
        Math.ceil(
          (wo.plannedEndDate.getTime() - wo.plannedStartDate.getTime()) /
            86400000,
        ),
      );
      const dailyPlan = Math.round(wo.plannedQuantity / days);
      const todayLogs = wo.productionLogs.filter(
        (l) => l.startTime >= dayStart && l.startTime < dayEnd,
      );
      const producedToday = todayLogs.reduce((a, l) => a + l.goodQuantity, 0);
      const scrapToday = todayLogs.reduce((a, l) => a + l.scrapQuantity, 0);
      const totalProduced = wo.productionLogs.reduce(
        (a, l) => a + l.goodQuantity,
        0,
      );
      const inScopeToday =
        wo.plannedStartDate < dayEnd && wo.plannedEndDate >= dayStart;
      return {
        id: wo.id,
        woNumber: wo.woNumber,
        productName: wo.product?.name,
        sku: wo.product?.sku,
        status: wo.status,
        dailyPlan,
        producedToday,
        scrapToday,
        totalProduced,
        plannedQuantity: wo.plannedQuantity,
        pctToday:
          dailyPlan > 0 ? Math.round((producedToday / dailyPlan) * 100) : 0,
        inScopeToday,
      };
    });

    const blockers = await prisma.dpmBlocker.findMany({
      include: { workOrder: { select: { woNumber: true } } },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    });

    const overdueCandidates = blockers.filter(
      (b) => b.status === "OPEN" && b.dueDate && b.dueDate < now,
    );

    return NextResponse.json({
      rows,
      blockers,
      overdueCandidates,
      today: now.toISOString().slice(0, 10),
    });
  } catch (error) {
    console.error("GET /api/dpm error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireManagerLevel(user);
  if (!gate.ok)
    return NextResponse.json({ error: gate.error }, { status: 403 });
  if (!canAny(user, ["ops.edit", "system.edit"]) && !user.isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action, data } = body;
    if (!action || !data)
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );
    let result: any;

    if (action === "addBlock") {
      const { description, ownerDept, dueDate, workOrderId } = data;
      if (!description || !ownerDept)
        return NextResponse.json(
          { error: "description and ownerDept required" },
          { status: 400 },
        );
      result = await prisma.dpmBlocker.create({
        data: {
          description,
          ownerDept,
          dueDate: dueDate ? new Date(dueDate) : null,
          workOrderId: workOrderId || null,
          raisedBy: user.name || "Manager",
        },
      });
      await logAudit({
        actor: user.name || "Admin",
        action: "DPM_BLOCKER_RAISED",
        entityType: "DPM_BLOCKER",
        entityId: result.id,
        details: `${description.slice(0, 100)} → ${ownerDept}${dueDate ? ` by ${dueDate}` : ""}`,
      });
    } else if (action === "resolveBlock") {
      const reason = validateReason(data);
      if (!reason.ok)
        return NextResponse.json({ error: reason.error }, { status: 400 });
      const blocker = await prisma.dpmBlocker.findUnique({
        where: { id: data.id },
      });
      if (!blocker)
        return NextResponse.json(
          { error: "Blocker not found" },
          { status: 404 },
        );
      result = await prisma.dpmBlocker.update({
        where: { id: data.id },
        data: {
          status: "RESOLVED",
          resolvedBy: user.name || "Manager",
          resolvedAt: new Date(),
        },
      });
      await logAudit({
        actor: user.name || "Admin",
        action: "DPM_BLOCKER_RESOLVED",
        entityType: "DPM_BLOCKER",
        entityId: data.id,
        details: `${reason.reason}`,
      });
    } else if (action === "deleteBlock") {
      const blocker = await prisma.dpmBlocker.findUnique({
        where: { id: data.id },
      });
      if (!blocker)
        return NextResponse.json(
          { error: "Blocker not found" },
          { status: 404 },
        );
      await prisma.dpmBlocker.delete({ where: { id: data.id } });
      await logAudit({
        actor: user.name || "Admin",
        action: "DPM_BLOCKER_DELETED",
        entityType: "DPM_BLOCKER",
        entityId: data.id,
        details: blocker.description.slice(0, 100),
      });
      return NextResponse.json({ success: true });
    } else if (action === "escalate") {
      const blocker = await prisma.dpmBlocker.findUnique({
        where: { id: data.id },
      });
      if (!blocker)
        return NextResponse.json(
          { error: "Blocker not found" },
          { status: 404 },
        );
      const existing = await prisma.escalation.findFirst({
        where: {
          sourceType: "DPM_BLOCKER",
          sourceId: blocker.id,
          status: { not: "RESOLVED" },
        },
      });
      if (existing)
        return NextResponse.json({
          success: true,
          record: existing,
          deduped: true,
        });
      result = await prisma.escalation.create({
        data: {
          sourceType: "DPM_BLOCKER",
          sourceId: blocker.id,
          title: `DPM blocker overdue · ${blocker.description.slice(0, 80)}`,
          severity: "HIGH",
          dueDate: blocker.dueDate,
          notes: `Owner dept: ${blocker.ownerDept} — overdue at DPM.`,
          escalatedAt: new Date(),
        },
      });
      await logAudit({
        actor: user.name || "Admin",
        action: "DPM_BLOCKER_ESCALATED",
        entityType: "DPM_BLOCKER",
        entityId: blocker.id,
        details: `${blocker.description.slice(0, 100)} → escalation ${result.id}`,
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/dpm error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
