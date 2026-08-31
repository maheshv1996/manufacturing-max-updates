import { prisma } from "./prisma";

// Quality-objective KPI types with display metadata.
export const OBJECTIVE_KPI_TYPES = [
  {
    value: "OTD_PCT",
    label: "On-Time Delivery %",
    unit: "%",
    higherIsBetter: true,
  },
  {
    value: "PPM",
    label: "Defects per Million (PPM)",
    unit: "ppm",
    higherIsBetter: false,
  },
  {
    value: "MTBF",
    label: "Mean Time Between Failures",
    unit: "h",
    higherIsBetter: true,
  },
  {
    value: "TRAINING_PCT",
    label: "Operator Training %",
    unit: "%",
    higherIsBetter: true,
  },
] as const;

export type ObjectiveKpiType = (typeof OBJECTIVE_KPI_TYPES)[number]["value"];

export const kpiMeta = (t: string) =>
  OBJECTIVE_KPI_TYPES.find((k) => k.value === t) || {
    value: t,
    label: t,
    unit: "",
    higherIsBetter: true,
  };

function monthRange(period: string): { start: Date; end: Date } {
  const parts = (period || "").split("-").map(Number);
  const now = new Date();
  const y = parts[0] && Number.isFinite(parts[0]) ? parts[0] : now.getFullYear();
  const m = parts[1] && Number.isFinite(parts[1]) ? parts[1] : now.getMonth() + 1;
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

export function currentPeriod(now: Date = new Date()): string {
  const safeNow = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  return `${safeNow.getFullYear()}-${String(safeNow.getMonth() + 1).padStart(2, "0")}`;
}

export type ObjectiveActual = {
  objective: any;
  actual: number | null;
  met: boolean | null; // null = no data to judge
  detail: string;
};

/**
 * Compute a live actual for one KPI type over a month period.
 * All numbers derive from app records — never entered by hand.
 */
export async function computeActual(
  kpiType: string,
  period: string,
): Promise<{ value: number | null; detail: string }> {
  const { start, end } = monthRange(period);
  try {
    switch (kpiType) {
      case "OTD_PCT": {
        // On-time = dispatch (or completion) on/before promisedDispatchDate, in-period.
        const [dispatched, completed] = await Promise.all([
          prisma.dispatchRecord.findMany({
            where: { dispatchedAt: { gte: start, lt: end } },
            include: { workOrder: { select: { promisedDispatchDate: true } } },
          }),
          prisma.workOrder.findMany({
            where: {
              status: "COMPLETED",
              promisedDispatchDate: { gte: start, lt: end },
            },
            select: { promisedDispatchDate: true, updatedAt: true },
          }),
        ]);
        let onTime = 0;
        let total = 0;
        dispatched.forEach((d) => {
          total++;
          if (
            d.workOrder &&
            d.workOrder.promisedDispatchDate &&
            d.dispatchedAt <= d.workOrder.promisedDispatchDate
          )
            onTime++;
        });
        completed.forEach((wo) => {
          total++;
          if (
            wo.promisedDispatchDate &&
            wo.updatedAt <= wo.promisedDispatchDate
          )
            onTime++;
        });
        if (total === 0)
          return { value: null, detail: "No dispatches/completions in period" };
        const value = Number(((onTime / total) * 100).toFixed(1));
        return { value, detail: `${onTime}/${total} orders on time` };
      }
      case "PPM": {
        const agg = await prisma.productionLog.aggregate({
          where: { startTime: { gte: start, lt: end } },
          _sum: {
            goodQuantity: true,
            scrapQuantity: true,
            reworkQuantity: true,
          },
        });
        const good = agg._sum.goodQuantity || 0;
        const scrap = agg._sum.scrapQuantity || 0;
        const total = good + scrap;
        if (total === 0)
          return { value: null, detail: "No production logged in period" };
        const ppm = Math.round((scrap / total) * 1_000_000);
        return {
          value: ppm,
          detail: `${scrap} defective of ${total} produced`,
        };
      }
      case "MTBF": {
        const [events, prodLogs] = await Promise.all([
          prisma.downtimeLog.count({
            where: { startTime: { gte: start, lt: end } },
          }),
          prisma.productionLog.findMany({
            where: {
              startTime: { gte: start, lt: end },
              endTime: { not: null },
            },
            select: { startTime: true, endTime: true },
          }),
        ]);
        if (events === 0)
          return { value: null, detail: "No breakdown events in period" };
        let operatingMs = 0;
        prodLogs.forEach((l) => {
          if (l.startTime && l.endTime) {
            const s = l.startTime.getTime();
            const e = (l.endTime as Date).getTime();
            if (e > s) operatingMs += e - s;
          }
        });
        const operatingHours = operatingMs / 3_600_000;
        if (operatingHours <= 0)
          return { value: null, detail: "No run hours logged in period" };
        const value = Number((operatingHours / events).toFixed(1));
        return {
          value,
          detail: `${operatingHours.toFixed(0)} run hours / ${events} breakdowns`,
        };
      }
      case "TRAINING_PCT": {
        const [certified, totalUsers] = await Promise.all([
          prisma.certification.findMany({
            where: { isActive: true, validFrom: { lte: end } },
            select: { userId: true },
            distinct: ["userId"],
          }),
          prisma.user.count({ where: { isActive: true } }),
        ]);
        if (totalUsers === 0) return { value: null, detail: "No active users" };
        const value = Number(
          ((certified.length / totalUsers) * 100).toFixed(1),
        );
        return {
          value,
          detail: `${certified.length}/${totalUsers} operators certified`,
        };
      }
      default:
        return { value: null, detail: "Unknown KPI type" };
    }
  } catch (e) {
    console.error("computeActual error:", e);
    return { value: null, detail: "Computation failed" };
  }
}

/**
 * Active objectives for a period, each with its live actual and met/missed verdict.
 */
export async function getObjectiveActuals(
  period?: string,
): Promise<ObjectiveActual[]> {
  const p = period || currentPeriod();
  const objectives = await prisma.qualityObjective.findMany({
    where: { isActive: true, period: p },
    orderBy: [{ department: "asc" }, { kpiType: "asc" }],
  });
  const rows: ObjectiveActual[] = [];
  for (const obj of objectives) {
    const { value, detail } = await computeActual(obj.kpiType, p);
    let met: boolean | null = null;
    if (value !== null) {
      const meta = kpiMeta(obj.kpiType);
      met = meta.higherIsBetter
        ? value >= obj.targetValue
        : value <= obj.targetValue;
    }
    rows.push({ objective: obj, actual: value, met, detail });
  }
  return rows;
}

/** Missed objectives (actual below target for higher-is-better, above for ppm) → digest flags. */
export async function getMissedObjectives(
  now: Date = new Date(),
): Promise<any[]> {
  const rows = await getObjectiveActuals(currentPeriod(now));
  return rows.filter((r) => r.met === false);
}
