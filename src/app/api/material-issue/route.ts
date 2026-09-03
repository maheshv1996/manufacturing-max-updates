import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

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

    const seq = await prisma.materialIssueSlip.count();
    const slip = await prisma.materialIssueSlip.create({
      data: {
        issueNumber: `MIS-${new Date().getFullYear()}-${String(seq + 1).padStart(4, "0")}`,
        workOrderId,
        rawMaterialId,
        qty: Number(qty),
        batchNo: batchNo || null,
        heatNo: heatNo || null,
        issuedBy: user.name || "Storekeeper",
        issuedTo: issuedTo || null,
        reference: wo.woNumber,
      },
      include: { rawMaterial: true, workOrder: { select: { woNumber: true } } },
    });

    // Auto-post consumption: stock OUT + inventory transaction + job costing.
    const unitCost = rm.unitCost || 0;
    await prisma.rawMaterial.update({
      where: { id: rawMaterialId },
      data: { currentStock: { decrement: Number(qty) } },
    });
    await prisma.inventoryTransaction.create({
      data: {
        rawMaterialId,
        type: "OUT",
        qty: Number(qty),
        unitCost,
        batchNo: batchNo || null,
        reference: wo.woNumber,
        workOrderId,
        actorName: user.name || "Storekeeper",
        adjustmentHistory: { slip: slip.issueNumber, heatNo: heatNo || null },
      },
    });
    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: { materialCostTotal: { increment: Number(qty) * unitCost } },
    });

    await logAudit({
      actor: user.name || "Storekeeper",
      action: "MATERIAL_ISSUED",
      entityType: "MATERIAL_ISSUE_SLIP",
      entityId: slip.id,
      details: `${slip.issueNumber} · ${rm.name} × ${qty} ${rm.unit} → ${wo.woNumber}${batchNo ? ` · batch ${batchNo}` : ""} · ₹${(Number(qty) * unitCost).toFixed(0)}`,
    });

    return NextResponse.json({ success: true, slip }, { status: 201 });
  } catch (error) {
    console.error("POST /api/material-issue error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
