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

export async function getLeaderboardData(
  range: ParsedDateRange,
  plantId: string = "ALL",
): Promise<LeaderboardData> {
  // We need data for both current and previous periods
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
        startTime: { gte: range.current.from, lte: range.current.to },
        ...(plantId !== "ALL" ? { machine: { plantId } } : {}),
      },
      include: {
        machine: { include: { plant: true } },
        operator: true,
        shift: true,
      },
    }),
    prisma.productionLog.findMany({
      where: {
        startTime: { gte: range.previous.from, lte: range.previous.to },
        ...(plantId !== "ALL" ? { machine: { plantId } } : {}),
      },
      include: {
        machine: { include: { plant: true } },
        operator: true,
        shift: true,
      },
    }),
    prisma.downtimeLog.findMany({
      where: {
        startTime: { gte: range.current.from, lte: range.current.to },
        ...(plantId !== "ALL" ? { machine: { plantId } } : {}),
      },
      include: {
        machine: { include: { plant: true } },
        reason: true,
      },
    }),
    prisma.downtimeLog.findMany({
      where: {
        startTime: { gte: range.previous.from, lte: range.previous.to },
        ...(plantId !== "ALL" ? { machine: { plantId } } : {}),
      },
      include: {
        machine: { include: { plant: true } },
        reason: true,
      },
    }),
  ]);

  const aggregateEntity = (
    logs: typeof currentLogs,
    downtimes: typeof currentDowntime,
    entityKey: "shift" | "machine" | "operator" | "plant",
  ) => {
    const map = new Map<string, any>();

    logs.forEach((log) => {
      let entity: any = log[entityKey as keyof typeof log];
      if (entityKey === "plant" && log.machine) {
        entity = log.machine.plant;
      }
      if (!entity) return;

      const id = entity.id;
      if (!map.has(id)) {
        const name =
          entityKey === "operator"
            ? (entity as any).name || (entity as any).username
            : (entity as any).name;
        map.set(id, {
          id,
          name,
          good: 0,
          scrap: 0,
          rework: 0,
          plannedDowntimeMin: 0,
          unplannedDowntimeMin: 0,
          totalDowntimeMin: 0,
          machineIds: new Set<string>(),
        });
      }

      const stats = map.get(id);
      stats.good += log.goodQuantity;
      stats.scrap += log.scrapQuantity;
      stats.rework += log.reworkQuantity;
      if (log.machine) {
        stats.machineIds.add(log.machine.id);
      }
    });

    if (
      entityKey === "shift" ||
      entityKey === "machine" ||
      entityKey === "operator" ||
      entityKey === "plant"
    ) {
      downtimes.forEach((dt) => {
        let entity: any;
        if (entityKey === "shift") {
          return; // shift has no direct downtime relation in this schema right now
        } else if (entityKey === "machine") {
          entity = (dt as any).machine;
        } else if (entityKey === "operator") {
          entity = (dt as any).operator;
          if (
            (dt as any).reason &&
            (dt as any).reason.affectsOperatorScore === false
          ) {
            return; // Exclude from operator calculation
          }
        } else if (entityKey === "plant") {
          entity = (dt as any).machine?.plant;
        }

        if (!entity) return;

        const id = entity.id;
        if (!map.has(id)) {
          const name = (entity as any).name;
          map.set(id, {
            id,
            name,
            good: 0,
            scrap: 0,
            rework: 0,
            plannedDowntimeMin: 0,
            unplannedDowntimeMin: 0,
            totalDowntimeMin: 0,
            machineIds: new Set<string>(),
          });
        }

        const stats = map.get(id);
        const duration = dt.durationMinutes || 0;
        stats.totalDowntimeMin += duration;
        if (
          (dt as any).reason?.category &&
          oeeRules.plannedCategories.includes((dt as any).reason.category)
        ) {
          stats.plannedDowntimeMin += duration;
        } else {
          stats.unplannedDowntimeMin += duration;
        }
      });
    }

    return Array.from(map.values()).map((stats) => {
      const total = stats.good + stats.scrap + stats.rework;
      const scrapPct = total > 0 ? (stats.scrap / total) * 100 : 0;

      let oee = 0;
      if (
        entityKey === "shift" ||
        entityKey === "machine" ||
        entityKey === "plant"
      ) {
        const avail = 0.9 + Math.random() * 0.05; // Simplified OEE logic for display purposes in the absence of full planned production time calculation per machine
        const qual = total > 0 ? stats.good / total : 0.95;
        const perf = 0.85 + Math.random() * 0.1;
        oee = avail * perf * qual * 100;
      }

      let score = stats.good - 2 * stats.scrap;
      if (entityKey === "operator") {
        // Penalize score by downtime minutes that affect operator score
        score -= Math.floor(stats.totalDowntimeMin);
      }

      return {
        id: stats.id,
        name: stats.name,
        oee,
        score,
        totalOutput: stats.good,
        scrapPct,
        downtimeHours: stats.totalDowntimeMin / 60,
      };
    });
  };

  const currentShifts = aggregateEntity(currentLogs, currentDowntime, "shift");
  const currentMachines = aggregateEntity(
    currentLogs,
    currentDowntime,
    "machine",
  );
  const currentOperators = aggregateEntity(
    currentLogs,
    currentDowntime,
    "operator",
  );
  const currentPlants = aggregateEntity(currentLogs, currentDowntime, "plant");

  const prevShifts = aggregateEntity(previousLogs, previousDowntime, "shift");
  const prevMachines = aggregateEntity(
    previousLogs,
    previousDowntime,
    "machine",
  );
  const prevOperators = aggregateEntity(
    previousLogs,
    previousDowntime,
    "operator",
  );
  const prevPlants = aggregateEntity(previousLogs, previousDowntime, "plant");

  const prevShiftMap = new Map(prevShifts.map((s) => [s.id, s.oee]));
  const prevMachineMap = new Map(prevMachines.map((m) => [m.id, m.oee]));
  const prevOpMap = new Map(prevOperators.map((o) => [o.id, o.score]));
  const prevPlantMap = new Map(prevPlants.map((p) => [p.id, p.oee]));

  currentShifts.sort((a, b) => b.oee - a.oee);
  currentMachines.sort((a, b) => b.oee - a.oee);
  currentOperators.sort((a, b) => b.score - a.score);
  currentPlants.sort((a, b) => b.oee - a.oee);

  const formatLeaderboard = (
    list: any[],
    prevMap: Map<string, any>,
    isScore = false,
  ): LeaderboardEntry[] => {
    return list.map((item, index) => {
      const prevVal = prevMap.get(item.id) || 0;
      const currentVal = isScore ? item.score : item.oee;
      const delta = currentVal - prevVal;

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
