import { prisma } from "./prisma";
import { getAverageEnergyCostPerMachineHour } from "./energyEngine";

export interface WorkOrderCostBreakdown {
  woId: string;
  woNumber: string;
  customerName: string;
  productName: string;
  goodQuantity: number;
  scrapQuantity: number;
  reworkQuantity: number;
  quotedPrice: number | null;
  materialCostPerUnit: number;
  sellingPricePerUnit: number;

  // Cost breakdown
  materialCost: number;
  laborHours: number;
  laborCost: number;
  laborRatePerHour: number;
  machineRunHours: number;
  machineCost: number;
  machineRatePerHour: number;
  scrapLoss: number;
  energyCost: number;
  toolingCost: number; // M3 — tool-room issues post here

  // Totals
  totalCost: number;
  revenue: number;
  profit: number;
  marginPercentage: number;
  isLossMaker: boolean;
}

/**
 * Calculates complete job costing & profitability breakdown for a Work Order.
 * Accepts a work order object or work order ID.
 */
export async function calculateWorkOrderCost(
  woOrId: any,
): Promise<WorkOrderCostBreakdown> {
  let wo: any = woOrId;

  if (typeof woOrId === "string") {
    wo = await prisma.workOrder.findUnique({
      where: { id: woOrId },
      include: {
        product: true,
        productionLogs: true,
        scrapQuarantines: true,
        inventoryTransactions: {
          include: { rawMaterial: true },
        },
      },
    });
  }

  if (!wo) {
    throw new Error("Work order not found for costing calculation");
  }

  // Fetch labor and machine rates from Settings table (defaults 150 & 300);
  // the average energy cost per machine hour is independent — hoisted to run
  // in parallel instead of a second round-trip later.
  const [settings, avgEnergyCostPerHr] = await Promise.all([
    prisma.setting.findMany({
      where: {
        key: { in: ["laborRatePerHour", "machineRatePerHour"] },
      },
    }),
    getAverageEnergyCostPerMachineHour(),
  ]);

  const laborRateSetting = settings.find(
    (s) => s.key === "laborRatePerHour",
  )?.value;
  const machineRateSetting = settings.find(
    (s) => s.key === "machineRatePerHour",
  )?.value;

  const laborRatePerHour = laborRateSetting
    ? parseFloat(laborRateSetting)
    : 150.0;
  const machineRatePerHour = machineRateSetting
    ? parseFloat(machineRateSetting)
    : 300.0;

  const product = wo.product || {};
  const materialCostPerUnit = product.materialCostPerUnit ?? 0.0;
  const sellingPricePerUnit = product.sellingPricePerUnit ?? 0.0;
  const targetCycleTimeSeconds = product.targetCycleTimeSeconds || 60.0;

  let productionLogs = wo.productionLogs;
  let inventoryTransactions = wo.inventoryTransactions;

  let goodQuantity = 0;
  let scrapQuantity = 0;
  let reworkQuantity = 0;

  if (productionLogs) {
    goodQuantity = productionLogs.reduce(
      (sum: number, log: any) => sum + (log.goodQuantity || 0),
      0,
    );
    scrapQuantity = productionLogs.reduce(
      (sum: number, log: any) => sum + (log.scrapQuantity || 0),
      0,
    );
    reworkQuantity = productionLogs.reduce(
      (sum: number, log: any) => sum + (log.reworkQuantity || 0),
      0,
    );
  } else {
    const agg = await prisma.productionLog.aggregate({
      _sum: { goodQuantity: true, scrapQuantity: true, reworkQuantity: true },
      where: { workOrderId: wo.id },
    });
    goodQuantity = agg._sum.goodQuantity || 0;
    scrapQuantity = agg._sum.scrapQuantity || 0;
    reworkQuantity = agg._sum.reworkQuantity || 0;
  }

  // If no goodQuantity in production logs yet, fallback to planned quantity for estimation
  const effectiveGoodQty =
    goodQuantity > 0
      ? goodQuantity
      : wo.status === "COMPLETED"
        ? wo.plannedQuantity
        : Math.max(1, Math.round(wo.plannedQuantity * (wo.currentSeq / 4)));

  // 1. Material Cost: Sum from linked OUT inventory transactions if available, otherwise goodQty * materialCostPerUnit
  let materialCost = 0;

  if (inventoryTransactions) {
    const outTransactions = inventoryTransactions.filter(
      (tx: any) => tx.type === "OUT",
    );
    if (outTransactions.length > 0) {
      materialCost = outTransactions.reduce(
        (sum: number, tx: any) =>
          sum +
          (tx.qty || 0) *
            (tx.unitCost ?? tx.rawMaterial?.unitCost ?? materialCostPerUnit),
        0,
      );
    } else {
      materialCost = effectiveGoodQty * materialCostPerUnit;
    }
  } else {
    const outTx = await prisma.inventoryTransaction.findMany({
      where: { workOrderId: wo.id, type: "OUT" },
      include: { rawMaterial: true },
    });
    if (outTx.length > 0) {
      materialCost = outTx.reduce(
        (sum: number, tx: any) =>
          sum +
          (tx.qty || 0) *
            (tx.unitCost ?? tx.rawMaterial?.unitCost ?? materialCostPerUnit),
        0,
      );
    } else {
      materialCost = effectiveGoodQty * materialCostPerUnit;
    }
  }

  materialCost = Number(materialCost.toFixed(2));

  // 2. Labor & Machine Hours calculation from Production Logs
  let totalLogHours = 0;
  let energyCost = 0;

  if (productionLogs) {
    for (const log of productionLogs) {
      let hrs = 0;
      if (log.startTime && log.endTime) {
        const start = new Date(log.startTime).getTime();
        const end = new Date(log.endTime).getTime();
        hrs = Math.max(0.1, (end - start) / (1000 * 60 * 60));
      } else if (log.startTime) {
        const start = new Date(log.startTime).getTime();
        const now = Date.now();
        hrs = Math.max(0.1, (now - start) / (1000 * 60 * 60));
        hrs = Math.min(hrs, 24);
      } else {
        const totalPieces = (log.goodQuantity || 0) + (log.scrapQuantity || 0);
        hrs = (totalPieces * targetCycleTimeSeconds) / 3600;
      }
      totalLogHours += hrs;
    }
  } else {
    // Fetch logs to calculate hours
    const logs = await prisma.productionLog.findMany({
      where: { workOrderId: wo.id },
      select: {
        startTime: true,
        endTime: true,
        goodQuantity: true,
        scrapQuantity: true,
      },
    });
    for (const log of logs) {
      let hrs = 0;
      if (log.startTime && log.endTime) {
        const start = new Date(log.startTime).getTime();
        const end = new Date(log.endTime).getTime();
        hrs = Math.max(0.1, (end - start) / (1000 * 60 * 60));
      } else if (log.startTime) {
        const start = new Date(log.startTime).getTime();
        const now = Date.now();
        hrs = Math.max(0.1, (now - start) / (1000 * 60 * 60));
        hrs = Math.min(hrs, 24);
      } else {
        const totalPieces = (log.goodQuantity || 0) + (log.scrapQuantity || 0);
        hrs = (totalPieces * targetCycleTimeSeconds) / 3600;
      }
      totalLogHours += hrs;
    }
  }

  energyCost = totalLogHours * avgEnergyCostPerHr;

  // If logs are missing/empty (e.g. planned WO), estimate standard run hours
  if (totalLogHours === 0) {
    totalLogHours = (effectiveGoodQty * targetCycleTimeSeconds) / 3600;
  }

  const laborHours = Number(Math.max(0.25, totalLogHours).toFixed(2));
  const machineRunHours = Number(Math.max(0.25, totalLogHours).toFixed(2));

  // 2. Labor Cost = laborHours * laborRatePerHour
  const laborCost = Number((laborHours * laborRatePerHour).toFixed(2));

  // 3. Machine Cost = machineRunHours * machineRatePerHour
  const machineCost = Number((machineRunHours * machineRatePerHour).toFixed(2));

  // 4. Scrap Loss = scrapQty * scrapCostPerUnit + (reworkQty * 0.5 * scrapCostPerUnit)
  const scrapLoss = Number(
    (
      scrapQuantity * materialCostPerUnit +
      reworkQuantity * 0.5 * materialCostPerUnit
    ).toFixed(2),
  );

  // Energy cost if no logs
  if (totalLogHours === 0 || energyCost === 0) {
    energyCost = machineRunHours * avgEnergyCostPerHr;
  }
  energyCost = Number(energyCost.toFixed(2));

  const toolingCost = Number(wo.toolingCostRupees || 0).toFixed(2);

  // 5. Total Cost = sum of all cost components
  const totalCost = Number(
    (
      materialCost +
      laborCost +
      machineCost +
      scrapLoss +
      energyCost +
      Number(toolingCost)
    ).toFixed(2),
  );

  // 6. Revenue = quotedPrice ?? goodQty * sellingPricePerUnit
  const revenue = Number(
    (wo.quotedPrice && wo.quotedPrice > 0
      ? wo.quotedPrice
      : effectiveGoodQty * sellingPricePerUnit
    ).toFixed(2),
  );

  // 7. Profit & Margin %
  const profit = Number((revenue - totalCost).toFixed(2));
  const marginPercentage =
    revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0;

  return {
    woId: wo.id,
    woNumber: wo.woNumber,
    customerName: wo.customerName || "General Client",
    productName: product.name || "Product",
    goodQuantity: effectiveGoodQty,
    scrapQuantity,
    reworkQuantity,
    quotedPrice: wo.quotedPrice || null,
    materialCostPerUnit,
    sellingPricePerUnit,
    materialCost,
    laborHours,
    laborCost,
    laborRatePerHour,
    machineRunHours,
    machineCost,
    machineRatePerHour,
    scrapLoss,
    energyCost,
    toolingCost: Number(toolingCost),
    totalCost,
    revenue,
    profit,
    marginPercentage,
    isLossMaker: profit < 0,
  };
}
