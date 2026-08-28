import { prisma } from "./prisma";
import { getSettings } from "./settings";
import {
  addDays,
  startOfDay,
  differenceInDays,
  isBefore,
  format,
} from "date-fns";

export interface CapacityPlanCell {
  date: string;
  loadedHours: number;
  availableHours: number;
  loadPct: number;
  contributingWOs: {
    woNumber: string;
    operation: string;
    quantity: number;
    hours: number;
  }[];
}

export interface MachineCapacity {
  machineId: string;
  machineName: string;
  machineCode: string;
  days: Record<string, CapacityPlanCell>;
}

export async function getCapacityPlan(
  startDate: Date,
  daysCount: number = 7,
): Promise<{
  machines: MachineCapacity[];
  totalOverloadedDays: number;
  mostLoadedMachine: string | null;
}> {
  const today = startOfDay(new Date());

  // Generate date keys
  const dateKeys: string[] = [];
  for (let i = 0; i < daysCount; i++) {
    dateKeys.push(format(addDays(startDate, i), "yyyy-MM-dd"));
  }

  // Fetch settings, machines and open WOs in parallel
  const [settings, machines, openWOs] = await Promise.all([
    getSettings(),
    prisma.machine.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.workOrder.findMany({
      where: {
        status: { in: ["PLANNED", "IN_PROGRESS"] },
      },
      include: {
        product: {
          include: {
            routingSteps: {
              include: { operation: true },
            },
          },
        },
      },
      orderBy: { plannedStartDate: "asc" },
    }),
  ]);
  const { dailyAvailableHours } = settings;

  const capacityMap: Record<string, MachineCapacity> = {};

  for (const m of machines) {
    capacityMap[m.id] = {
      machineId: m.id,
      machineName: m.name,
      machineCode: m.code,
      days: {},
    };
    for (const dk of dateKeys) {
      capacityMap[m.id].days[dk] = {
        date: dk,
        loadedHours: 0,
        availableHours: dailyAvailableHours,
        loadPct: 0,
        contributingWOs: [],
      };
    }
  }

  for (const wo of openWOs) {
    const plannedStart = startOfDay(wo.plannedStartDate);
    const plannedEnd = wo.plannedEndDate
      ? startOfDay(wo.plannedEndDate)
      : addDays(today, 7);

    // Spread days = from max(today, plannedStart) to plannedEnd
    const effectiveStart = isBefore(plannedStart, today) ? today : plannedStart;

    let spreadDays = differenceInDays(plannedEnd, effectiveStart) + 1;
    if (spreadDays <= 0) spreadDays = 1; // Minimum 1 day

    for (const step of wo.product.routingSteps) {
      if (!step.machineId) continue;

      const machineCapacity = capacityMap[step.machineId];
      if (!machineCapacity) continue;

      const targetCycleTimeSeconds = wo.product.targetCycleTimeSeconds || 60;
      const setupTimeMin = step.setupTimeMin || 15;

      // machineHours = setupTimeMinutes/60 + plannedQuantity * targetCycleTimeSeconds/3600
      const totalMachineHours =
        setupTimeMin / 60 +
        (wo.plannedQuantity * targetCycleTimeSeconds) / 3600;
      const hoursPerDay = totalMachineHours / spreadDays;

      // Add to each day in the spread window
      for (let i = 0; i < spreadDays; i++) {
        const currentDate = addDays(effectiveStart, i);
        const dk = format(currentDate, "yyyy-MM-dd");

        // Only add if the date is within our requested capacity plan window
        if (machineCapacity.days[dk]) {
          const cell = machineCapacity.days[dk];
          cell.loadedHours += hoursPerDay;
          cell.contributingWOs.push({
            woNumber: wo.woNumber,
            operation: step.operation.name,
            quantity: wo.plannedQuantity,
            hours: hoursPerDay,
          });
        }
      }
    }
  }

  let totalOverloadedDays = 0;
  const loadSums: Record<string, { sum: number; count: number }> = {};

  for (const mId in capacityMap) {
    const mc = capacityMap[mId];
    let mSum = 0;
    let mCount = 0;

    for (const dk in mc.days) {
      const cell = mc.days[dk];
      cell.loadPct = (cell.loadedHours / cell.availableHours) * 100;

      if (cell.loadPct > 100) {
        totalOverloadedDays++;
      }

      mSum += cell.loadPct;
      mCount++;
    }

    if (mCount > 0) {
      loadSums[mId] = { sum: mSum, count: mCount };
    }
  }

  let mostLoadedMachine: string | null = null;
  let maxAvgLoad = -1;

  for (const mId in loadSums) {
    const avg = loadSums[mId].sum / loadSums[mId].count;
    if (avg > maxAvgLoad) {
      maxAvgLoad = avg;
      const machineInfo = machines.find((m) => m.id === mId);
      mostLoadedMachine = machineInfo
        ? `${machineInfo.name} (${Math.round(avg)}%)`
        : null;
    }
  }

  return {
    machines: Object.values(capacityMap),
    totalOverloadedDays,
    mostLoadedMachine,
  };
}
