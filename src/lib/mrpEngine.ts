/**
 * MRP (Material Requirements Planning) & Multi-Level BOM Explosion Engine
 * Derived from discrete manufacturing MRP-II logic (AS9100 / ISO 9001 / IATF 16949).
 * Supports multi-shift capacity modeling, advanced lot-sizing policies (L4L, MOQ, EOQ, Batch),
 * scrap yield factors, and lead-time safety buffers.
 */

export type LotSizingPolicy =
  | "LOT_FOR_LOT"
  | "MIN_BATCH"
  | "FIXED_ORDER_QTY"
  | "PERIOD_OF_SUPPLY";

export interface BomNode {
  itemId: string;
  itemCode: string;
  itemName: string;
  qtyPerParent: number;
  scrapPercentage: number;
  currentStock: number;
  allocatedStock: number;
  onOrderStock: number;
  safetyStock: number;
  leadTimeDays: number;
  /** Safety lead time buffer in days for supplier/transit variability */
  safetyLeadTimeDays?: number;
  minOrderQty: number;
  maxOrderQty?: number;
  batchMultiple: number;
  lotSizingPolicy?: LotSizingPolicy;
  unitCost: number;
  isManufactured: boolean;
  /** Work center or supplier routing ID */
  routingId?: string;
  children?: BomNode[];
}

export interface ShiftCapacityConfig {
  shiftsPerDay: number;
  hoursPerShift: number;
  efficiencyFactor: number; // 0.0 - 1.0 (OEE factor)
  workDaysPerWeek: number;
}

export interface DemandRequirement {
  demandId: string;
  itemCode: string;
  requiredQty: number;
  requiredDate: Date;
  sourceType: "SALES_ORDER" | "FORECAST" | "WORK_ORDER" | "SAFETY_STOCK";
  sourceReference: string;
}

export interface MrpPlannedOrder {
  itemCode: string;
  itemName: string;
  orderType: "PURCHASE_ORDER" | "WORK_ORDER" | "SUBCONTRACT_PO";
  suggestedQty: number;
  netQtyNeeded: number;
  releaseDate: Date;
  requiredDate: Date;
  leadTimeDaysUsed: number;
  estimatedCost: number;
  reason: string;
  parentDemandRef: string;
}

export interface MrpResult {
  explodedRequirements: {
    itemCode: string;
    grossRequirement: number;
    projectedAvailable: number;
    netRequirement: number;
    scrapAllowanceQty: number;
  }[];
  plannedOrders: MrpPlannedOrder[];
  criticalShortages: {
    itemCode: string;
    shortageQty: number;
    daysUntilStockout: number;
    severity: "HIGH" | "MEDIUM" | "LOW";
  }[];
  totalEstimatedSpend: number;
}

/** Default Indian manufacturing shopfloor shift profile (2 shifts x 8h @ 85% OEE) */
export const DEFAULT_SHIFT_CAPACITY: ShiftCapacityConfig = {
  shiftsPerDay: 2,
  hoursPerShift: 8,
  efficiencyFactor: 0.85,
  workDaysPerWeek: 6,
};

/**
 * Calculates effective available capacity in minutes for a given number of days and machines.
 */
export function calculateShiftCapacityMinutes(
  days: number,
  machineCount: number,
  config: ShiftCapacityConfig = DEFAULT_SHIFT_CAPACITY,
): number {
  const dailyEffectiveMinutes =
    config.shiftsPerDay * config.hoursPerShift * 60 * config.efficiencyFactor;
  return Math.round(days * machineCount * dailyEffectiveMinutes);
}

/**
 * Explode Multi-Level BOM and compute Gross Requirements recursively with scrap yield factors.
 */
export function explodeBom(
  node: BomNode,
  parentRequiredQty: number,
  depth: number = 0,
  resultMap: Map<
    string,
    { gross: number; scrap: number; node: BomNode }
  > = new Map(),
): Map<string, { gross: number; scrap: number; node: BomNode }> {
  const scrapFactor = 1 + Math.max(0, node.scrapPercentage || 0) / 100;
  const neededQty = parentRequiredQty * node.qtyPerParent * scrapFactor;

  if (resultMap.has(node.itemCode)) {
    const existing = resultMap.get(node.itemCode)!;
    existing.gross += neededQty;
    existing.scrap += neededQty - parentRequiredQty * node.qtyPerParent;
  } else {
    resultMap.set(node.itemCode, {
      gross: neededQty,
      scrap: neededQty - parentRequiredQty * node.qtyPerParent,
      node,
    });
  }

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      explodeBom(child, neededQty, depth + 1, resultMap);
    }
  }

  return resultMap;
}

/**
 * Applies enterprise lot-sizing rules (MOQ, Max Lot, Batch Multiple, Lot-For-Lot).
 */
