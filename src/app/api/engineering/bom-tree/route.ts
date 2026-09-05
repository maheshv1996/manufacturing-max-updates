import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [products, rawMaterials, machines] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        include: {
          bomLines: {
            include: {
              rawMaterial: true,
            },
          },
          routingSteps: {
            include: {
              machine: true,
              operation: true,
            },
            orderBy: { seq: "asc" },
          },
          fixtures: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.rawMaterial.findMany({
        orderBy: { name: "asc" },
      }),
      prisma.machine.findMany({
        orderBy: { name: "asc" },
      }),
    ]);

    // Build rich multi-level trees and compute rollups
    const trees = products.map((prod) => {
      // 1. Material rollup
      const materialCost = prod.bomLines.reduce((acc, line) => {
        const unitCost = line.rawMaterial.unitCost || 100;
        return acc + line.qtyPerUnit * unitCost;
      }, 0);

      // 2. Machining / Operation rollup (assuming standard machine hourly rate = Rs. 1200/hr)
      const machiningCost = prod.routingSteps.reduce((acc, step) => {
        const totalMinutes =
          (step.setupTimeMin || 15) / 100 + (step.cycleTimeMin || 2.5); // setup amortized over 100pcs
        const ratePerHour = 1200; // Rs. / hour
        return acc + (totalMinutes / 60) * ratePerHour;
      }, 0);

      const toolingCost = prod.toolingCost || 250;
      const totalStandardCost =
        Math.round((materialCost + machiningCost + toolingCost) * 100) / 100;
      const suggestedSellingPrice =
        prod.sellingPricePerUnit || Math.round(totalStandardCost * 1.35); // 35% standard margin

      return {
        id: prod.id,
        sku: prod.sku,
        name: prod.name,
        description: prod.description,
        unit: prod.unit || "pcs",
        materialCost,
        machiningCost,
        toolingCost,
        totalStandardCost,
        suggestedSellingPrice,
        bomLines: prod.bomLines.map((b) => ({
          id: b.id,
          rawMaterialId: b.rawMaterialId,
          code: b.rawMaterial.sku,
          name: b.rawMaterial.name,
          category: b.rawMaterial.materialClass || "RAW_MATERIAL",
          unit: b.rawMaterial.unit || "kg",
          qtyPerUnit: b.qtyPerUnit,
          costPerUnit: b.rawMaterial.unitCost || 100,
          totalLineCost:
            Math.round(b.qtyPerUnit * (b.rawMaterial.unitCost || 100) * 100) /
            100,
          currentStock: b.rawMaterial.currentStock || 0,
          minStock: b.rawMaterial.minStock || 10,
        })),
        routingSteps: prod.routingSteps.map((s) => ({
          id: s.id,
          seq: s.seq,
          stationName: s.stationName,
          operationName: s.operation?.name || s.stationName,
          machineCode: s.machine?.code || "CNC-01",
          machineName: s.machine?.name || "CNC Center",
          setupTimeMin: s.setupTimeMin,
          cycleTimeMin: s.cycleTimeMin,
          isHoldPoint: s.isHoldPoint,
        })),
      };
    });

    return NextResponse.json({
      products: trees,
      rawMaterials,
      machines,
    });
  } catch (error: any) {
    console.error("Failed to load BOM tree data:", error);
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
    if (!user.isOwner && !canAny(user, ["engineering.edit", "ops.edit", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const productId = typeof body.productId === "string" ? body.productId : "";
    const rawMaterialId = typeof body.rawMaterialId === "string" ? body.rawMaterialId : "";
    const qtyPerUnitNum = typeof body.qtyPerUnit === "number" ? body.qtyPerUnit : parseFloat(String(body.qtyPerUnit));

    if (!productId || !rawMaterialId || isNaN(qtyPerUnitNum) || qtyPerUnitNum <= 0) {
      return NextResponse.json(
        { error: "Valid Product ID, Raw Material ID, and positive Qty Per Unit are required" },
        { status: 400 },
      );
    }

    const actor = user.name || user.id || "Engineer";

    const bomLine = await prisma.$transaction(async (tx) => {
      const line = await tx.bomLine.upsert({
        where: {
          productId_rawMaterialId: {
            productId,
            rawMaterialId,
          },
        },
        update: {
          qtyPerUnit: qtyPerUnitNum,
        },
        create: {
          productId,
          rawMaterialId,
          qtyPerUnit: qtyPerUnitNum,
        },
        include: {
          product: true,
          rawMaterial: true,
        },
      });

      await logAuditTx(tx, {
        actor,
        action: "BOM_LINE_SAVED",
        entityType: "Product",
        entityId: productId,
        details: `Added/Updated BOM item: ${line.rawMaterial.name} (${qtyPerUnitNum} ${line.rawMaterial.unit}) to ${line.product.name}`,
      });

      return line;
    });

    return NextResponse.json({ success: true, bomLine });
  } catch (error: unknown) {
    console.error("Failed to save BOM line:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
