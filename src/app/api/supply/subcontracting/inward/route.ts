import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { challanId, receivedQty, rejectedQty, status, remarks } = body;

    if (!challanId || receivedQty === undefined) {
      return NextResponse.json(
        { error: "Challan ID and Received Quantity are required" },
        { status: 400 },
      );
    }

    const challan = await (prisma as any).subcontractChallan.update({
      where: { id: challanId },
      data: {
        receivedQty: parseInt(receivedQty, 10),
        rejectedQty: parseInt(rejectedQty || 0, 10),
        receivedAt: new Date(),
        status: status || "QC_PASSED",
        remarks: remarks || undefined,
      },
      include: {
        workOrder: {
          include: { product: true },
        },
      },
    });

    await logAudit({
      actor: "system",
      action: "SUBCONTRACT_INWARD_RECORDED",
      entityType: "SubcontractChallan",
      entityId: challan.id,
      details: `Inward receipt for Challan ${challan.challanNumber}: Received ${receivedQty} pcs, Rejected ${rejectedQty || 0} pcs (${status || "QC_PASSED"})`,
    });

    return NextResponse.json({ success: true, challan });
  } catch (error: any) {
    console.error("Failed to record inward receipt:", error);
    return NextResponse.json(
      { error: error.message || "Failed to record inward" },
      { status: 500 },
    );
  }
}
