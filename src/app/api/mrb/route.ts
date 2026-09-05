import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
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
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["quality.edit", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
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
    const userName = user.name || headerList.get("x-user-name") || "Quality Tech";

    const ncrNo = `NCR-${new Date().getFullYear()}-${Math.floor(
      Math.random() * 10000,
    )
      .toString()
      .padStart(4, "0")}`;

    const ncr = await prisma.$transaction(async (tx) => {
      const created = await (tx as any).ncrReport.create({
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

      await logAuditTx(tx, {
        actor: userName,
        action: "NCR_RAISED",
        entityType: "NCR",
        entityId: created.id,
        details: `Raised NCR ${ncrNo} for quantity ${quantity}`,
      });

      return created;
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
