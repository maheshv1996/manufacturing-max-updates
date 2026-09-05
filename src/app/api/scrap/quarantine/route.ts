import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";

export async function GET() {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      !user.isOwner &&
      !can(user, "quality.edit") &&
      !can(user, "ops.edit") &&
      !can(user, "system.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
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

    const actor = user.name || loggedBy || "Operator";

    const record = await prisma.$transaction(async (tx) => {
      const rec = await (tx as any).scrapQuarantine.create({
        data: {
          workOrderId,
          quantity: parseInt(String(quantity), 10),
          defectCode,
          loggedBy: actor,
          status: "PENDING",
          dispositionNotes: dispositionNotes || null,
          costEstimate: costEstimate ? parseFloat(String(costEstimate)) : null,
        },
      });

      await logAuditTx(tx, {
        actor,
        action: "SCRAP_QUARANTINED",
        entityType: "ScrapQuarantine",
        entityId: rec.id,
        details: `wo=${workOrderId} · ${quantity} · ${defectCode} · ${actor}`,
      });

      return rec;
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
