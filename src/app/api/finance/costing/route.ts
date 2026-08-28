import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workOrders = await prisma.workOrder.findMany({
      include: {
        product: {
          include: {
            bomLines: {
              include: { rawMaterial: true },
            },
            routingSteps: true,
          },
        },
        productionLogs: true,
        materialIssueSlips: {
          include: { rawMaterial: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const costingLedger = workOrders.map((wo) => {
      const p = wo.product;
      const plannedQty = wo.plannedQuantity || 1;
      const goodQty =
        wo.productionLogs.reduce((sum, log) => sum + log.goodQuantity, 0) ||
        (wo.status === "COMPLETED" ? plannedQty : 0);

      // ── Standard BOM Estimates ──
      const stdMaterialCost =
        p.bomLines.reduce((acc, line) => {
          return (
            acc +
            line.qtyPerUnit * (line.rawMaterial.unitCost || 100) * plannedQty
          );
        }, 0) ||
        (p.materialCostPerUnit
          ? p.materialCostPerUnit * plannedQty
          : 1500 * plannedQty);

      const stdMachiningHours =
        p.routingSteps.reduce((acc, step) => {
          return acc + ((step.cycleTimeMin || 2.5) / 60) * plannedQty;
        }, 0) || plannedQty * 0.2; // 12 min per part default

      const stdMachiningCost = stdMachiningHours * 1200; // Rs. 1200 / hr machine rate
      const stdToolingCost = (p.toolingCost || 250) * (plannedQty / 100);
      const stdLaborCost = plannedQty * 150; // Rs. 150 labor overhead per unit
      const totalStandardCost =
        Math.round(
          (stdMaterialCost + stdMachiningCost + stdToolingCost + stdLaborCost) *
            100,
        ) / 100;

      // ── Actual Shopfloor Realized Costs ──
      const actualMaterialCost =
        wo.materialCostTotal > 0
          ? wo.materialCostTotal
          : wo.materialIssueSlips.reduce(
              (sum, slip) =>
                sum + slip.qty * (slip.rawMaterial.unitCost || 100),
              0,
            ) || stdMaterialCost * 1.02; // actual RM issued

      // Total machine hours logged in production
      const totalRunMinutes =
        wo.productionLogs.reduce((sum, log) => {
          const logMinutes =
            log.endTime && log.startTime
              ? (new Date(log.endTime).getTime() -
                  new Date(log.startTime).getTime()) /
                60000
              : log.goodQuantity * 2.5;
          return sum + logMinutes;
        }, 0) || goodQty * 2.6;

      const actualMachiningCost = (totalRunMinutes / 60) * 1200;
      const actualToolingCost =
        wo.toolingCostRupees > 0 ? wo.toolingCostRupees : stdToolingCost;
      const actualLaborCost = (totalRunMinutes / 60) * 350; // Rs. 350 / hr operator wage
      const totalActualCost =
        Math.round(
          (actualMaterialCost +
            actualMachiningCost +
            actualToolingCost +
            actualLaborCost) *
            100,
        ) / 100;

      // Revenue & Margin
      const unitSellingPrice =
        p.sellingPricePerUnit || (totalStandardCost / plannedQty) * 1.35;
      const totalRevenue =
        Math.round((wo.quotedPrice || unitSellingPrice * plannedQty) * 100) /
        100;
      const grossMarginRupees =
        Math.round((totalRevenue - totalActualCost) * 100) / 100;
      const grossMarginPct =
        totalRevenue > 0
          ? Math.round((grossMarginRupees / totalRevenue) * 1000) / 10
          : 0;
      const costVariance =
        Math.round((totalActualCost - totalStandardCost) * 100) / 100;

      return {
        id: wo.id,
        woNumber: wo.woNumber,
        productName: p.name,
        productSku: p.sku,
        customerName: wo.customerName || "Standard Inventory",
        status: wo.status,
        plannedQuantity: plannedQty,
        goodQuantity: goodQty,
        standardCosting: {
          materialCost: Math.round(stdMaterialCost),
          machiningCost: Math.round(stdMachiningCost),
          toolingCost: Math.round(stdToolingCost),
          laborCost: Math.round(stdLaborCost),
          totalCost: totalStandardCost,
        },
        actualCosting: {
          materialCost: Math.round(actualMaterialCost),
          machiningCost: Math.round(actualMachiningCost),
          toolingCost: Math.round(actualToolingCost),
          laborCost: Math.round(actualLaborCost),
          totalCost: totalActualCost,
        },
        economics: {
          totalRevenue,
          grossMarginRupees,
          grossMarginPct,
          costVariance,
          isFavorable: costVariance <= 0,
        },
      };
    });

    // Summary Totals
    const totalRevAll = costingLedger.reduce(
      (sum, item) => sum + item.economics.totalRevenue,
      0,
    );
    const totalCostAll = costingLedger.reduce(
      (sum, item) => sum + item.actualCosting.totalCost,
      0,
    );
    const totalGrossProfit = totalRevAll - totalCostAll;
    const avgMarginPct =
      totalRevAll > 0
        ? Math.round((totalGrossProfit / totalRevAll) * 1000) / 10
        : 0;
    const unfavorableCount = costingLedger.filter(
      (item) => !item.economics.isFavorable,
    ).length;

    return NextResponse.json({
      costingLedger,
      summary: {
        totalRevenue: totalRevAll,
        totalCost: totalCostAll,
        totalGrossProfit,
        avgMarginPct,
        unfavorableCount,
      },
    });
  } catch (error: any) {
    console.error("Failed to calculate job costing:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load job costing ledger" },
      { status: 500 },
    );
  }
}
