import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { headers } from "next/headers";

export async function GET(_request: Request) {
  try {
    const reports = await (prisma as any).ncrReport.findMany({
      include: {
        workOrder: true,
        product: true,
        serialUnit: true,
        quarantine: true,
        defectCode: true,
        approvedBy: true,
      },
      orderBy: { raisedAt: "desc" },
    });
    return NextResponse.json({ items: reports });
  } catch (error: any) {
    console.error("GET /api/mrb error:", error);
    return NextResponse.json(
      { error: "Failed to fetch NCR reports" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      quarantineId,
      workOrderId,
      serialUnitId,
      productId,
      quantity,
      defectCodeId,
      severity,
      description,
    } = body;
    const headerList = await headers();
    const userName = headerList.get("x-user-name") || "System";

    const ncrNo = `NCR-${new Date().getFullYear()}-${Math.floor(
      Math.random() * 10000,
    )
      .toString()
      .padStart(4, "0")}`;

    const ncr = await (prisma as any).ncrReport.create({
      data: {
        ncrNumber: ncrNo,
        quarantineId,
        workOrderId,
        serialUnitId,
        productId,
        quantity: quantity ? parseFloat(String(quantity)) : 0,
        defectCodeId,
        severity: severity || "MEDIUM",
        description: description || "Manually raised NCR",
        status: "OPEN",
        raisedBy: userName,
      },
    });

    await logAudit({
      actor: userName,
      action: "NCR_RAISED",
      entityType: "NCR",
      entityId: ncr.id,
      details: `Raised NCR ${ncrNo} for quantity ${quantity}`,
    });

    return NextResponse.json({ success: true, item: ncr });
  } catch (error: any) {
    console.error("POST /api/mrb error:", error);
    return NextResponse.json(
      { error: "Failed to create NCR report" },
      { status: 500 },
    );
  }
}
