import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const {
      workOrderId,
      routingStepId,
      serialUnitIds,
      inspectorName,
      inspectorOrg,
      result,
      remarks,
      signedById,
    } = body;

    if (
      !workOrderId ||
      !routingStepId ||
      !inspectorName ||
      !inspectorOrg ||
      !result
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const wo = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
    });

    if (!wo) {
      return NextResponse.json(
        { error: "Work Order not found" },
        { status: 404 },
      );
    }

    if (wo.trackingMode === "SERIAL") {
      if (
        !serialUnitIds ||
        !Array.isArray(serialUnitIds) ||
        serialUnitIds.length === 0
      ) {
        return NextResponse.json(
          { error: "Serial unit IDs required in SERIAL mode" },
          { status: 400 },
        );
      }

      const signoffs = await Promise.all(
        serialUnitIds.map((serialUnitId) =>
          prisma.holdPointSignoff.create({
            data: {
              workOrderId,
              routingStepId,
              serialUnitId,
              inspectorName,
              inspectorOrg,
              result,
              remarks,
              signedById: signedById || "system",
            },
          }),
        ),
      );

      await prisma.auditLog.create({
        data: {
          action: "HOLDPOINT_SIGNED",
          actor: signedById || "system",
          details: `Hold point signed off for ${serialUnitIds.length} serials by ${inspectorName} (${inspectorOrg}) - ${result}`,
          entityType: "WorkOrder",
          entityId: workOrderId,
        },
      });

      return NextResponse.json({ success: true, count: signoffs.length });
    } else {
      // BATCH mode
      const signoff = await prisma.holdPointSignoff.create({
        data: {
          workOrderId,
          routingStepId,
          inspectorName,
          inspectorOrg,
          result,
          remarks,
          signedById: signedById || "system",
        },
      });

      await logAudit({
        action: "HOLDPOINT_SIGNED",
        actor: signedById || inspectorName || "system",
        details: `Hold point step ${routingStepId} signed off by ${inspectorName} (${inspectorOrg}) - ${result}`,
        entityType: "WorkOrder",
        entityId: workOrderId,
      });

      return NextResponse.json({ success: true, signoff });
    }
  } catch (error) {
    console.error("HoldPoint POST error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
