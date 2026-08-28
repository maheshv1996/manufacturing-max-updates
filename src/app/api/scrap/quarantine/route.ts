import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const items = await (prisma as any).scrapQuarantine.findMany({
      include: {
        workOrder: {
          include: {
            product: true,
          },
        },
        reworkOrders: {
          include: {
            targetMachine: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error("GET /api/scrap/quarantine error:", error);
    return NextResponse.json(
      { error: "Failed to fetch scrap quarantine records" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      workOrderId,
      quantity,
      defectCode,
      loggedBy,
      dispositionNotes,
      costEstimate,
    } = body;

    if (!workOrderId || !quantity || !defectCode) {
      return NextResponse.json(
        { error: "workOrderId, quantity, and defectCode are required" },
        { status: 400 },
      );
    }

    const record = await (prisma as any).scrapQuarantine.create({
      data: {
        workOrderId,
        quantity: parseInt(String(quantity), 10),
        defectCode,
        loggedBy: loggedBy || "Operator",
        status: "PENDING",
        dispositionNotes: dispositionNotes || null,
        costEstimate: costEstimate ? parseFloat(String(costEstimate)) : null,
      },
    });

    await logAudit({
      actor: loggedBy || "Operator",
      action: "SCRAP_QUARANTINED",
      entityType: "ScrapQuarantine",
      entityId: record.id,
      details: `wo=${workOrderId} · ${quantity} · ${defectCode} · ${loggedBy}`,
    });

    return NextResponse.json({ success: true, record });
  } catch (error: any) {
    console.error("POST /api/scrap/quarantine error:", error);
    return NextResponse.json(
      { error: "Failed to create scrap quarantine record" },
      { status: 500 },
    );
  }
}
