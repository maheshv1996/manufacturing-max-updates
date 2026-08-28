import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workOrderId, eanCode } = body;

    if (!workOrderId || !eanCode) {
      return NextResponse.json(
        { error: "Work Order ID and EAN Code are required" },
        { status: 400 },
      );
    }

    const updated = await prisma.workOrder.update({
      where: { id: workOrderId },
      data: { eanCode: eanCode.trim() },
      include: { product: true },
    });

    await logAudit({
      actor: "system",
      action: "EAN_ASSIGNED",
      entityType: "WorkOrder",
      entityId: workOrderId,
      details: `Assigned EAN: ${eanCode} to WO #${updated.woNumber}`,
    });

    return NextResponse.json({ success: true, workOrder: updated });
  } catch (error: any) {
    console.error("Failed to assign EAN:", error);
    return NextResponse.json(
      { error: error.message || "Failed to assign EAN" },
      { status: 500 },
    );
  }
}
