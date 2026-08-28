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

export async function calculateQuotationEstimate(
  linesInput: EstimateLineInput[],
  globalQuotedPrice?: number,
): Promise<QuotationEstimateResult> {
  const settings = await getSettings();
  const laborRatePerHour = settings.laborRatePerHour || 150;
  const machineRatePerHour = settings.machineRatePerHour || 300;

  const productIds = linesInput.map((l) => l.productId).filter(Boolean);
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
    const prod = productMap.get(item.productId);
    if (!prod) {
      return {
        productId: item.productId,
        productName: "Unknown",
        sku: "N/A",
        plannedQty: item.plannedQty,
        unitMatCost: 0,
        unitLabCost: 0,
        unitMacCost: 0,
        unitEstCost: 0,
        lineEstCost: 0,
        unitPrice: item.unitPrice || 0,
        subtotal: (item.unitPrice || 0) * item.plannedQty,
        marginPct: 0,
      };
    }

    // Material cost per unit
    let unitMatCost = 0;
    if (prod.bomLines && prod.bomLines.length > 0) {
      unitMatCost = prod.bomLines.reduce((sum, b) => {
        const cost = b.rawMaterial?.unitCost || 0;
        return sum + b.qtyPerUnit * cost;
      }, 0);
    } else {
      unitMatCost = prod.materialCostPerUnit || 0;
    }

    // Labor & Machine cost per unit
    const cycleSec =
      prod.targetCycleTimeSeconds > 0 ? prod.targetCycleTimeSeconds : 60;
    const hoursPerUnit = cycleSec / 3600;
    const unitLabCost = hoursPerUnit * laborRatePerHour;
    const unitMacCost = hoursPerUnit * machineRatePerHour;

    const unitEstCost = unitMatCost + unitLabCost + unitMacCost;
    const lineEstCost = unitEstCost * item.plannedQty;

    const defaultPrice =
      item.unitPrice ?? prod.sellingPricePerUnit ?? unitEstCost * 1.3;
    const subtotal = defaultPrice * item.plannedQty;

    const lineProfit = subtotal - lineEstCost;
    const lineMargin = subtotal > 0 ? (lineProfit / subtotal) * 100 : 0;

    totalEstimatedCost += lineEstCost;
    calculatedQuotedPrice += subtotal;

    return {
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      plannedQty: item.plannedQty,
      unitMatCost,
      unitLabCost,
      unitMacCost,
      unitEstCost,
      lineEstCost,
      unitPrice: defaultPrice,
      subtotal,
      marginPct: Number(lineMargin.toFixed(1)),
    };
  });

  const finalQuotedPrice =
    globalQuotedPrice !== undefined && globalQuotedPrice > 0
      ? globalQuotedPrice
      : calculatedQuotedPrice;

  const totalProfit = finalQuotedPrice - totalEstimatedCost;
  const overallMarginPct =
    finalQuotedPrice > 0 ? (totalProfit / finalQuotedPrice) * 100 : 0;

  return {
    estimatedCost: Number(totalEstimatedCost.toFixed(2)),
    quotedPrice: Number(finalQuotedPrice.toFixed(2)),
    profit: Number(totalProfit.toFixed(2)),
    marginPct: Number(overallMarginPct.toFixed(1)),
    isLoss: totalProfit < 0 || overallMarginPct < 0,
    lines: processedLines,
  };
}
