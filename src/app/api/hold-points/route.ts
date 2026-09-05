import { logAuditTx } from "@/lib/audit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const canSign = user.isOwner || canAny(user, ["quality.edit", "ops.edit", "system.edit"]);
    if (!canSign) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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

    const actor = user.name || user.email || inspectorName || "Inspector";

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

      const signoffs = await prisma.$transaction(async (tx) => {
        const createdSignoffs = [];
        for (const serialUnitId of serialUnitIds) {
          const signoff = await tx.holdPointSignoff.create({
            data: {
              workOrderId,
              routingStepId,
              serialUnitId,
              inspectorName,
              inspectorOrg,
              result,
              remarks,
              signedById: signedById || user.id || "system",
            },
          });
          createdSignoffs.push(signoff);
        }

        await logAuditTx(tx, {
          action: "HOLDPOINT_SIGNED",
          actor,
          details: `Hold point signed off for ${serialUnitIds.length} serials by ${inspectorName} (${inspectorOrg}) - ${result}`,
          entityType: "WorkOrder",
          entityId: workOrderId,
        });

        return createdSignoffs;
      });

      return NextResponse.json({ success: true, count: signoffs.length });
    } else {
      // BATCH mode
      const signoff = await prisma.$transaction(async (tx) => {
        const created = await tx.holdPointSignoff.create({
          data: {
            workOrderId,
            routingStepId,
            inspectorName,
            inspectorOrg,
            result,
            remarks,
            signedById: signedById || user.id || "system",
          },
        });

        await logAuditTx(tx, {
          action: "HOLDPOINT_SIGNED",
          actor,
          details: `Hold point step ${routingStepId} signed off by ${inspectorName} (${inspectorOrg}) - ${result}`,
          entityType: "WorkOrder",
          entityId: workOrderId,
        });

        return created;
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
