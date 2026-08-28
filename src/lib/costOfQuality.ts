import { prisma } from "@/lib/prisma";

export interface CoqBreakdown {
  scrapCost: number;
  reworkCost: number;
  calibrationCost: number;
  warrantyCost: number;
  totalCost: number;
  scrapUnits: number;
  reworkUnits: number;
  calibrationCount: number;
  warrantyClaims: number;
}

function unitCost(
  p:
    | {
        materialCostPerUnit?: number | null;
        sellingPricePerUnit?: number | null;
      }
    | null
    | undefined,
): number {
  return p?.materialCostPerUnit || p?.sellingPricePerUnit || 0;
}

/**
 * P11 — Cost of Quality for a period (YYYY-MM). Every figure is computed from
 * live app records — nothing hand-entered:
 *  - Scrap / rework: ProductionLog scrap+rework qty × product unit cost
 *  - Calibration: CalibratedTool.costRupees for calibrations performed that month
 *  - Warranty: CustomerComplaint returnedQty × product unit cost (raised that month)
 */
export async function computeCoQ(period: string): Promise<CoqBreakdown> {
  const [year, month] = period.split("-").map(Number);
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);

  const [logs, calibrations, complaints] = await Promise.all([
    prisma.productionLog.findMany({
      where: { startTime: { gte: from, lt: to } },
      select: {
        scrapQuantity: true,
        reworkQuantity: true,
        workOrder: {
          select: {
            product: {
              select: { materialCostPerUnit: true, sellingPricePerUnit: true },
            },
          },
        },
      },
    }),
    prisma.calibratedTool.findMany({
      where: { calibratedAt: { gte: from, lt: to } },
      select: { costRupees: true },
    }),
    prisma.customerComplaint.findMany({
      where: { raisedAt: { gte: from, lt: to } },
      select: {
        returnedQty: true,
        workOrder: {
          select: {
            product: {
              select: { materialCostPerUnit: true, sellingPricePerUnit: true },
            },
          },
        },
      },
    }),
  ]);

  let scrapCost = 0;
  let reworkCost = 0;
  let scrapUnits = 0;
  let reworkUnits = 0;
  for (const l of logs) {
    const cost = unitCost(l.workOrder?.product);
    scrapUnits += l.scrapQuantity || 0;
    reworkUnits += l.reworkQuantity || 0;
    scrapCost += (l.scrapQuantity || 0) * cost;
    reworkCost += (l.reworkQuantity || 0) * cost;
  }

  const calibrationCost = calibrations.reduce(
    (s, c) => s + (c.costRupees || 0),
    0,
  );

  let warrantyCost = 0;
  for (const c of complaints) {
    warrantyCost += (c.returnedQty || 0) * unitCost(c.workOrder?.product);
  }

  return {
    scrapCost,
    reworkCost,
    calibrationCost,
    warrantyCost,
    totalCost: scrapCost + reworkCost + calibrationCost + warrantyCost,
    scrapUnits,
    reworkUnits,
    calibrationCount: calibrations.length,
    warrantyClaims: complaints.length,
  };
}

export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
