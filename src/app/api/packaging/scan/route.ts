import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ean, operatorId, shiftId, workOrderId } = body;

    const cleanEan = (ean || "").trim();
    if (!cleanEan && !workOrderId) {
      return NextResponse.json(
        { error: "EAN barcode or Work Order ID is required" },
        { status: 400 },
      );
    }

    // Auto-detect active shift if not provided
    let resolvedShiftId = shiftId;
    if (!resolvedShiftId) {
      const shifts = await prisma.shift.findMany({ where: { isActive: true } });
      const now = new Date();
      const nowStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const shift =
        shifts.find((s) => {
          if (s.startTime <= s.endTime) {
            return nowStr >= s.startTime && nowStr <= s.endTime;
          } else {
            return nowStr >= s.startTime || nowStr <= s.endTime;
          }
        }) ||
        shifts[0] ||
        null;
      resolvedShiftId = shift?.id || null;
    }

    // Find target Work Order
    let workOrder = null;
    if (workOrderId) {
      workOrder = await prisma.workOrder.findUnique({
        where: { id: workOrderId },
        include: { product: true },
      });
    }

    if (!workOrder && cleanEan) {
      // 1. Direct EAN Match
      workOrder = await prisma.workOrder.findFirst({
        where: {
          eanCode: cleanEan,
          status: { in: ["IN_PROGRESS", "PLANNED"] },
        },
        include: { product: true },
        orderBy: { updatedAt: "desc" },
      });

      // 2. Product SKU Match
      if (!workOrder) {
        workOrder = await prisma.workOrder.findFirst({
          where: {
            product: { sku: cleanEan },
            status: { in: ["IN_PROGRESS", "PLANNED"] },
          },
          include: { product: true },
          orderBy: { updatedAt: "desc" },
        });
      }

      // 3. Work Order Number Match
      if (!workOrder) {
        workOrder = await prisma.workOrder.findFirst({
          where: {
            woNumber: cleanEan,
          },
          include: { product: true },
        });
      }
    }

    if (!workOrder) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown Barcode / EAN: "${cleanEan}". No active Work Order found with this code.`,
          code: "UNKNOWN_EAN",
        },
        { status: 404 },
      );
    }

    const newPackedQty = workOrder.packedQuantity + 1;
    const isOverpack = newPackedQty > workOrder.plannedQuantity;
    const resultStatus = isOverpack ? "OVERPACK" : "SUCCESS";

    // Auto-update work order status if planned quantity is reached
    const updateData: any = {
      packedQuantity: newPackedQty,
    };
    if (workOrder.status === "PLANNED") {
      updateData.status = "IN_PROGRESS";
    }

    const [updatedWo, scanLog] = await Promise.all([
      prisma.workOrder.update({
        where: { id: workOrder.id },
        data: updateData,
        include: { product: true },
      }),
      prisma.packagingScanLog.create({
        data: {
          workOrderId: workOrder.id,
          ean: cleanEan || workOrder.eanCode || workOrder.product.sku,
          operatorId: operatorId || null,
          shiftId: resolvedShiftId,
          result: resultStatus,
          quantity: 1,
        },
        include: {
          workOrder: {
            select: {
              id: true,
              woNumber: true,
              plannedQuantity: true,
              packedQuantity: true,
              product: { select: { name: true, sku: true } },
            },
          },
          operator: { select: { id: true, name: true } },
          shift: { select: { id: true, name: true } },
        },
      }),
    ]);

    await logAudit({
      actor: operatorId || "system",
      action: "PACKAGING_SCAN",
      entityType: "WorkOrder",
      entityId: workOrder.id,
      details: `Packed unit 1x for WO #${workOrder.woNumber} (${newPackedQty}/${workOrder.plannedQuantity}) · EAN: ${cleanEan || "N/A"}`,
    });

    return NextResponse.json({
      success: true,
      result: resultStatus,
      workOrder: updatedWo,
      scanLog,
      message: isOverpack
        ? `Overpack warning: ${newPackedQty}/${workOrder.plannedQuantity} packed!`
        : `Packed successfully (${newPackedQty}/${workOrder.plannedQuantity})`,
    });
  } catch (error: any) {
    console.error("Packaging scan error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process packaging scan" },
      { status: 500 },
    );
  }
}
