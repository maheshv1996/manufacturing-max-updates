import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export interface EstimateLineInput {
  productId: string;
  plannedQty: number;
  unitPrice?: number;
}

export interface EstimateResultLine {
  productId: string;
  productName: string;
  sku: string;
  plannedQty: number;
  unitMatCost: number;
  unitLabCost: number;
  unitMacCost: number;
  unitEstCost: number;
  lineEstCost: number;
  unitPrice: number;
  subtotal: number;
  marginPct: number;
}

export interface QuotationEstimateResult {
  estimatedCost: number;
  quotedPrice: number;
  profit: number;
  marginPct: number;
  isLoss: boolean;
  lines: EstimateResultLine[];
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const round1 = (n: number) => Math.round((Number(n) || 0) * 10) / 10;

/**
 * Standardized Commercial Quotation & Cost Estimation Engine.
 * Computes direct material cost from BOM lines / defaults, labor & machine hour allocation from routing cycle times,
 * and project gross margin / markup calculations.
 */
export async function calculateQuotationEstimate(
  linesInput: EstimateLineInput[],
  globalQuotedPrice?: number,
): Promise<QuotationEstimateResult> {
  const settings = await getSettings();
  const laborRatePerHour = Math.max(0, Number(settings.laborRatePerHour) || 150);
  const machineRatePerHour = Math.max(0, Number(settings.machineRatePerHour) || 300);
  const defaultMarkupMultiplier = Math.max(1.0, Number((settings as any).defaultGrossMarginMultiplier) || 1.30);
  const fallbackCycleSec = Math.max(1, Number((settings as any).defaultCycleTimeSeconds) || 60);

  const productIds = linesInput
    .map((l) => String(l.productId || "").trim())
    .filter(Boolean);

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      bomLines: {
        include: { rawMaterial: true },
      },
    },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));

  let totalEstimatedCost = 0;
  let calculatedQuotedPrice = 0;

  const processedLines: EstimateResultLine[] = linesInput.map((item) => {
    const plannedQty = Math.max(0, Number(item.plannedQty) || 0);
    const prod = productMap.get(item.productId);

    if (!prod) {
      const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
      const subtotal = round2(unitPrice * plannedQty);
      calculatedQuotedPrice += subtotal;

      return {
        productId: item.productId,
        productName: "Unlisted Product / Custom Item",
        sku: "CUSTOM-SKU",
        plannedQty,
        unitMatCost: 0,
        unitLabCost: 0,
        unitMacCost: 0,
        unitEstCost: 0,
        lineEstCost: 0,
        unitPrice,
        subtotal,
        marginPct: unitPrice > 0 ? 100.0 : 0,
      };
    }

    // 1. Direct Material cost per unit
    let unitMatCost = 0;
    if (prod.bomLines && prod.bomLines.length > 0) {
      unitMatCost = prod.bomLines.reduce((sum, b) => {
        const cost = Number(b.rawMaterial?.unitCost) || 0;
        return sum + (Number(b.qtyPerUnit) || 0) * cost;
      }, 0);
    }

    // Fallback to static material cost if BOM pricing is zero/unset
    if (unitMatCost === 0 && prod.materialCostPerUnit) {
      unitMatCost = Number(prod.materialCostPerUnit) || 0;
    }

    // 2. Labor & Machine cost per unit
    const cycleSec =
      prod.targetCycleTimeSeconds && prod.targetCycleTimeSeconds > 0
        ? Number(prod.targetCycleTimeSeconds)
        : fallbackCycleSec;

    const hoursPerUnit = cycleSec / 3600;
    const unitLabCost = hoursPerUnit * laborRatePerHour;
    const unitMacCost = hoursPerUnit * machineRatePerHour;

    const unitEstCost = round2(unitMatCost + unitLabCost + unitMacCost);
    const lineEstCost = round2(unitEstCost * plannedQty);

    // Standard configurable gross margin default multiplier if neither line nor catalog price is specified
    const defaultPrice =
      item.unitPrice !== undefined
        ? Number(item.unitPrice)
        : prod.sellingPricePerUnit !== null && prod.sellingPricePerUnit !== undefined
        ? Number(prod.sellingPricePerUnit)
        : round2(unitEstCost * defaultMarkupMultiplier);

    const subtotal = round2(defaultPrice * plannedQty);
    const lineProfit = subtotal - lineEstCost;
    const lineMargin = subtotal > 0 ? (lineProfit / subtotal) * 100 : 0;

    totalEstimatedCost += lineEstCost;
    calculatedQuotedPrice += subtotal;

    return {
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      plannedQty,
      unitMatCost: round2(unitMatCost),
      unitLabCost: round2(unitLabCost),
      unitMacCost: round2(unitMacCost),
      unitEstCost,
      lineEstCost,
      unitPrice: round2(defaultPrice),
      subtotal,
      marginPct: round1(lineMargin),
    };
  });

  const finalQuotedPrice =
    globalQuotedPrice !== undefined && globalQuotedPrice > 0
      ? round2(globalQuotedPrice)
      : round2(calculatedQuotedPrice);

  const totalProfit = round2(finalQuotedPrice - totalEstimatedCost);
  const overallMarginPct =
    finalQuotedPrice > 0 ? (totalProfit / finalQuotedPrice) * 100 : 0;

  return {
    estimatedCost: round2(totalEstimatedCost),
    quotedPrice: finalQuotedPrice,
    profit: totalProfit,
    marginPct: round1(overallMarginPct),
    isLoss: totalProfit < 0 || overallMarginPct < 0,
    lines: processedLines,
  };
}
