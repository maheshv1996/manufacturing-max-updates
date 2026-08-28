import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function PATCH(request: Request) {
  try {
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

    const quarantine = await (prisma as any).scrapQuarantine.findUnique({
      where: { id: quarantineId },
    });
    if (!quarantine) {
      return NextResponse.json(
        { error: "Quarantine record not found" },
        { status: 404 },
      );
    }

    const updatedQuarantine = await (prisma as any).scrapQuarantine.update({
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
            by: "system",
            at: new Date().toISOString(),
            dispositionNotes: dispositionNotes || null,
          },
        ],
      },
    });

    let createdReworkOrder = null;
    if (status === "REWORK" && targetMachineId) {
      createdReworkOrder = await (prisma as any).reworkOrder.create({
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
              by: "system",
              at: new Date().toISOString(),
              from: "Scrap disposition REWORK decision",
            },
          ],
        },
      });
    }

    await logAudit({
      actor: "system",
      action: "SCRAP_DISPOSITION_UPDATED",
      entityType: "ScrapQuarantine",
      entityId: quarantineId,
      details: `status → ${status} · rework=${!!createdReworkOrder}`,
    });

    return NextResponse.json({
      success: true,
      quarantine: updatedQuarantine,
      reworkOrder: createdReworkOrder,
    });
  } catch (error: any) {
    console.error("PATCH /api/scrap/disposition error:", error);
    return NextResponse.json(
      { error: "Failed to process scrap disposition" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
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
