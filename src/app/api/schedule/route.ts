import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAuditTx } from "@/lib/audit";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "7", 10);
    const startParam = searchParams.get("start");

    const windowStart = startParam ? new Date(startParam) : new Date();
    windowStart.setHours(0, 0, 0, 0);
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + days);

    // All work orders with product routing steps & parent project
    const allWorkOrders = await prisma.workOrder.findMany({
      include: {
        project: true,
        product: {
          include: {
            routingSteps: {
              include: { machine: true, operation: true },
              orderBy: { seq: "asc" },
            },
          },
        },
        productionLogs: {
          select: { machineId: true },
          distinct: ["machineId"],
        },
      },
      orderBy: { woNumber: "asc" },
    });

    // Import projectEngine logic dynamically or compute load map
    const { calculateMachineLoadHours } = await import("@/lib/projectEngine");
    const machineLoads = calculateMachineLoadHours(allWorkOrders as any);

    return NextResponse.json({
      machines: allWorkOrders,
      machineLoads,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
    });
  } catch (err) {
    console.error("Schedule GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch schedule data" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["ops.edit", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { workOrderId, machineId, plannedStartDate, plannedEndDate, status } =
      body;

    if (!workOrderId) {
      return NextResponse.json(
        { error: "workOrderId is required" },
        { status: 400 },
      );
    }

    const start = plannedStartDate ? new Date(plannedStartDate) : null;
    const end = plannedEndDate ? new Date(plannedEndDate) : null;

    if (start && end && end <= start) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 },
      );
    }

    const updateData: Record<string, unknown> = {};
    if (plannedStartDate !== undefined) updateData.plannedStartDate = start;
    if (plannedEndDate !== undefined) updateData.plannedEndDate = end;
    if (status !== undefined) updateData.status = status;

    const actor = user.name || headersList.get("x-user-name") || "Planner";

    const updatedWO = await prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.update({
        where: { id: workOrderId },
        data: updateData,
        include: { product: true },
      });

      if (machineId) {
        await tx.productionLog.updateMany({
          where: { workOrderId },
          data: { machineId },
        });
      }

      await logAuditTx(tx, {
        actor,
        action: "UPDATE_WORK_ORDER",
        entityType: "WORK_ORDER",
        entityId: wo.id,
        details: `Updated work order ${wo.woNumber}`,
      });

      return wo;
    });

    return NextResponse.json({ success: true, workOrder: updatedWO });
  } catch (err) {
    console.error("Schedule POST error:", err);
    return NextResponse.json(
      { error: "Failed to update schedule" },
      { status: 500 },
    );
  }
}
