import { logAuditTx } from "@/lib/audit";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workOrders = await prisma.workOrder.findMany({
      include: {
        product: true,
      },
      orderBy: { priority: "asc" },
    });

    const lanes = {
      BACKLOG: workOrders.filter((w) => w.status === "PLANNED" && w.currentSeq === 1),
      STAGED: workOrders.filter((w) => w.status === "PLANNED" && w.currentSeq > 1),
      IN_PROGRESS: workOrders.filter((w) => w.status === "IN_PROGRESS"),
      QUALITY_GATE: workOrders.filter((w) => w.faiRequired && w.status !== "COMPLETED"),
      COMPLETED: workOrders.filter((w) => w.status === "COMPLETED"),
    };

    return NextResponse.json({ success: true, lanes, total: workOrders.length });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    const actor = user.name || "System";

    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
    }
    const { workOrderId, targetLane } = body;
    if (!workOrderId || !targetLane) {
      return NextResponse.json({ success: false, error: "Missing parameters" }, { status: 400 });
    }

    let status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" = "PLANNED";
    let faiRequired = false;

    if (targetLane === "BACKLOG") {
      status = "PLANNED";
    } else if (targetLane === "STAGED") {
      status = "PLANNED";
    } else if (targetLane === "IN_PROGRESS") {
      status = "IN_PROGRESS";
    } else if (targetLane === "QUALITY_GATE") {
      status = "IN_PROGRESS";
      faiRequired = true;
    } else if (targetLane === "COMPLETED") {
      status = "COMPLETED";
    }

    const updated = await prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.update({
        where: { id: workOrderId },
        data: { status, faiRequired },
        include: { product: true },
      });

      await logAuditTx(tx, {
        actor,
        action: "KANBAN_STATUS_UPDATED",
        entityType: "WorkOrder",
        entityId: wo.id,
        details: `Work order moved to status ${wo.status} (${targetLane})`,
      });

      return wo;
    });

    return NextResponse.json({ success: true, workOrder: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
