import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [challans, workOrders, vendors] = await Promise.all([
      (prisma as any).subcontractChallan.findMany({
        include: {
          workOrder: {
            include: {
              product: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.workOrder.findMany({
        where: {
          status: { in: ["PLANNED", "IN_PROGRESS"] },
        },
        include: {
          product: true,
        },
        orderBy: { woNumber: "asc" },
      }),
      prisma.specialProcessVendor.findMany({
        where: { status: "APPROVED" },
        orderBy: { name: "asc" },
      }),
    ]);

    // Compute stats
    const totalDispatched = (challans as any[]).filter(
      (c: any) => c.status === "DISPATCHED" || c.status === "PROCESSING",
    ).length;
    const totalReceived = (challans as any[]).filter(
      (c: any) =>
        c.status === "RECEIVED" ||
        c.status === "QC_PASSED" ||
        c.status === "CLOSED",
    ).length;
    const totalRejected = (challans as any[]).reduce(
      (sum: number, c: any) => sum + (c.rejectedQty || 0),
      0,
    );

    return NextResponse.json({
      challans,
      workOrders,
      vendors,
      stats: {
        totalChallans: (challans as any[]).length,
        activeAtVendors: totalDispatched,
        inwardCompleted: totalReceived,
        totalRejections: totalRejected,
      },
    });
  } catch (error: any) {
    console.error("Failed to load subcontracting challans:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const {
      workOrderId,
      vendorName,
      processType,
      dispatchedQty,
      expectedReturn,
      vehicleNumber,
      remarks,
    } = body;

    if (!workOrderId || !vendorName || !processType || !dispatchedQty) {
      return NextResponse.json(
        {
          error:
            "Work Order, Vendor, Process Type, and Dispatched Qty are required",
        },
        { status: 400 },
      );
    }

    const challanNumber = `DC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const challan = await (prisma as any).subcontractChallan.create({
      data: {
        challanNumber,
        workOrderId,
        vendorName,
        processType,
        dispatchedQty: parseInt(dispatchedQty, 10),
        expectedReturn: expectedReturn ? new Date(expectedReturn) : null,
        vehicleNumber: vehicleNumber || null,
        remarks: remarks || null,
        status: "DISPATCHED",
      },
      include: {
        workOrder: {
          include: { product: true },
        },
      },
    });

    await logAudit({
      actor: "system",
      action: "SUBCONTRACT_CHALLAN_CREATED",
      entityType: "SubcontractChallan",
      entityId: challan.id,
      details: `Dispatched ${dispatchedQty} pcs of ${challan.workOrder.product.name} to ${vendorName} for ${processType} (Challan: ${challanNumber})`,
    });

    return NextResponse.json({ success: true, challan });
  } catch (error: any) {
    console.error("Failed to create subcontract challan:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
