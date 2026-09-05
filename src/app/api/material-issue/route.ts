import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAuditTx } from "@/lib/audit";
import { nextSequenceTx } from "@/lib/sequence";

export const maxDuration = 60;

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [slips, workOrders] = await Promise.all([
      prisma.materialIssueSlip.findMany({
        include: {
          workOrder: { select: { woNumber: true } },
          rawMaterial: true,
        },
        orderBy: { issuedAt: "desc" },
        take: 100,
      }),
      prisma.workOrder.findMany({
        where: { status: { in: ["PLANNED", "IN_PROGRESS"] } },
        include: {
          product: {
            include: { bomLines: { include: { rawMaterial: true } } },
          },
          materialIssueSlips: { include: { rawMaterial: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    // Readiness per WO: BOM requirement vs already-issued vs stock on hand.
    const readiness = workOrders.map((wo) => {
      const rows = (wo.product.bomLines || []).map((b) => {
        const issued = wo.materialIssueSlips
          .filter((s) => s.rawMaterialId === b.rawMaterialId)
          .reduce((s, x) => s + x.qty, 0);
        const required = (wo.plannedQuantity || 0) * b.qtyPerUnit;
        return {
          rawMaterialId: b.rawMaterialId,
          sku: b.rawMaterial.sku,
          name: b.rawMaterial.name,
          unit: b.rawMaterial.unit,
          required,
          issued,
          stock: b.rawMaterial.currentStock,
          shortBy: Math.max(0, required - issued),
          ready: issued >= required,
        };
      });
      return {
        id: wo.id,
        woNumber: wo.woNumber,
        status: wo.status,
        product: wo.product.name,
        rows,
        readyAll: rows.length > 0 && rows.every((r) => r.ready),
      };
    });

    return NextResponse.json({
      slips,
      readiness,
      stats: { slips: slips.length, wos: workOrders.length },
    });
  } catch (error) {
    console.error("GET /api/material-issue error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isOwner && !canAny(user, ["ops.edit", "supply.edit", "system.edit"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { workOrderId, rawMaterialId, qty, batchNo, heatNo, issuedTo } = body;
    if (!workOrderId || !rawMaterialId || qty == null || Number(qty) <= 0) {
      return NextResponse.json(
        { error: "workOrderId, rawMaterialId and qty (>0) required" },
        { status: 400 },
      );
    }
    const [wo, rm] = await Promise.all([
      prisma.workOrder.findUnique({
        where: { id: workOrderId },
        include: { product: true },
      }),
      prisma.rawMaterial.findUnique({ where: { id: rawMaterialId } }),
    ]);
    if (!wo || !rm)
      return NextResponse.json(
        { error: "Work order or material not found" },
        { status: 404 },
      );
    if (rm.currentStock < Number(qty)) {
      return NextResponse.json(
        {
          error: `Insufficient stock: ${rm.name} has ${rm.currentStock} ${rm.unit} (${Number(qty)} requested)`,
        },
        { status: 400 },
      );
    }

    const actor = user.name || user.email || "Storekeeper";

    const slip = await prisma.$transaction(async (tx) => {
      // Re-verify stock inside transaction to avoid race conditions
      const freshRm = await (tx as any).rawMaterial.findUnique({ where: { id: rawMaterialId } });
      if (!freshRm || freshRm.currentStock < Number(qty)) {
        throw Object.assign(new Error(`Insufficient stock: current stock is ${freshRm?.currentStock ?? 0}`), { code: "INSUFFICIENT_STOCK" });
      }

      const issueNumber = await nextSequenceTx(tx as any, "MIS", 4);
      const createdSlip = await (tx as any).materialIssueSlip.create({
        data: {
          issueNumber,
          workOrderId,
          rawMaterialId,
          qty: Number(qty),
          batchNo: batchNo || null,
          heatNo: heatNo || null,
          issuedBy: actor,
          issuedTo: issuedTo || null,
          reference: wo.woNumber,
        },
        include: { rawMaterial: true, workOrder: { select: { woNumber: true } } },
      });

      // Auto-post consumption: stock OUT + inventory transaction + job costing.
      const unitCost = freshRm.unitCost || rm.unitCost || 0;
      await (tx as any).rawMaterial.update({
        where: { id: rawMaterialId },
        data: { currentStock: { decrement: Number(qty) } },
      });
      await (tx as any).inventoryTransaction.create({
        data: {
          rawMaterialId,
          type: "OUT",
          qty: Number(qty),
          unitCost,
          batchNo: batchNo || null,
          reference: wo.woNumber,
          workOrderId,
          actorName: actor,
          adjustmentHistory: { slip: issueNumber, heatNo: heatNo || null },
        },
      });
      await (tx as any).workOrder.update({
        where: { id: workOrderId },
        data: { materialCostTotal: { increment: Number(qty) * unitCost } },
      });

      await logAuditTx(tx, {
        actor,
        action: "MATERIAL_ISSUED",
        entityType: "MATERIAL_ISSUE_SLIP",
        entityId: createdSlip.id,
        details: `${issueNumber} · ${freshRm.name} × ${qty} ${freshRm.unit} → ${wo.woNumber}${batchNo ? ` · batch ${batchNo}` : ""} · ₹${(Number(qty) * unitCost).toFixed(0)}`,
      });

      return createdSlip;
    });

    return NextResponse.json({ success: true, slip }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "INSUFFICIENT_STOCK") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/material-issue error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
