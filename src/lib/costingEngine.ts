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

// Helpers for clean numerical rounding and safe non-negative conversions
const round2 = (val: number): number => {
  if (!Number.isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
};

const round1 = (val: number): number => {
  if (!Number.isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 10) / 10;
};

const safeNonNegative = (val: any, fallback = 0): number => {
  const num = Number(val);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

// Pure function to extract aggregated quantities from production logs
function extractQuantitiesFromLogs(logs: any[]) {
  let goodQuantity = 0;
  let scrapQuantity = 0;
  let reworkQuantity = 0;

  for (const log of logs) {
    goodQuantity += safeNonNegative(log.goodQuantity);
    scrapQuantity += safeNonNegative(log.scrapQuantity);
    reworkQuantity += safeNonNegative(log.reworkQuantity);
  }

  return { goodQuantity, scrapQuantity, reworkQuantity };
}

// Pure function to calculate actual or standard run hours from logs
function calculateHoursFromLogs(logs: any[], targetCycleTimeSeconds: number): number {
  let totalHours = 0;

  for (const log of logs) {
    let hrs = 0;
    if (log.startTime && log.endTime) {
      const start = new Date(log.startTime).getTime();
      const end = new Date(log.endTime).getTime();
      hrs = Math.max(0.1, (end - start) / (1000 * 60 * 60));
    } else if (log.startTime) {
      const start = new Date(log.startTime).getTime();
      hrs = Math.max(0.1, (Date.now() - start) / (1000 * 60 * 60));
      hrs = Math.min(hrs, 24); // Cap max open shift to 24h
    } else {
      const totalPieces = safeNonNegative(log.goodQuantity) + safeNonNegative(log.scrapQuantity);
      hrs = (totalPieces * targetCycleTimeSeconds) / 3600;
    }
    totalHours += hrs;
  }

  return totalHours;
}

/**
 * Calculates complete job costing & profitability breakdown for a Work Order.
 * Accepts a work order object or work order ID.
 */
export interface CostingContext {
  laborRatePerHour?: number;
  machineRatePerHour?: number;
  avgEnergyCostPerHr?: number;
}

/**
 * Pre-fetches costing configuration (labor rate, machine rate, energy rate)
 * once in parallel so batch operations avoid repeated DB roundtrips.
 */
export async function getCostingContext(): Promise<Required<CostingContext>> {
  const [settings, avgEnergyCostPerHrRaw] = await Promise.all([
    prisma.setting.findMany({
      where: {
        key: { in: ["laborRatePerHour", "machineRatePerHour"] },
      },
    }),
    getAverageEnergyCostPerMachineHour(),
  ]);

  const laborRateSetting = settings.find((s) => s.key === "laborRatePerHour")?.value;
  const machineRateSetting = settings.find((s) => s.key === "machineRatePerHour")?.value;

  return {
    laborRatePerHour: safeNonNegative(laborRateSetting ? parseFloat(laborRateSetting) : 150.0, 150.0),
    machineRatePerHour: safeNonNegative(machineRateSetting ? parseFloat(machineRateSetting) : 300.0, 300.0),
    avgEnergyCostPerHr: safeNonNegative(avgEnergyCostPerHrRaw, 45.0),
  };
}

/**
 * Calculates complete job costing & profitability breakdown for a Work Order.
 * Accepts a work order object or work order ID, and optional hoisted CostingContext.
 */
export async function calculateWorkOrderCost(
  woOrId: any,
  context?: CostingContext,
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

  // 1. Use hoisted rates/energy context or fetch in parallel
  let laborRatePerHour = context?.laborRatePerHour;
  let machineRatePerHour = context?.machineRatePerHour;
  let avgEnergyCostPerHr = context?.avgEnergyCostPerHr;

  if (laborRatePerHour === undefined || machineRatePerHour === undefined || avgEnergyCostPerHr === undefined) {
    const ctx = await getCostingContext();
    laborRatePerHour = laborRatePerHour ?? ctx.laborRatePerHour;
    machineRatePerHour = machineRatePerHour ?? ctx.machineRatePerHour;
    avgEnergyCostPerHr = avgEnergyCostPerHr ?? ctx.avgEnergyCostPerHr;
  }

  // 2. Product baseline validation
  const product = wo.product || {};
  const materialCostPerUnit = safeNonNegative(product.materialCostPerUnit);
  const sellingPricePerUnit = safeNonNegative(product.sellingPricePerUnit);
  const targetCycleTimeSeconds = safeNonNegative(product.targetCycleTimeSeconds, 60.0);
  const plannedQuantity = safeNonNegative(wo.plannedQuantity, 1);
  const setupTimeHours = safeNonNegative(wo.setupTimeMinutes, 0) / 60.0;

  // 3. Extract production log quantities
  let goodQuantity = 0;
  let scrapQuantity = 0;
  let reworkQuantity = 0;
  const productionLogs = wo.productionLogs;

  if (Array.isArray(productionLogs)) {
    const q = extractQuantitiesFromLogs(productionLogs);
    goodQuantity = q.goodQuantity;
    scrapQuantity = q.scrapQuantity;
    reworkQuantity = q.reworkQuantity;
  } else {
    const agg = await prisma.productionLog.aggregate({
      _sum: { goodQuantity: true, scrapQuantity: true, reworkQuantity: true },
      where: { workOrderId: wo.id },
    });
    goodQuantity = safeNonNegative(agg._sum.goodQuantity);
    scrapQuantity = safeNonNegative(agg._sum.scrapQuantity);
    reworkQuantity = safeNonNegative(agg._sum.reworkQuantity);
  }

  // PR3: Don't fabricate quantity for in-progress WOs. Revenue/cost must reflect actual production logs.
  // COMPLETED with missing logs (manual close / import) falls back to plannedQuantity; otherwise actual goodQuantity (even if 0).
  let effectiveGoodQty = goodQuantity;
  if (effectiveGoodQty === 0 && wo.status === "COMPLETED") {
    effectiveGoodQty = plannedQuantity;
  }

  // 4. Material Cost Calculation
  let materialCost = 0;
  const inventoryTransactions = wo.inventoryTransactions;

  if (Array.isArray(inventoryTransactions)) {
    const outTx = inventoryTransactions.filter((tx: any) => tx.type === "OUT");
    if (outTx.length > 0) {
      materialCost = outTx.reduce(
        (sum: number, tx: any) =>
          sum + safeNonNegative(tx.qty) * safeNonNegative(tx.unitCost ?? tx.rawMaterial?.unitCost ?? materialCostPerUnit),
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
          sum + safeNonNegative(tx.qty) * safeNonNegative(tx.unitCost ?? tx.rawMaterial?.unitCost ?? materialCostPerUnit),
        0,
      );
    } else {
      materialCost = effectiveGoodQty * materialCostPerUnit;
    }
  }
  materialCost = round2(materialCost);

  // 5. Labor, Machine, & Energy Hours Calculation (Including Setup Time)
  let calculatedHours = 0;
  if (Array.isArray(productionLogs)) {
    calculatedHours = calculateHoursFromLogs(productionLogs, targetCycleTimeSeconds);
  } else {
    const fetchedLogs = await prisma.productionLog.findMany({
      where: { workOrderId: wo.id },
      select: { startTime: true, endTime: true, goodQuantity: true, scrapQuantity: true },
    });
    calculatedHours = calculateHoursFromLogs(fetchedLogs, targetCycleTimeSeconds);
  }

  // Fallback to standard planned cycle time if no logs exist
  if (calculatedHours === 0) {
    calculatedHours = (effectiveGoodQty * targetCycleTimeSeconds) / 3600.0;
  }

  // Total operating hours = run hours + setup fixture time (min 0.25h)
  const totalOperatingHours = Math.max(0.25, calculatedHours + setupTimeHours);
  const laborHours = round2(totalOperatingHours);
  const machineRunHours = round2(totalOperatingHours);

  // 6. Direct Costs
  const laborCost = round2(laborHours * laborRatePerHour);
  const machineCost = round2(machineRunHours * machineRatePerHour);
  const scrapLoss = round2(scrapQuantity * materialCostPerUnit + reworkQuantity * 0.5 * materialCostPerUnit);
  const energyCost = round2(machineRunHours * avgEnergyCostPerHr);
  const toolingCost = round2(safeNonNegative(wo.toolingCostRupees));

  // 7. Total Cost & Revenue
  const totalCost = round2(materialCost + laborCost + machineCost + scrapLoss + energyCost + toolingCost);

  const quotedPrice = safeNonNegative(wo.quotedPrice);
  const revenue = round2(quotedPrice > 0 ? quotedPrice : effectiveGoodQty * sellingPricePerUnit);

  // 8. Profit & Margin %
  const profit = round2(revenue - totalCost);
  const marginPercentage = revenue > 0 ? round1((profit / revenue) * 100) : 0;

  return {
    woId: wo.id,
    woNumber: wo.woNumber || "WO-N/A",
    customerName: wo.customerName || "General Client",
    productName: product.name || "Product",
    goodQuantity: effectiveGoodQty,
    scrapQuantity,
    reworkQuantity,
    quotedPrice: quotedPrice > 0 ? quotedPrice : null,
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
    toolingCost,
    totalCost,
    revenue,
    profit,
    marginPercentage,
    isLossMaker: profit < 0,
  };
}
