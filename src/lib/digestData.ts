import { prisma } from "./prisma";
import { getOEERules } from "./settings";
import { startOfDay, endOfDay, subDays } from "date-fns";

export interface DigestData {
  date: Date;
  plantName: string;
  oee: number;
  oeeDelta: number;
  totalGood: number;
  totalScrap: number;
  totalRework?: number;
  totalDowntimeMin: number;
  topDowntimeReason: string | null;
  bestMachine: { name: string; oee: number } | null;
  worstMachine: { name: string; oee: number } | null;
  openWorkOrders: number;
  attentionNeeded: string[];
}

function formatReasonCategory(cat?: string | null): string | null {
  if (!cat) return null;
  const s = String(cat).trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Computes daily factory executive briefing digest.
 * Calculates true shopfloor OEE across all machine centers for target date vs previous day.
 */
export async function getDigestData(
  targetDate: Date = new Date(),
  plantId?: string,
): Promise<DigestData> {
  const safeDate = targetDate instanceof Date && !isNaN(targetDate.getTime()) ? targetDate : new Date();

  const start = startOfDay(safeDate);
  const end = endOfDay(safeDate);

  const prevStart = startOfDay(subDays(safeDate, 1));
  const prevEnd = endOfDay(subDays(safeDate, 1));

  const isAll = !plantId || plantId === "ALL";
  const plantWhere = isAll ? {} : { plantId };
  const machinePlantWhere = isAll ? { isActive: true } : { plantId, isActive: true };

  // Fetch OEE rules and Plant Name in parallel
  const [oeeRules, plant, openWorkOrders] = await Promise.all([
    getOEERules().catch(() => ({ excludePlanned: true, plannedCategories: ["MAINTENANCE", "SETUP"] })),
    isAll ? prisma.plant.findFirst() : prisma.plant.findUnique({ where: { id: plantId } }),
    prisma.workOrder.count({
      where: {
        status: { in: ["PLANNED", "IN_PROGRESS"] },
        ...plantWhere,
      },
    }),
  ]);

  const plantName = plant?.name || (isAll ? "All Plants Facility" : "Manufacturing Plant");

  // Helper to fetch and calculate real OEE per daily period
  async function computeDailyMetrics(from: Date, to: Date) {
    const [machines, pLogs, dLogs] = await Promise.all([
      prisma.machine.findMany({
        where: machinePlantWhere,
        select: {
          id: true,
          name: true,
          code: true,
          idealCycleTimeSeconds: true,
          oeeTarget: true,
        },
      }),
      prisma.productionLog.findMany({
        where: {
          startTime: { gte: from, lte: to },
          machine: machinePlantWhere,
        },
      }),
      prisma.downtimeLog.findMany({
        where: {
          startTime: { gte: from, lte: to },
          machine: machinePlantWhere,
        },
        include: { reason: true },
      }),
    ]);

    let totalGood = 0;
    let totalScrap = 0;
    let totalRework = 0;
    let totalDowntimeMin = 0;

    const reasonCounts = new Map<string, number>();

    // Machine aggregation map
    const machineMap = new Map<
      string,
      {
        machine: (typeof machines)[0];
        good: number;
        scrap: number;
        rework: number;
        totalDowntimeMin: number;
        plannedDowntimeMin: number;
        unplannedDowntimeMin: number;
      }
    >();

    // Initialize map for all active machines
    machines.forEach((m) => {
      machineMap.set(m.id, {
        machine: m,
        good: 0,
        scrap: 0,
        rework: 0,
        totalDowntimeMin: 0,
        plannedDowntimeMin: 0,
        unplannedDowntimeMin: 0,
      });
    });

    pLogs.forEach((log) => {
      const g = log.goodQuantity || 0;
      const s = log.scrapQuantity || 0;
      const r = log.reworkQuantity || 0;

      totalGood += g;
      totalScrap += s;
      totalRework += r;

      const entry = machineMap.get(log.machineId);
      if (entry) {
        entry.good += g;
        entry.scrap += s;
        entry.rework += r;
      }
    });

    dLogs.forEach((log) => {
      const duration = log.durationMinutes || 0;
      totalDowntimeMin += duration;

      if (log.reason?.category) {
        reasonCounts.set(
          log.reason.category,
          (reasonCounts.get(log.reason.category) || 0) + duration,
        );
      }

      const entry = machineMap.get(log.machineId);
      if (entry) {
        entry.totalDowntimeMin += duration;
        const isPlanned = oeeRules.plannedCategories.includes(log.reason?.category || "");
        if (isPlanned) {
          entry.plannedDowntimeMin += duration;
        } else {
          entry.unplannedDowntimeMin += duration;
        }
      }
    });

    // Determine top downtime reason
    let topReason: string | null = null;
    let maxReasonMin = -1;
    reasonCounts.forEach((min, reason) => {
      if (min > maxReasonMin) {
        maxReasonMin = min;
        topReason = reason;
      }
    });

    // 24-hour shift minutes (1440 min)
    const shiftMinutes = 1440;

    // Calculate Real Mathematical OEE for each machine
    const machineList = Array.from(machineMap.values()).map((entry) => {
      const plannedTime = oeeRules.excludePlanned
        ? Math.max(1, shiftMinutes - entry.plannedDowntimeMin)
        : shiftMinutes;

      const operatingMin = Math.max(0, plannedTime - entry.unplannedDowntimeMin);
      const availability = plannedTime > 0 ? Math.min(1, operatingMin / plannedTime) : 0;

      const totalParts = entry.good + entry.scrap + entry.rework;
      const quality = totalParts > 0 ? Math.min(1, entry.good / totalParts) : 1.0;

      const cycleSecs = Math.max(0.1, Number(entry.machine.idealCycleTimeSeconds) || 60);
      const idealRunRatePerMin = 60 / cycleSecs;
      const theoreticalMax = operatingMin * idealRunRatePerMin;

      const performance = theoreticalMax > 0 ? Math.min(1, Math.max(0, totalParts / theoreticalMax)) : (totalParts > 0 ? 0.85 : 0);
      const oee = Math.round(availability * performance * quality * 10000) / 100;

      return {
        ...entry,
        oee,
      };
    });

    const plantOee =
      machineList.length > 0
        ? Math.round((machineList.reduce((acc, m) => acc + m.oee, 0) / machineList.length) * 10) / 10
        : 0;

    return {
      totalGood,
      totalScrap,
      totalRework,
      totalDowntimeMin,
      topReason: formatReasonCategory(topReason),
      machineList,
      plantOee,
    };
  }

  const [currentStats, prevStats] = await Promise.all([
    computeDailyMetrics(start, end),
    computeDailyMetrics(prevStart, prevEnd),
  ]);

  // Best and worst machines
  let bestMachine: { name: string; oee: number } | null = null;
  let worstMachine: { name: string; oee: number } | null = null;

  if (currentStats.machineList.length > 0) {
    const sorted = [...currentStats.machineList].sort((a, b) => b.oee - a.oee);
    bestMachine = { name: sorted[0].machine.name, oee: sorted[0].oee };
    worstMachine = {
      name: sorted[sorted.length - 1].machine.name,
      oee: sorted[sorted.length - 1].oee,
    };
  }

  // Attention needed
  const attentionNeeded: string[] = [];
  currentStats.machineList.forEach((m) => {
    const target = m.machine.oeeTarget ?? 85.0;
    if (m.oee < target || m.totalDowntimeMin > 60) {
      if (!attentionNeeded.includes(m.machine.name)) {
        attentionNeeded.push(m.machine.name);
      }
    }
  });

  return {
    date: safeDate,
    plantName,
    oee: currentStats.plantOee,
    oeeDelta: Math.round((currentStats.plantOee - prevStats.plantOee) * 10) / 10,
    totalGood: currentStats.totalGood,
    totalScrap: currentStats.totalScrap,
    totalRework: currentStats.totalRework,
    totalDowntimeMin: currentStats.totalDowntimeMin,
    topDowntimeReason: currentStats.topReason,
    bestMachine,
    worstMachine,
    openWorkOrders,
    attentionNeeded,
  };
}