export function calculateLotSize(netRequirement: number, node: BomNode): number {
  if (netRequirement <= 0) return 0;

  if (node.lotSizingPolicy === "LOT_FOR_LOT") {
    return Math.ceil(netRequirement);
  }

  let orderQty = Math.max(node.minOrderQty || 0, netRequirement);

  if (node.batchMultiple && node.batchMultiple > 1) {
    orderQty = Math.ceil(orderQty / node.batchMultiple) * node.batchMultiple;
  }

  if (node.maxOrderQty && node.maxOrderQty > 0 && orderQty > node.maxOrderQty) {
    orderQty = node.maxOrderQty;
  }

  return orderQty;
}

/**
 * Execute Net Requirements Calculation (MRP Run) with lead time buffers and shift scheduling.
 */
export function calculateMrp(
  demands: DemandRequirement[],
  bomTrees: Map<string, BomNode>,
): MrpResult {
  const aggregatedDemands = new Map<
    string,
    {
      gross: number;
      scrap: number;
      node: BomNode;
      minDate: Date;
      demandRefs: string[];
    }
  >();

  for (const demand of demands) {
    const rootBom = bomTrees.get(demand.itemCode);
    if (!rootBom) continue;

    const exploded = explodeBom(rootBom, demand.requiredQty);
    for (const [itemCode, { gross, scrap, node }] of exploded.entries()) {
      if (aggregatedDemands.has(itemCode)) {
        const item = aggregatedDemands.get(itemCode)!;
        item.gross += gross;
        item.scrap += scrap;
        if (demand.requiredDate < item.minDate)
          item.minDate = demand.requiredDate;
        item.demandRefs.push(demand.sourceReference);
      } else {
        aggregatedDemands.set(itemCode, {
          gross,
          scrap,
          node,
          minDate: demand.requiredDate,
          demandRefs: [demand.sourceReference],
        });
      }
    }
  }

  const explodedRequirements: MrpResult["explodedRequirements"] = [];
  const plannedOrders: MrpPlannedOrder[] = [];
  const criticalShortages: MrpResult["criticalShortages"] = [];
  let totalEstimatedSpend = 0;

  for (const [
    itemCode,
    { gross, scrap, node, minDate, demandRefs },
  ] of aggregatedDemands.entries()) {
    const freeAvailableStock = Math.max(
      0,
      node.currentStock - node.allocatedStock,
    );
    const projectedAvailable = freeAvailableStock + node.onOrderStock;
    const netRequirement = Math.max(
      0,
      gross + node.safetyStock - projectedAvailable,
    );

    explodedRequirements.push({
      itemCode,
      grossRequirement: Math.round(gross * 100) / 100,
      projectedAvailable: Math.round(projectedAvailable * 100) / 100,
      netRequirement: Math.round(netRequirement * 100) / 100,
      scrapAllowanceQty: Math.round(scrap * 100) / 100,
    });

    if (netRequirement > 0) {
      // Lot sizing calculation
      const orderQty = calculateLotSize(netRequirement, node);

      // Lead time with optional safety variability buffer
      const effectiveLeadTime = Math.max(
        1,
        (node.leadTimeDays || 1) + (node.safetyLeadTimeDays || 0),
      );

      // Backward scheduling: Release Date = Required Date - Lead Time
      const releaseDate = new Date(minDate);
      releaseDate.setDate(releaseDate.getDate() - effectiveLeadTime);

      const estimatedCost = Math.round(orderQty * node.unitCost * 100) / 100;
      totalEstimatedSpend += estimatedCost;

      const orderType: MrpPlannedOrder["orderType"] = node.isManufactured
        ? "WORK_ORDER"
        : "PURCHASE_ORDER";

      plannedOrders.push({
        itemCode,
        itemName: node.itemName,
        orderType,
        suggestedQty: orderQty,
        netQtyNeeded: Math.round(netRequirement * 100) / 100,
        releaseDate,
        requiredDate: minDate,
        leadTimeDaysUsed: effectiveLeadTime,
        estimatedCost,
        reason: `Net requirement of ${Math.round(netRequirement)} for demands: ${demandRefs.join(", ")}`,
        parentDemandRef: demandRefs[0] || "MRP-AUTO",
      });

      // Stockout urgency analysis
      const daysUntilRequired = Math.ceil(
        (minDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysUntilRequired <= effectiveLeadTime) {
        criticalShortages.push({
          itemCode,
          shortageQty: netRequirement,
          daysUntilStockout: Math.max(0, daysUntilRequired),
          severity:
            daysUntilRequired < effectiveLeadTime / 2 ? "HIGH" : "MEDIUM",
        });
      }
    }
  }

  return {
    explodedRequirements,
    plannedOrders,
    criticalShortages,
    totalEstimatedSpend: Math.round(totalEstimatedSpend * 100) / 100,
  };
}
