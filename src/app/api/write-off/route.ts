import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny, can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const DEAD_DAYS = 180;

export async function GET() {
  try {
    const [rawMaterials, requests, lastTx] = await Promise.all([
      prisma.rawMaterial.findMany({ orderBy: { name: "asc" }, take: 1000 }),
      prisma.writeOffRequest.findMany({
        include: { rawMaterial: true },
        orderBy: { requestedAt: "desc" },
        take: 300,
      }),
      prisma.inventoryTransaction.groupBy({
        by: ["rawMaterialId"],
        _max: { at: true },
      }),
    ]);

    const lastActivity = new Map<string, Date>();
    for (const row of lastTx) {
      if (row._max.at) lastActivity.set(row.rawMaterialId, row._max.at);
    }

    const cutoff = new Date(Date.now() - DEAD_DAYS * 24 * 60 * 60 * 1000);
    const deadStock = rawMaterials
      .filter((m) => {
        const last = lastActivity.get(m.id);
        if (!last) return m.currentStock > 0;
        return last < cutoff && m.currentStock > 0;
      })
      .map((m) => {
        const last = lastActivity.get(m.id);
        return {
          id: m.id,
          sku: m.sku,
          name: m.name,
          unit: m.unit,
          currentStock: m.currentStock,
          unitCost: m.unitCost,
          value: m.currentStock * m.unitCost,
          lastMovement: last || null,
          idleDays: last
            ? Math.max(
                0,
                Math.floor(
                  (Date.now() - last.getTime()) / (24 * 60 * 60 * 1000),
                ),
              )
            : null,
        };
      })
      .sort((a, b) => b.value - a.value);

    const totalValue = deadStock.reduce((a, m) => a + m.value, 0);
    const pending = requests.filter((r) => r.status === "PENDING");
    const approvedValue = requests
      .filter((r) => r.status === "APPROVED")
      .reduce((a, r) => a + r.qty * r.unitValue, 0);

    return NextResponse.json({
      deadStock,
      requests,
      stats: {
        materials: deadStock.length,
        totalValue,
        pending: pending.length,
        approvedValue,
      },
    });
  } catch (error) {
    console.error("GET /api/write-off error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    const actor = user.name || "Admin";
    const canEdit =
      user.isOwner ||
      canAny(user, [
        "system.edit",
        "ops.edit",
        "commercial.edit",
        "people.edit",
        "supply.edit",
      ]);
    const isFinance =
      user.isOwner || user.level === "MANAGER" || can(user, "finance.view");

    const body = await req.json();
    const { action } = body;

    if (action === "propose") {
      if (!canEdit)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const { rawMaterialId, qty, reason } = body;
      if (!rawMaterialId || !qty || parseFloat(qty) <= 0) {
        return NextResponse.json(
          { error: "Material and a positive qty are required" },
          { status: 400 },
        );
      }
      if (!reason || !reason.trim()) {
        return NextResponse.json(
          { error: "A reason is required (audit trail)." },
          { status: 400 },
        );
      }
      const material = await prisma.rawMaterial.findUnique({
        where: { id: rawMaterialId },
      });
      if (!material)
        return NextResponse.json(
          { error: "Material not found" },
          { status: 404 },
        );
      const qtyNum = parseFloat(qty);
      if (qtyNum > material.currentStock) {
        return NextResponse.json(
          {
            error: `Qty ${qtyNum} exceeds current stock ${material.currentStock}`,
          },
          { status: 400 },
        );
      }
      const year = new Date().getFullYear();
      const count = await prisma.writeOffRequest.count();
      const requestNumber = `WR-${year}-${String(count + 1).padStart(3, "0")}`;
      const request = await prisma.writeOffRequest.create({
        data: {
          requestNumber,
          rawMaterialId,
          qty: qtyNum,
          unitValue: material.unitCost,
          reason,
          requestedBy: actor,
        },
        include: { rawMaterial: true },
      });
      await logAudit({
        actor,
        action: "WRITE_OFF_REQUESTED",
        entityType: "WRITE_OFF_REQUEST",
        entityId: request.id,
        details: `${requestNumber} — ${material.name} × ${qtyNum} (₹${(qtyNum * material.unitCost).toLocaleString("en-IN")}). Reason: ${reason}`,
      });
      return NextResponse.json({ success: true, request });
    }

    if (action === "approve" || action === "reject") {
      if (!isFinance) {
        return NextResponse.json(
          {
            error:
              "Finance approval required — write-off decisions are restricted to the finance desk.",
          },
          { status: 403 },
        );
      }
      const { requestId, note } = body;
      if (!requestId)
        return NextResponse.json(
          { error: "Missing requestId" },
          { status: 400 },
        );
      if (!note || !note.trim()) {
        return NextResponse.json(
          {
            error: "A written note is required for the decision (audit trail).",
          },
          { status: 400 },
        );
      }
      const request = await prisma.writeOffRequest.findUnique({
        where: { id: requestId },
        include: { rawMaterial: true },
      });
      if (!request)
        return NextResponse.json(
          { error: "Request not found" },
          { status: 404 },
        );
      if (request.status !== "PENDING") {
        return NextResponse.json(
          { error: `Request is already ${request.status}` },
          { status: 400 },
        );
      }

      if (action === "approve") {
        const updated = await prisma.writeOffRequest.update({
          where: { id: requestId },
          data: {
            status: "APPROVED",
            decidedBy: actor,
            decidedAt: new Date(),
            decisionNote: note,
          },
        });
        await prisma.inventoryTransaction.create({
          data: {
            rawMaterialId: request.rawMaterialId,
            type: "ADJUST",
            qty: -request.qty,
            unitCost: request.unitValue,
            reference: request.requestNumber,
            actorName: actor,
            at: new Date(),
          },
        });
        await prisma.rawMaterial.update({
          where: { id: request.rawMaterialId },
          data: { currentStock: { decrement: request.qty } },
        });
        await logAudit({
          actor,
          action: "WRITE_OFF_APPROVED",
          entityType: "WRITE_OFF_REQUEST",
          entityId: request.id,
          details: `${request.requestNumber} approved — ${request.rawMaterial.name} × ${request.qty} written off (stock adjusted, ₹${(request.qty * request.unitValue).toLocaleString("en-IN")}). Note: ${note}`,
        });
        return NextResponse.json({ success: true, request: updated });
      }

      const updated = await prisma.writeOffRequest.update({
        where: { id: requestId },
        data: {
          status: "REJECTED",
          decidedBy: actor,
          decidedAt: new Date(),
          decisionNote: note,
        },
      });
      await logAudit({
        actor,
        action: "WRITE_OFF_REJECTED",
        entityType: "WRITE_OFF_REQUEST",
        entityId: request.id,
        details: `${request.requestNumber} rejected (${request.rawMaterial.name}). Note: ${note}`,
      });
      return NextResponse.json({ success: true, request: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/write-off error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
