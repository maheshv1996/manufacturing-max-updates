import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAuditTx } from "@/lib/audit";
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
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const canEdit = user.isOwner || canAny(user, ["ops.edit", "system.edit"]);
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || user.email || "Admin";

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

    const workOrder = await prisma.$transaction(async (tx) => {
      const currentYear = new Date().getFullYear();
      const count = await tx.workOrder.count();
      const nextSeq = (count + 1).toString().padStart(3, "0");
      const woNumber = `WO-${currentYear}-${nextSeq}`;

      const created = await tx.workOrder.create({
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

      if (machineId) {
        await tx.productionLog.create({
          data: {
            workOrderId: created.id,
            machineId,
            goodQuantity: 0,
            scrapQuantity: 0,
            reworkQuantity: 0,
            startTime: new Date(plannedStartDate),
          },
        });
      }

      await logAuditTx(tx, {
        actor,
        action: "CREATE_WORK_ORDER",
        entityType: "WORK_ORDER",
        entityId: created.id,
        details: `Created work order ${created.woNumber}`,
      });

      return created;
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
