import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workOrderId = searchParams.get("workOrderId");

    const whereClause: any = {};
    if (workOrderId) {
      whereClause.workOrderId = workOrderId;
    }

    const reports = await prisma.faiReport.findMany({
      where: whereClause,
      include: {
        workOrder: true,
        product: true,
        serialUnit: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(reports);
  } catch (error) {
    console.error("GET /api/fai error:", error);
    return NextResponse.json(
      { error: "Failed to fetch FAI reports" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const canEdit = user.isOwner || canAny(user, ["quality.edit", "system.edit"]);
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const userName = user.name || user.email || "System";

    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { workOrderId, serialUnitId, type, customerName, drawingRevision } =
      body;

    if (!workOrderId) {
      return NextResponse.json(
        { error: "Work Order ID is required" },
        { status: 400 },
      );
    }

    const wo = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
    });

    if (!wo) {
      return NextResponse.json(
        { error: "Work Order not found" },
        { status: 404 },
      );
    }

    const report = await prisma.$transaction(async (tx) => {
      const faiNumber = `FAI-${new Date().getFullYear()}-${Math.floor(
        Math.random() * 10000,
      )
        .toString()
        .padStart(4, "0")}`;

      const created = await tx.faiReport.create({
        data: {
          faiNumber,
          workOrderId,
          productId: wo.productId,
          serialUnitId: serialUnitId || null,
          type: type || "FULL",
          customerName: customerName || wo.customerName || "Customer",
          drawingRevision: drawingRevision || "Rev A",
          preparedBy: userName,
        },
      });

      await logAuditTx(tx, {
        actor: userName,
        action: "FAI_CREATED",
        entityType: "FAI_REPORT",
        entityId: created.id,
        details: `Created FAI Report ${created.faiNumber}`,
      });

      return created;
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error("POST /api/fai error:", error);
    return NextResponse.json(
      { error: "Failed to create FAI report" },
      { status: 500 },
    );
  }
}
