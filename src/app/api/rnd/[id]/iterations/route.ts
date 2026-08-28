import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { sourceWorkOrderId } = body;

    if (!sourceWorkOrderId) {
      return NextResponse.json(
        { error: "sourceWorkOrderId is required" },
        { status: 400 },
      );
    }

    const sourceWorkOrder = await prisma.workOrder.findUnique({
      where: { id: sourceWorkOrderId },
    });

    if (!sourceWorkOrder) {
      return NextResponse.json(
        { error: "Source work order not found" },
        { status: 404 },
      );
    }

    const maxIterationRecord = await prisma.workOrder.findFirst({
      where: { projectId: id },
      orderBy: { iteration: "desc" },
    });

    const nextIteration =
      (maxIterationRecord?.iteration || sourceWorkOrder.iteration) + 1;

    // Deep clone basic properties
    const newWorkOrder = await prisma.workOrder.create({
      data: {
        woNumber: `RND-WO-${Date.now()}`,
        productId: sourceWorkOrder.productId,
        plantId: sourceWorkOrder.plantId,
        plannedQuantity: sourceWorkOrder.plannedQuantity,
        plannedStartDate: new Date(),
        plannedEndDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        status: "PLANNED",
        projectId: id,
        iteration: nextIteration,
      },
    });

    const headersList = await headers();
    const actor = getUserFromHeaders(headersList);
    await logAudit({
      actor: actor.name || "system",
      action: "RND_ITERATION_CLONED",
      entityType: "WorkOrder",
      entityId: newWorkOrder.id,
      details: `Cloned iteration ${nextIteration} from ${sourceWorkOrder.woNumber}`,
    });

    return NextResponse.json(
      { success: true, workOrder: newWorkOrder },
      { status: 201 },
    );
  } catch (error) {
    console.error(`POST /api/rnd/${id}/iterations error:`, error);
    return NextResponse.json(
      { error: "Failed to clone iteration" },
      { status: 500 },
    );
  }
}
