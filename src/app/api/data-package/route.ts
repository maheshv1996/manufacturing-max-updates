import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    await logAudit({ actor: "system", action: "DATA_PACKAGE_CREATED", entityType: "WorkOrderDataPackage", details: "Data package created" });
  try {
    const body = await request.json();
    const { workOrderId, createdBy = "System" } = body;

    if (!workOrderId) {
      return NextResponse.json(
        { error: "workOrderId is required" },
        { status: 400 },
      );
    }

    // Check if the work order exists
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
    });

    if (!workOrder) {
      return NextResponse.json(
        { error: "Work order not found" },
        { status: 404 },
      );
    }

    // Generate package number DP-<year>-<seq>
    const year = new Date().getFullYear();
    const count = await prisma.dataPackage.count({
      where: {
        packageNumber: {
          startsWith: `DP-${year}-`,
        },
      },
    });

    const seq = (count + 1).toString().padStart(4, "0");
    const packageNumber = `DP-${year}-${seq}`;

    // Create the draft data package
    const dataPackage = await prisma.dataPackage.create({
      data: {
        packageNumber,
        workOrderId,
        status: "DRAFT",
        createdBy,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "DATA_PACKAGE_CREATED",
        actor: createdBy,
        details: `Created Draft Data Package ${packageNumber}`,
        entityType: "WorkOrder",
        entityId: workOrderId,
      },
    });

    return NextResponse.json({ success: true, dataPackage });
  } catch (error: any) {
    console.error("Error creating data package:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create data package" },
      { status: 500 },
    );
  }
}
