import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";
import { getWorkOrdersData } from "@/lib/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "ALL";

    const workOrders = await getWorkOrdersData(status);
    return NextResponse.json(workOrders);
  } catch (error) {
    console.error("Error fetching work orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch work orders" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const {
      productId,
      machineId,
      plannedQuantity,
      plannedStartDate,
      plannedEndDate,
      customerName,
      customerEmail,
      promisedDispatchDate,
      trackingMode,
    } = body;

    if (
      !productId ||
      !plannedQuantity ||
      !plannedStartDate ||
      !plannedEndDate
    ) {
      return NextResponse.json(
        {
          error:
            "Product, Planned Quantity, Start Date, and End Date are required.",
        },
        { status: 400 },
      );
    }

    // Auto-generate sequential WO number like WO-2026-XXX
    const currentYear = new Date().getFullYear();
    const count = await prisma.workOrder.count();
    const nextSeq = (count + 1).toString().padStart(3, "0");
    const woNumber = `WO-${currentYear}-${nextSeq}`;

    const workOrder = await prisma.workOrder.create({
      data: {
        woNumber,
        trackingMode: trackingMode || "BATCH",
        productId,
        plannedQuantity: Number(plannedQuantity),
        status: "PLANNED",
        plannedStartDate: new Date(plannedStartDate),
        plannedEndDate: new Date(plannedEndDate),
        customerName: customerName || null,
        customerEmail: customerEmail || null,
        promisedDispatchDate: promisedDispatchDate
          ? new Date(promisedDispatchDate)
          : new Date(plannedEndDate),
      },
      include: {
        product: true,
      },
    });

    // Assign machine via initial production log if machineId was selected
    if (machineId) {
      await prisma.productionLog.create({
        data: {
          workOrderId: workOrder.id,
          machineId,
          goodQuantity: 0,
          scrapQuantity: 0,
          reworkQuantity: 0,
          startTime: new Date(plannedStartDate),
        },
      });
    }

    const headersList = await headers();
    const actor = headersList.get("x-user-name") || "Admin";

    await logAudit({
      actor,
      action: "CREATE_WORK_ORDER",
      entityType: "WORK_ORDER",
      entityId: workOrder.id,
      details: `Created work order ${workOrder.woNumber}`,
    });

    return NextResponse.json(workOrder, { status: 201 });
  } catch (error: any) {
    console.error("Error creating work order:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create work order." },
      { status: 500 },
    );
  }
}
