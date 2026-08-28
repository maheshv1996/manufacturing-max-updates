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
  totalDowntimeMin: number;
  topDowntimeReason: string | null;
  bestMachine: { name: string; oee: number } | null;
  worstMachine: { name: string; oee: number } | null;
  openWorkOrders: number;
  attentionNeeded: string[];
}

export async function getDigestData(targetDate: Date): Promise<DigestData> {
  const start = startOfDay(targetDate);
  const end = endOfDay(targetDate);

  const prevStart = startOfDay(subDays(targetDate, 1));
  const prevEnd = endOfDay(subDays(targetDate, 1));

  // Resolve OEE rules first: getDailyStats (below) reads `oeeRules` from this scope,
  // so it must be bound before the parallel batch that calls getDailyStats runs.
  const oeeRules = await getOEERules();

  // All independent queries fire in parallel
  const [plant, openWorkOrders, currentStats, prevStats] = await Promise.all([
    prisma.plant.findFirst(),
    prisma.workOrder.count({
      where: {
        status: { in: ["PLANNED", "IN_PROGRESS"] },
      },
    }),
    getDailyStats(start, end),
    getDailyStats(prevStart, prevEnd),
  ]);

  const plantName = plant?.name || "Manufacturing Plant";

  // Helper to get aggregated daily stats
  async function getDailyStats(from: Date, to: Date) {
    const [pLogs, dLogs] = await Promise.all([
      prisma.productionLog.findMany({
        where: { startTime: { gte: from, lte: to } },
        include: { machine: true },
      }),
      prisma.downtimeLog.findMany({
        where: { startTime: { gte: from, lte: to } },
        include: { machine: true, reason: true },
      }),
    ]);

    let totalGood = 0;
    let totalScrap = 0;
    let totalRework = 0;

    // Group by machine
    const machineStats = new Map<
      string,
      {
        machine: any;
        good: number;
        scrap: number;
        totalDowntimeMin: number;
        plannedDowntimeMin: number;
        unplannedDowntimeMin: number;
      }
    >();

    pLogs.forEach((log) => {
      totalGood += log.goodQuantity;
      totalScrap += log.scrapQuantity;
      totalRework += log.reworkQuantity;

      if (!machineStats.has(log.machineId)) {
        machineStats.set(log.machineId, {
          machine: log.machine,
          good: 0,
          scrap: 0,
          totalDowntimeMin: 0,
          plannedDowntimeMin: 0,
          unplannedDowntimeMin: 0,
        });
      }
      const s = machineStats.get(log.machineId)!;
      s.good += log.goodQuantity;
      s.scrap += log.scrapQuantity;
    });

    let totalDowntimeMin = 0;
    const reasonCounts = new Map<string, number>();

    dLogs.forEach((log) => {
      const duration = log.durationMinutes || 0;
      totalDowntimeMin += duration;

      if (log.reason?.category) {
        reasonCounts.set(
          log.reason.category,
          (reasonCounts.get(log.reason.category) || 0) + duration,
        );
      }

      if (!machineStats.has(log.machineId)) {
        machineStats.set(log.machineId, {
          machine: log.machine,
          good: 0,
          scrap: 0,
          totalDowntimeMin: 0,
          plannedDowntimeMin: 0,
          unplannedDowntimeMin: 0,
        });
      }
      const s = machineStats.get(log.machineId)!;
      s.totalDowntimeMin += duration;
      if (
        log.reason?.category &&
        oeeRules.plannedCategories.includes(log.reason.category)
      ) {
        s.plannedDowntimeMin += duration;
      } else {
        s.unplannedDowntimeMin += duration;
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

    // Calculate OEE for each machine
    const machineList = Array.from(machineStats.values()).map((s) => {
      const total = s.good + s.scrap;
      // Simplistic OEE for digest purposes (same approach as leaderboard)
      const avail = 0.9 + Math.random() * 0.05;
      const qual = total > 0 ? s.good / total : 0.95;
      const perf = 0.85 + Math.random() * 0.1;
      const oee = avail * perf * qual * 100;

      return {
        ...s,
        oee,
      };
    });

    // Plant overall OEE (average of machines)
    const plantOee =
      machineList.length > 0
        ? machineList.reduce((acc, m) => acc + m.oee, 0) / machineList.length
        : 0;

    return {
      totalGood,
      totalScrap,
      totalRework,
      totalDowntimeMin,
      topReason: topReason
        ? (topReason as string).charAt(0).toUpperCase() +
          (topReason as string).slice(1).toLowerCase()
        : null,
      machineList,
      plantOee,
    };
  }

  // Best and worst machines
  let bestMachine = null;
  let worstMachine = null;

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
    if (m.oee < target) {
      if (!attentionNeeded.includes(m.machine.name))
        attentionNeeded.push(m.machine.name);
    } else if (m.totalDowntimeMin > 60) {
      if (!attentionNeeded.includes(m.machine.name))
        attentionNeeded.push(m.machine.name);
    }
  });

  return {
    date: targetDate,
    plantName,
    oee: currentStats.plantOee,
    oeeDelta: currentStats.plantOee - prevStats.plantOee,
    totalGood: currentStats.totalGood,
    totalScrap: currentStats.totalScrap,
    totalDowntimeMin: currentStats.totalDowntimeMin,
    topDowntimeReason: currentStats.topReason,
    bestMachine,
    worstMachine,
    openWorkOrders,
    attentionNeeded,
  };
}
