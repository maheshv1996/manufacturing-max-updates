import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.isOwner && !canAny(user, ["ops.edit", "supply.edit", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { workOrderId, eanCode } = body;

    if (!workOrderId || !eanCode) {
      return NextResponse.json(
        { error: "Work Order ID and EAN Code are required" },
        { status: 400 },
      );
    }

    const actor = user.name || user.id || "Operator";

    const updated = await prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.update({
        where: { id: workOrderId },
        data: { eanCode: eanCode.trim() },
        include: { product: true },
      });

      await logAuditTx(tx, {
        actor,
        action: "EAN_ASSIGNED",
        entityType: "WorkOrder",
        entityId: workOrderId,
        details: `Assigned EAN: ${eanCode} to WO #${wo.woNumber}`,
      });

      return wo;
    });

    return NextResponse.json({ success: true, workOrder: updated });
  } catch (error: any) {
    console.error("Failed to assign EAN:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
