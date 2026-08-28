import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { error: "Tracking token is required" },
        { status: 400 },
      );
    }

    const workOrder = await prisma.workOrder.findFirst({
      where: {
        OR: [{ trackingToken: token }, { id: token }],
      },
      include: {
        product: {
          include: {
            routingSteps: {
              include: {
                operation: {
                  select: { code: true, name: true },
                },
              },
              orderBy: { seq: "asc" },
            },
          },
        },
        productionLogs: {
          select: { goodQuantity: true },
        },
        movementLogs: {
          select: {
            fromStation: true,
            toStation: true,
            quantity: true,
            at: true,
          },
          orderBy: { at: "desc" },
        },
      },
    });

    if (!workOrder) {
      return NextResponse.json(
        {
          error:
            "Work Order tracking record not found. Please verify your link.",
        },
        { status: 404 },
      );
    }

    // Sum good output for progress calculation
    const totalGoodQuantity = (workOrder.productionLogs || []).reduce(
      (sum, log) => sum + (log.goodQuantity || 0),
      0,
    );

    const plannedQty = workOrder.plannedQuantity || 1;
    const completionPercentage = Math.min(
      100,
      Math.round((totalGoodQuantity / plannedQty) * 100 * 10) / 10,
    );

    // Sanitize and return ONLY public non-sensitive data
    const publicTrackingData = {
      woNumber: workOrder.woNumber,
      customerName: workOrder.customerName || "Valued Customer",
      promisedDispatchDate:
        workOrder.promisedDispatchDate || workOrder.plannedEndDate,
      plannedQuantity: workOrder.plannedQuantity,
      totalGoodQuantity,
      completionPercentage,
      status: workOrder.status,
      currentSeq: workOrder.currentSeq,
      product: {
        name: workOrder.product?.name || "Manufacturing Sub-assembly",
        sku: workOrder.product?.sku || "",
        description: workOrder.product?.description || null,
      },
      routingSteps: (workOrder.product?.routingSteps || []).map((step) => ({
        id: step.id,
        seq: step.seq,
        stationName: step.stationName,
        operationName: step.operation?.name || step.stationName,
        operationCode: step.operation?.code || `OP${step.seq * 10}`,
      })),
      recentMovements: (workOrder.movementLogs || []).map((log) => ({
        fromStation: log.fromStation,
        toStation: log.toStation,
        quantity: log.quantity,
        timestamp: log.at,
      })),
    };

    return NextResponse.json(publicTrackingData);
  } catch (error) {
    console.error("Public Order Tracking GET error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve tracking details" },
      { status: 500 },
    );
  }
}
