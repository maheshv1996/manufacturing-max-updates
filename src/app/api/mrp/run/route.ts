import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateMrp, DemandRequirement, BomNode } from "@/lib/mrpEngine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Fetch all planned or in-progress work orders (Gross Demands)
    const workOrders = await prisma.workOrder.findMany({
      where: {
        status: { in: ["PLANNED", "IN_PROGRESS"] },
      },
      include: {
        product: {
          include: {
            bomLines: {
              include: { rawMaterial: true },
            },
          },
        },
      },
      orderBy: { plannedStartDate: "asc" },
    });

    // 2. Build BOM Tree Map for MRP Engine
    const bomTreeMap = new Map<string, BomNode>();

    for (const wo of workOrders) {
      const p = wo.product;
      if (!bomTreeMap.has(p.sku)) {
        bomTreeMap.set(p.sku, {
          itemId: p.id,
          itemCode: p.sku,
          itemName: p.name,
          qtyPerParent: 1,
          scrapPercentage: 2.0,
          currentStock: 0,
          allocatedStock: 0,
          onOrderStock: 0,
          safetyStock: 5,
          leadTimeDays: 7,
          minOrderQty: 10,
          batchMultiple: 5,
          unitCost: p.sellingPricePerUnit || 1000,
          isManufactured: true,
          children: p.bomLines.map((b) => ({
            itemId: b.rawMaterial.id,
            itemCode: b.rawMaterial.sku,
            itemName: b.rawMaterial.name,
            qtyPerParent: b.qtyPerUnit,
            scrapPercentage: 3.0,
            currentStock: b.rawMaterial.currentStock || 0,
            allocatedStock: 0,
            onOrderStock: 0,
            safetyStock: b.rawMaterial.minStock || 10,
            leadTimeDays: 14,
            minOrderQty: 20,
            batchMultiple: 10,
            unitCost: b.rawMaterial.unitCost || 150,
            isManufactured: false,
          })),
        });
      }
    }

    // 3. Build Demand Requirements from Work Orders
    const demands: DemandRequirement[] = workOrders.map((wo) => ({
      demandId: wo.id,
      itemCode: wo.product.sku,
      requiredQty: Math.max(1, wo.plannedQuantity - (wo.packedQuantity || 0)),
      requiredDate: new Date(wo.plannedStartDate),
      sourceType: "WORK_ORDER",
      sourceReference: `WO #${wo.woNumber} (${wo.product.name})`,
    }));

    // 4. Execute MRP
    const mrpResult = calculateMrp(demands, bomTreeMap);

    return NextResponse.json({
      success: true,
      workOrdersCount: workOrders.length,
      demands,
      mrpResult,
    });
  } catch (error: any) {
    console.error("MRP execution error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute MRP run" },
      { status: 500 },
    );
  }
}
