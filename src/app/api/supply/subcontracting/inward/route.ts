import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["supply.edit", "ops.edit", "quality.edit", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
    }

    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { challanId, receivedQty, rejectedQty, status, remarks } = body;

    if (!challanId || receivedQty === undefined) {
      return NextResponse.json(
        { error: "Challan ID and Received Quantity are required" },
        { status: 400 },
      );
    }

    const actor = user.name || headersList.get("x-user-name") || "QC Inspector";

    const challan = await prisma.$transaction(async (tx) => {
      const updated = await (tx as any).subcontractChallan.update({
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

      await logAuditTx(tx, {
        actor,
        action: "SUBCONTRACT_INWARD_RECORDED",
        entityType: "SubcontractChallan",
        entityId: updated.id,
        details: `Inward receipt for Challan ${updated.challanNumber}: Received ${receivedQty} pcs, Rejected ${rejectedQty || 0} pcs (${status || "QC_PASSED"})`,
      });

      return updated;
    });

    return NextResponse.json({ success: true, challan });
  } catch (error: any) {
    console.error("Failed to record inward receipt:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
