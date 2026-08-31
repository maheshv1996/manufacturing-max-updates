// Lean Analytics & Six Sigma Statistical Data Helpers
import { prisma } from "@/lib/prisma";
import { ParsedDateRange } from "./date-utils";
import { getOEERules } from "./settings";

export interface LeanKpis {
  mttrMinutes: number;
  mtbfHours: number;
  firstPassYieldPct: number;
  scrapRatePct: number;
  totalGoodUnits: number;
  totalScrapUnits: number;
  totalDowntimeMinutes: number;
  totalDowntimeEvents: number;
}

export interface ParetoItem {
  name: string;
  code: string;
  value: number;
  cumulativePct: number;
}

export interface ControlChartPoint {
  date: string;
  oee: number;
  mean: number;
  ucl: number;
  lcl: number;
  isOutlier: boolean;
}

export interface FpyTrendPoint {
  date: string;
  fpyPct: number;
}

export interface DowntimeCategoryPoint {
  name: string;
  value: number;
  color: string;
}

const round1 = (n: number) => Math.round((Number(n) || 0) * 10) / 10;
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export async function getLeanAnalyticsData(
  parsedRange: ParsedDateRange,
  plantId?: string,
) {
  const from = parsedRange?.current?.from || new Date();
  const to = parsedRange?.current?.to || new Date();

  const machinePlantFilter =
    plantId && plantId !== "ALL" ? { plantId } : undefined;

  const [downtimeLogs, productionLogs, qualityInspections, machines, oeeRules] =
    await Promise.all([
      prisma.downtimeLog.findMany({
        where: {
          startTime: { gte: from, lte: to },
          ...(machinePlantFilter ? { machine: machinePlantFilter } : {}),
        },
        include: { reason: true, machine: true },
        orderBy: { startTime: "asc" },
      }),
      prisma.productionLog.findMany({
        where: {
          startTime: { gte: from, lte: to },
          ...(machinePlantFilter ? { machine: machinePlantFilter } : {}),
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.qualityInspection.findMany({
        where: {
          createdAt: { gte: from, lte: to },
        },
        include: { defectCode: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.machine.findMany({
        where: {
          isActive: true,
          ...(machinePlantFilter ? machinePlantFilter : {}),
        },
        select: { id: true },
      }),
      getOEERules(),
    ]);

  const machineCount = Math.max(1, machines.length);

  // 1. KPI Calculations
  let totalDowntimeMinutes = 0;
  let downtimeCount = 0;

  downtimeLogs.forEach((log) => {
    const mins = Number(log.durationMinutes) || 0;
    totalDowntimeMinutes += mins;
    downtimeCount++;
  });

  const mttrMinutes =
    downtimeCount > 0 ? round1(totalDowntimeMinutes / downtimeCount) : 0;

  let totalGoodUnits = 0;
  let totalScrapUnits = 0;
  let totalReworkUnits = 0;

  productionLogs.forEach((log) => {
    totalGoodUnits += Number(log.goodQuantity) || 0;
    totalScrapUnits += Number(log.scrapQuantity) || 0;
    totalReworkUnits += Number(log.reworkQuantity) || 0;
  });

  const totalProduced = totalGoodUnits + totalScrapUnits + totalReworkUnits;
  const firstPassYieldPct =
    totalProduced > 0
      ? round2((totalGoodUnits / totalProduced) * 100)
      : 100.0;

  const scrapRatePct =
    totalProduced > 0
      ? round2((totalScrapUnits / totalProduced) * 100)
      : 0.0;

  const totalDays = Math.max(
    1,
    (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24),
  );
  const totalFleetMinutes = totalDays * 24 * 60 * machineCount;
  const estimatedOperatingMinutes = Math.max(0, totalFleetMinutes - totalDowntimeMinutes);
  const mtbfHours =
    downtimeCount > 0
      ? round1(estimatedOperatingMinutes / downtimeCount / 60)
      : round1((totalFleetMinutes / 60) || 720);

  // 2. Downtime Pareto (AIAG / Lean Category Stratification)
  const reasonMap = new Map<string, { code: string; name: string; minutes: number }>();

  downtimeLogs.forEach((log) => {
    const code = log.reason?.code || "D-UNKN";
    const name = log.reason?.description || log.reason?.category || "Unspecified Loss";
    const mins = Number(log.durationMinutes) || 0;

    const existing = reasonMap.get(code) || { code, name, minutes: 0 };
    existing.minutes += mins;
    reasonMap.set(code, existing);
  });

  const sortedDowntimeReasons = Array.from(reasonMap.values()).sort(
    (a, b) => b.minutes - a.minutes,
  );

  const downtimeParetoTotal =
    sortedDowntimeReasons.reduce((sum, r) => sum + r.minutes, 0) || 1;

  let runningDowntimeSum = 0;
  const downtimeParetoData: ParetoItem[] = sortedDowntimeReasons.map((r) => {
    runningDowntimeSum += r.minutes;
    return {
      name: r.name,
      code: r.code,
      value: r.minutes,
      cumulativePct: round1((runningDowntimeSum / downtimeParetoTotal) * 100),
    };
  });

  // 3. Defect Pareto
  const defectMap = new Map<string, { code: string; name: string; failed: number }>();

  qualityInspections.forEach((insp) => {
    const code = insp.defectCode?.code || "DEF-MISC";
    const name = insp.defectCode?.description || "General Defect";
    const failed = Number(insp.failed) || 1;

    const existing = defectMap.get(code) || { code, name, failed: 0 };
    existing.failed += failed;
    defectMap.set(code, existing);
  });

  const sortedDefects = Array.from(defectMap.values()).sort(
    (a, b) => b.failed - a.failed,
  );

  const defectParetoTotal =
    sortedDefects.reduce((sum, d) => sum + d.failed, 0) || 1;

  let runningDefectSum = 0;
  const defectParetoData: ParetoItem[] = sortedDefects.map((d) => {
    runningDefectSum += d.failed;
    return {
      name: d.name,
      code: d.code,
      value: d.failed,
      cumulativePct: round1((runningDefectSum / defectParetoTotal) * 100),
    };
  });

  // 4. SPC Control Chart (Daily Plant OEE with Upper & Lower 3-Sigma Control Limits)
  const diffDays = Math.max(1, Math.ceil(totalDays));
  const numPoints = Math.min(diffDays, 30);

  const rawOeePoints: { date: string; oee: number; fpy: number }[] = [];

  for (let i = numPoints - 1; i >= 0; i--) {
    const dayStart = new Date(to.getTime() - (i + 1) * 24 * 60 * 60 * 1000);
    const dayEnd = new Date(to.getTime() - i * 24 * 60 * 60 * 1000);

    const dateStr = dayStart.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

    const dayPLogs = productionLogs.filter(
      (l) => l.startTime >= dayStart && l.startTime < dayEnd,
    );
    const dayDLogs = downtimeLogs.filter(
      (l) => l.startTime >= dayStart && l.startTime < dayEnd,
    );

    let good = 0;
    let scrap = 0;
    let rework = 0;
    dayPLogs.forEach((l) => {
      good += Number(l.goodQuantity) || 0;
      scrap += Number(l.scrapQuantity) || 0;
      rework += Number(l.reworkQuantity) || 0;
    });
    const total = good + scrap + rework;

    let totalDowntimeMin = 0;
    let plannedDowntimeMin = 0;
    let unplannedDowntimeMin = 0;

    dayDLogs.forEach((l) => {
      const mins = Number(l.durationMinutes) || 0;
      totalDowntimeMin += mins;
      const cat = l.reason?.category;
      if (cat && oeeRules.plannedCategories.includes(cat)) {
        plannedDowntimeMin += mins;
      } else {
        unplannedDowntimeMin += mins;
      }
    });

    const shiftCapacityMinutes = 24 * 60 * machineCount;
    const plannedProductionTime = oeeRules.excludePlanned
      ? Math.max(60, shiftCapacityMinutes - plannedDowntimeMin)
      : shiftCapacityMinutes;

    const operatingMins = oeeRules.excludePlanned
      ? Math.max(0, plannedProductionTime - unplannedDowntimeMin)
      : Math.max(0, shiftCapacityMinutes - totalDowntimeMin);

    const avail = plannedProductionTime > 0 ? Math.min(1, operatingMins / plannedProductionTime) : 1;
    const qual = total > 0 ? Math.min(1, good / total) : 1;
    const perf = total > 0 ? Math.min(1, Math.max(0.75, (good * 1.5) / Math.max(1, operatingMins))) : 0.90;

    const oee = round1(avail * perf * qual * 100);
    const fpy = total > 0 ? round1((good / (good + scrap)) * 100) : 100;

    rawOeePoints.push({
      date: dateStr,
      oee,
      fpy,
    });
  }

  const oeeSum = rawOeePoints.reduce((sum, p) => sum + p.oee, 0);
  const meanOee = rawOeePoints.length > 0 ? oeeSum / rawOeePoints.length : 0;

  const variance =
    rawOeePoints.length > 1
      ? rawOeePoints.reduce((sum, p) => sum + Math.pow(p.oee - meanOee, 2), 0) /
        (rawOeePoints.length - 1)
      : 0;
  const sigma = Math.sqrt(variance);

  const ucl = round1(Math.min(100, meanOee + 3 * sigma));
  const lcl = round1(Math.max(0, meanOee - 3 * sigma));
  const meanVal = round1(meanOee);

  const controlChartData: ControlChartPoint[] = rawOeePoints.map((p) => {
    const isOutlier = p.oee > ucl || p.oee < lcl;
    return {
      date: p.date,
      oee: p.oee,
      mean: meanVal,
      ucl,
      lcl,
      isOutlier,
    };
  });

  const fpyTrendData: FpyTrendPoint[] = rawOeePoints.map((p) => ({
    date: p.date,
    fpyPct: p.fpy,
  }));

  // 5. Downtime Category Distribution
  const categoryMap = new Map<string, number>();
  const categoryColors: Record<string, string> = {
    MECHANICAL: "#f43f5e",
    ELECTRICAL: "#3b82f6",
    MATERIAL: "#f59e0b",
    QUALITY: "#ea580c",
    OPERATOR: "#a855f7",
    UTILITIES: "#06b6d4",
    TOOLING: "#8b5cf6",
    PLANNED_PM: "#10b981",
  };

  downtimeLogs.forEach((log) => {
    const cat = String(log.reason?.category || "MECHANICAL").toUpperCase();
    const mins = Number(log.durationMinutes) || 0;
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + mins);
  });

  const downtimeCategoryData: DowntimeCategoryPoint[] = Array.from(
    categoryMap.entries(),
  ).map(([cat, mins]) => ({
    name: cat,
    value: mins,
    color: categoryColors[cat] || "#64748b",
  }));

  return {
    kpis: {
      mttrMinutes,
      mtbfHours,
      firstPassYieldPct,
      scrapRatePct,
      totalGoodUnits,
      totalScrapUnits,
      totalDowntimeMinutes,
      totalDowntimeEvents: downtimeCount,
    },
    downtimeParetoData,
    defectParetoData,
    controlChartData,
    fpyTrendData,
    downtimeCategoryData,
  };
}
