/**
 * MRP (Material Requirements Planning) & Multi-Level BOM Explosion Engine
 * Derived from ERPNext discrete manufacturing MRP logic and ISO 9001 inventory planning.
 */

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
  minOrderQty: number;
  batchMultiple: number;
  unitCost: number;
  isManufactured: boolean;
  children?: BomNode[];
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
  releaseDate: Date;
  requiredDate: Date;
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

/**
 * Explode Multi-Level BOM and compute Gross Requirements recursively
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
  const scrapFactor = 1 + (node.scrapPercentage || 0) / 100;
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
 * Execute Net Requirements Calculation (MRP Run)
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
      // Lot sizing: apply minimum order quantity & batch multiples
      let orderQty = Math.max(node.minOrderQty || 0, netRequirement);
      if (node.batchMultiple && node.batchMultiple > 1) {
        orderQty =
          Math.ceil(orderQty / node.batchMultiple) * node.batchMultiple;
      }

      // Backward scheduling: Release Date = Required Date - Lead Time
      const releaseDate = new Date(minDate);
      releaseDate.setDate(releaseDate.getDate() - (node.leadTimeDays || 1));

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
        releaseDate,
        requiredDate: minDate,
        estimatedCost,
        reason: `Net requirement of ${Math.round(netRequirement)} for demands: ${demandRefs.join(", ")}`,
        parentDemandRef: demandRefs[0] || "MRP-AUTO",
      });

      // Check if stockout is critical
      const daysUntilRequired = Math.ceil(
        (minDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysUntilRequired <= node.leadTimeDays) {
        criticalShortages.push({
          itemCode,
          shortageQty: netRequirement,
          daysUntilStockout: Math.max(0, daysUntilRequired),
          severity:
            daysUntilRequired < node.leadTimeDays / 2 ? "HIGH" : "MEDIUM",
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
