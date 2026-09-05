import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";

export async function PATCH(request: Request) {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      !user.isOwner &&
      !can(user, "quality.edit") &&
      !can(user, "ops.edit") &&
      !can(user, "system.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      quarantineId,
      status, // SCRAPPED | REWORK | VENDOR_RETURN
      dispositionNotes,
      costEstimate,
      // Optional Rework Order Fields
      targetMachineId,
      routingSteps,
      extraLaborHours,
    } = body;

    if (!quarantineId || !status) {
      return NextResponse.json(
        { error: "quarantineId and status are required" },
        { status: 400 },
      );
    }

    const actor = user.name || headerList.get("x-user-name") || "Quality Inspector";

    const result = await prisma.$transaction(async (tx) => {
      const quarantine = await (tx as any).scrapQuarantine.findUnique({
        where: { id: quarantineId },
      });
      if (!quarantine) {
        throw new Error("NOT_FOUND:Quarantine record not found");
      }

      const updatedQuarantine = await (tx as any).scrapQuarantine.update({
        where: { id: quarantineId },
        data: {
          status,
          dispositionNotes: dispositionNotes || undefined,
          costEstimate:
            costEstimate !== undefined
              ? parseFloat(String(costEstimate))
              : undefined,
          adjustmentHistory: [
            ...((quarantine.adjustmentHistory as any[]) || []),
            {
              action: `DISPOSITION → ${status}`,
              by: actor,
              at: new Date().toISOString(),
              dispositionNotes: dispositionNotes || null,
            },
          ],
        },
      });

      let createdReworkOrder = null;
      if (status === "REWORK" && targetMachineId) {
        createdReworkOrder = await (tx as any).reworkOrder.create({
          data: {
            quarantineId,
            targetMachineId,
            routingSteps: routingSteps || "Default Regrinding & Re-inspection",
            extraLaborHours: extraLaborHours
              ? parseFloat(String(extraLaborHours))
              : 1.0,
            status: "PENDING",
            adjustmentHistory: [
              {
                action: "CREATED_FROM_DISPOSITION",
                by: actor,
                at: new Date().toISOString(),
                from: "Scrap disposition REWORK decision",
              },
            ],
          },
        });
      }

      await logAuditTx(tx, {
        actor,
        action: "SCRAP_DISPOSITION_UPDATED",
        entityType: "ScrapQuarantine",
        entityId: quarantineId,
        details: `status → ${status} · rework=${!!createdReworkOrder}`,
      });

      return {
        quarantine: updatedQuarantine,
        reworkOrder: createdReworkOrder,
      };
    });

    return NextResponse.json({
      success: true,
      quarantine: result.quarantine,
      reworkOrder: result.reworkOrder,
    });
  } catch (error: any) {
    if (error?.message?.startsWith("NOT_FOUND:")) {
      return NextResponse.json(
        { error: error.message.replace("NOT_FOUND:", "") },
        { status: 404 },
      );
    }
    console.error("PATCH /api/scrap/disposition error:", error);
    return NextResponse.json(
      { error: "Failed to process scrap disposition" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reworkOrders = await (prisma as any).reworkOrder.findMany({
      include: {
        quarantine: {
          include: {
            workOrder: {
              include: {
                product: true,
              },
            },
          },
        },
        targetMachine: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ reworkOrders });
  } catch (error: any) {
    console.error("GET /api/scrap/disposition error:", error);
    return NextResponse.json(
      { error: "Failed to fetch rework orders" },
      { status: 500 },
    );
  }
}
