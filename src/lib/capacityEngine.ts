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
  isWorkingDay: boolean;
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

// Helper to calculate working days in a window (defaults to Sunday as weekly off)
function getWorkingDaysList(
  start: Date,
  totalDays: number,
  offDays: number[] = [0], // 0 = Sunday
): { date: Date; key: string; isWork: boolean }[] {
  const list = [];
  const safeDays = Math.max(1, Math.min(90, totalDays));
  for (let i = 0; i < safeDays; i++) {
    const d = addDays(start, i);
    const isOffDay = offDays.includes(d.getDay());
    list.push({
      date: d,
      key: format(d, "yyyy-MM-dd"),
      isWork: !isOffDay,
    });
  }
  return list;
}

export async function getCapacityPlan(
  startDate: Date = new Date(),
  daysCount: number = 7,
): Promise<{
  machines: MachineCapacity[];
  totalOverloadedDays: number;
  mostLoadedMachine: string | null;
}> {
  const safeStart = startDate instanceof Date && !isNaN(startDate.getTime())
    ? startOfDay(startDate)
    : startOfDay(new Date());
  const validDaysCount = Math.max(1, Math.min(90, Math.round(Number(daysCount)) || 7));
  const today = startOfDay(new Date());

  // 1. Generate date keys and working days
  const planDays = getWorkingDaysList(safeStart, validDaysCount);

  // 2. Fetch settings, active machines and open WOs in parallel
  const [settings, machines, openWOs] = await Promise.all([
    getSettings(),
    prisma.machine.findMany({
      where: { isActive: true },
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

  // Standard 2-shift default (16h) or single shift (8h) from plant settings
  const defaultDailyHours = Number(settings.dailyAvailableHours) > 0
    ? Number(settings.dailyAvailableHours)
    : 16;
  const defaultSetupTimeMin = Number((settings as any).defaultSetupTimeMinutes) || 15;

  const capacityMap: Record<string, MachineCapacity> = {};

  // Initialize capacity map for active machines
  for (const m of machines) {
    capacityMap[m.id] = {
      machineId: m.id,
      machineName: m.name || "Machine",
      machineCode: m.code || m.name || "MC-01",
      days: {},
    };
    for (const d of planDays) {
      const availableHours = d.isWork ? defaultDailyHours : 0;
      capacityMap[m.id].days[d.key] = {
        date: d.key,
        loadedHours: 0,
        availableHours,
        loadPct: 0,
        isWorkingDay: d.isWork,
        contributingWOs: [],
      };
    }
  }

  // 3. Distribute Work Order loads
  for (const wo of openWOs) {
    const rawStart = wo.plannedStartDate ? startOfDay(wo.plannedStartDate) : today;
    let rawEnd = wo.plannedEndDate ? startOfDay(wo.plannedEndDate) : addDays(rawStart, 7);

    // Prevent inverted dates
    if (isBefore(rawEnd, rawStart)) {
      rawEnd = addDays(rawStart, 1);
    }

    // For active/delayed work orders, load remaining capacity from today forward
    const effectiveStart = isBefore(rawStart, today) ? today : rawStart;
    const totalCalendarDays = Math.max(1, differenceInDays(rawEnd, effectiveStart) + 1);

    // Compute working days in WO spread
    const woDaysList = getWorkingDaysList(effectiveStart, totalCalendarDays);
    const woWorkingDays = woDaysList.filter((d) => d.isWork);
    const effectiveSpreadWorkingDays = Math.max(1, woWorkingDays.length);

    const routingSteps = Array.isArray(wo?.product?.routingSteps) ? wo.product.routingSteps : [];
    if (routingSteps.length === 0) continue;

    const plannedQty = Math.max(1, Number(wo.plannedQuantity) || 1);
    const targetCycleTimeSeconds = Number(wo.product?.targetCycleTimeSeconds) || 60;

    for (const step of routingSteps) {
      if (!step.machineId) continue;

      const machineCapacity = capacityMap[step.machineId];
      if (!machineCapacity) continue;

      const setupTimeMin = step.setupTimeMin !== null && step.setupTimeMin !== undefined
        ? Number(step.setupTimeMin)
        : defaultSetupTimeMin;

      const totalMachineHours = (setupTimeMin / 60) + (plannedQty * targetCycleTimeSeconds) / 3600;
      const hoursPerWorkingDay = totalMachineHours / effectiveSpreadWorkingDays;

      for (const d of woWorkingDays) {
        const cell = machineCapacity.days[d.key];
        if (cell && cell.isWorkingDay) {
          cell.loadedHours += hoursPerWorkingDay;
          cell.contributingWOs.push({
            woNumber: wo.woNumber || "WO-N/A",
            operation: step.operation?.name || "Machining Operation",
            quantity: plannedQty,
            hours: Math.round(hoursPerWorkingDay * 100) / 100,
          });
        }
      }
    }
  }

  // 4. Calculate Load Percentage and Overloads
  let totalOverloadedDays = 0;
  const loadSums: Record<string, { sum: number; count: number }> = {};

  for (const mId in capacityMap) {
    const mc = capacityMap[mId];
    let mSum = 0;
    let mCount = 0;

    for (const dk in mc.days) {
      const cell = mc.days[dk];
      if (cell.availableHours > 0) {
        cell.loadPct = Math.round((cell.loadedHours / cell.availableHours) * 100);
        if (cell.loadPct > 100) {
          totalOverloadedDays++;
        }
        mSum += cell.loadPct;
        mCount++;
      } else {
        cell.loadPct = cell.loadedHours > 0 ? 100 : 0;
      }
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
