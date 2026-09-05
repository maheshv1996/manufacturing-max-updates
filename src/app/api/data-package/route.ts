import { logAuditTx } from "@/lib/audit";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "ops.edit") && !can(user, "quality.edit") && !can(user, "system.edit"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { workOrderId } = body;
    const createdBy = user.name || body.createdBy || "System";

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

    // Create the draft data package atomically with audit log
    const dataPackage = await prisma.$transaction(async (tx) => {
      const pkg = await tx.dataPackage.create({
        data: {
          packageNumber,
          workOrderId,
          status: "DRAFT",
          createdBy,
        },
      });

      await logAuditTx(tx, {
        action: "DATA_PACKAGE_CREATED",
        actor: createdBy,
        details: `Created Draft Data Package ${packageNumber}`,
        entityType: "WorkOrder",
        entityId: workOrderId,
      });

      return pkg;
    });

    return NextResponse.json({ success: true, dataPackage });
  } catch (error: any) {
    console.error("Error creating data package:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
