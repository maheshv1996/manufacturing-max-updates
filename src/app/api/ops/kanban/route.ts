import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
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
    const { workOrderId, targetLane } = await req.json();
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

    const updated = await prisma.workOrder.update({
      where: { id: workOrderId },
      data: { status, faiRequired },
      include: { product: true },
    });
    await logAudit({ actor: "system", action: "KANBAN_STATUS_UPDATED", entityType: "WorkOrder", entityId: updated.id, details: `Work order moved to status ${updated.status}` });

    return NextResponse.json({ success: true, workOrder: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
