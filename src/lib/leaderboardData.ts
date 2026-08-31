import { prisma } from "./prisma";
import { ParsedDateRange } from "./date-utils";
import { getOEERules } from "./settings";

export interface LeaderboardEntry {
  id: string;
  name: string;
  rank: number;
  oee?: number;
  score?: number;
  oeeDelta?: number;
  scoreDelta?: number;
  totalOutput: number;
  scrapPct: number;
  downtimeHours?: number;
}

export interface LeaderboardData {
  shifts: LeaderboardEntry[];
  machines: LeaderboardEntry[];
  operators: LeaderboardEntry[];
  plants: LeaderboardEntry[];
}

const round1 = (n: number) => Math.round((Number(n) || 0) * 10) / 10;
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export async function getLeaderboardData(
  range: ParsedDateRange,
  plantId: string = "ALL",
): Promise<LeaderboardData> {
  // Validate and clamp date boundaries
  const currentFrom = range?.current?.from || new Date();
  const currentTo = range?.current?.to || new Date();
  const prevFrom = range?.previous?.from || currentFrom;
  const prevTo = range?.previous?.to || currentTo;

  const [
    oeeRules,
    currentLogs,
    previousLogs,
    currentDowntime,
    previousDowntime,
  ] = await Promise.all([
    getOEERules(),
    prisma.productionLog.findMany({
      where: {
        startTime: { gte: currentFrom, lte: currentTo },
        ...(plantId && plantId !== "ALL" ? { machine: { plantId } } : {}),
      },
      include: {
        machine: { include: { plant: true } },
        operator: true,
        shift: true,
      },
    }),
    prisma.productionLog.findMany({
      where: {
        startTime: { gte: prevFrom, lte: prevTo },
        ...(plantId && plantId !== "ALL" ? { machine: { plantId } } : {}),
      },
      include: {
        machine: { include: { plant: true } },
        operator: true,
        shift: true,
      },
    }),
    prisma.downtimeLog.findMany({
      where: {
        startTime: { gte: currentFrom, lte: currentTo },
        ...(plantId && plantId !== "ALL" ? { machine: { plantId } } : {}),
      },
      include: {
        machine: { include: { plant: true } },
        operator: true,
        reason: true,
      },
    }),
    prisma.downtimeLog.findMany({
      where: {
        startTime: { gte: prevFrom, lte: prevTo },
        ...(plantId && plantId !== "ALL" ? { machine: { plantId } } : {}),
      },
      include: {
        machine: { include: { plant: true } },
        operator: true,
        reason: true,
      },
    }),
  ]);

  const aggregateEntity = (
    logs: typeof currentLogs,
    downtimes: typeof currentDowntime,
    entityKey: "shift" | "machine" | "operator" | "plant",
  ) => {
    const map = new Map<string, {
      id: string;
      name: string;
      good: number;
      scrap: number;
      rework: number;
      plannedDowntimeMin: number;
      unplannedDowntimeMin: number;
      totalDowntimeMin: number;
      operatorPenaltyDowntimeMin: number;
      machineIds: Set<string>;
    }>();

    logs.forEach((log) => {
      let entity: any = log[entityKey as keyof typeof log];
      if (entityKey === "plant" && log.machine) {
        entity = log.machine.plant;
      }
      if (!entity || !entity.id) return;

      const id = String(entity.id);
      if (!map.has(id)) {
        const name =
          entityKey === "operator"
            ? (entity as any).name || (entity as any).username || "Operator"
            : (entity as any).name || "Unknown";

        map.set(id, {
          id,
          name,
          good: 0,
          scrap: 0,
          rework: 0,
          plannedDowntimeMin: 0,
          unplannedDowntimeMin: 0,
          totalDowntimeMin: 0,
          operatorPenaltyDowntimeMin: 0,
          machineIds: new Set<string>(),
        });
      }

      const stats = map.get(id)!;
      stats.good += Number(log.goodQuantity) || 0;
      stats.scrap += Number(log.scrapQuantity) || 0;
      stats.rework += Number(log.reworkQuantity) || 0;
      if (log.machine?.id) {
        stats.machineIds.add(log.machine.id);
      }
    });

    downtimes.forEach((dt) => {
      let entity: any;
      if (entityKey === "machine") {
        entity = (dt as any).machine;
      } else if (entityKey === "operator") {
        entity = (dt as any).operator;
      } else if (entityKey === "plant") {
        entity = (dt as any).machine?.plant;
      } else {
        // Shift does not track separate downtime logs directly in this model
        return;
      }

      if (!entity || !entity.id) return;

      const id = String(entity.id);
      if (!map.has(id)) {
        const name =
          entityKey === "operator"
            ? (entity as any).name || (entity as any).username || "Operator"
            : (entity as any).name || "Unknown";

        map.set(id, {
          id,
          name,
          good: 0,
          scrap: 0,
          rework: 0,
          plannedDowntimeMin: 0,
          unplannedDowntimeMin: 0,
          totalDowntimeMin: 0,
          operatorPenaltyDowntimeMin: 0,
          machineIds: new Set<string>(),
        });
      }

      const stats = map.get(id)!;
      const duration = Number(dt.durationMinutes) || 0;
      stats.totalDowntimeMin += duration;

      const reasonCat = (dt as any).reason?.category;
      const isPlanned = reasonCat && oeeRules.plannedCategories.includes(reasonCat);

      if (isPlanned) {
        stats.plannedDowntimeMin += duration;
      } else {
        stats.unplannedDowntimeMin += duration;
      }

      // Check if downtime reason specifically penalizes operator score
      const affectsOpScore = (dt as any).reason?.affectsOperatorScore !== false;
      if (affectsOpScore && !isPlanned) {
        stats.operatorPenaltyDowntimeMin += duration;
      }
    });

    return Array.from(map.values()).map((stats) => {
      const total = stats.good + stats.scrap + stats.rework;
      const scrapPct = total > 0 ? (stats.scrap / total) * 100 : 0;

      let oee = 0;
      if (entityKey === "shift" || entityKey === "machine" || entityKey === "plant") {
        // Real shopfloor OEE calculation:
        // Assume default planned shift base (480 min) adjusted by active machines
        const machineCount = Math.max(1, stats.machineIds.size);
        const estimatedPlannedMin = Math.max(480 * machineCount, stats.totalDowntimeMin + 60);

        const operatingMin = Math.max(0, estimatedPlannedMin - stats.unplannedDowntimeMin);
        const availability = estimatedPlannedMin > 0 ? Math.min(1, Math.max(0, operatingMin / estimatedPlannedMin)) : 1;
        const quality = total > 0 ? Math.min(1, Math.max(0, stats.good / total)) : 1;
        const performance = total > 0 ? Math.min(1, Math.max(0.70, (stats.good * 1.0) / Math.max(1, operatingMin * 2))) : 0.85;

        oee = availability * performance * quality * 100;
        if (oee > 100) oee = 100;
      }

      let score = stats.good - 2 * stats.scrap;
      if (entityKey === "operator") {
        // Penalize score only by downtime categories assigned to operator responsibility
        score -= Math.floor(stats.operatorPenaltyDowntimeMin);
      }

      return {
        id: stats.id,
        name: stats.name,
        oee: round1(oee),
        score: Math.max(0, Math.round(score)),
        totalOutput: stats.good,
        scrapPct: round2(scrapPct),
        downtimeHours: round1(stats.totalDowntimeMin / 60),
      };
    });
  };

  const currentShifts = aggregateEntity(currentLogs, currentDowntime, "shift");
  const currentMachines = aggregateEntity(currentLogs, currentDowntime, "machine");
  const currentOperators = aggregateEntity(currentLogs, currentDowntime, "operator");
  const currentPlants = aggregateEntity(currentLogs, currentDowntime, "plant");

  const prevShifts = aggregateEntity(previousLogs, previousDowntime, "shift");
  const prevMachines = aggregateEntity(previousLogs, previousDowntime, "machine");
  const prevOperators = aggregateEntity(previousLogs, previousDowntime, "operator");
  const prevPlants = aggregateEntity(previousLogs, previousDowntime, "plant");

  const prevShiftMap = new Map(prevShifts.map((s) => [s.id, s.oee]));
  const prevMachineMap = new Map(prevMachines.map((m) => [m.id, m.oee]));
  const prevOpMap = new Map(prevOperators.map((o) => [o.id, o.score]));
  const prevPlantMap = new Map(prevPlants.map((p) => [p.id, p.oee]));

  currentShifts.sort((a, b) => (b.oee || 0) - (a.oee || 0));
  currentMachines.sort((a, b) => (b.oee || 0) - (a.oee || 0));
  currentOperators.sort((a, b) => (b.score || 0) - (a.score || 0));
  currentPlants.sort((a, b) => (b.oee || 0) - (a.oee || 0));

  const formatLeaderboard = (
    list: any[],
    prevMap: Map<string, any>,
    isScore = false,
  ): LeaderboardEntry[] => {
    return list.map((item, index) => {
      const prevVal = prevMap.get(item.id) ?? (isScore ? item.score : item.oee);
      const currentVal = isScore ? item.score : item.oee;
      const delta = round1((currentVal || 0) - (prevVal || 0));

      return {
        id: item.id,
        name: item.name,
        rank: index + 1,
        oee: !isScore ? item.oee : undefined,
        score: isScore ? item.score : undefined,
        oeeDelta: !isScore ? delta : undefined,
        scoreDelta: isScore ? delta : undefined,
        totalOutput: item.totalOutput,
        scrapPct: item.scrapPct,
        downtimeHours: item.downtimeHours,
      };
    });
  };

  return {
    shifts: formatLeaderboard(currentShifts, prevShiftMap, false),
    machines: formatLeaderboard(currentMachines, prevMachineMap, false),
    operators: formatLeaderboard(currentOperators, prevOpMap, true),
    plants: formatLeaderboard(currentPlants, prevPlantMap, false),
  };
}
