import { prisma } from "./prisma";
import { startOfDay, endOfDay, subDays } from "date-fns";

const DEFAULT_ENERGY_COST_PER_MACHINE_HOUR = 45.0; // ₹45/hr baseline fallback

/**
 * Pure helper to compute total machine run hours from production logs within a date window.
 * Supports optional machine-level filtering.
 */
export async function getTotalRunHours(
  startDate: Date,
  endDate: Date,
  machineId?: string,
): Promise<number> {
  const whereClause: any = {
    startTime: { gte: startDate, lte: endDate },
    endTime: { not: null },
  };

  if (machineId) {
    whereClause.machineId = machineId;
  }

  const logs = await prisma.productionLog.findMany({
    where: whereClause,
    select: { startTime: true, endTime: true },
  });

  let totalRunHours = 0;
  for (const log of logs) {
    if (log.startTime && log.endTime) {
      const startMs = new Date(log.startTime).getTime();
      const endMs = new Date(log.endTime).getTime();
      const diffMs = endMs - startMs;
      if (Number.isFinite(diffMs) && diffMs > 0) {
        totalRunHours += diffMs / 3600000;
      }
    }
  }

  return Number.isFinite(totalRunHours) ? totalRunHours : 0;
}

/**
 * Calculates energy cost per machine hour for a specific day and optional machine.
 * Uses the latest available reading within the date range, falling back to 30-day average.
 */
export async function getEnergyCostPerMachineHour(
  date: Date,
  machineId?: string,
): Promise<number> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  // Fix 3: Find the closest energy reading for the day (not strictly exact match)
  const reading = await prisma.energyReading.findFirst({
    where: {
      date: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { date: "desc" },
  });

  if (!reading || !Number.isFinite(reading.totalCost) || reading.totalCost <= 0) {
    return getAverageEnergyCostPerMachineHour(30, machineId);
  }

  // Fix 1 & 5: Calculate run hours using the shared helper with machine filtering
  const totalRunHours = await getTotalRunHours(dayStart, dayEnd, machineId);

  if (totalRunHours <= 0) {
    return getAverageEnergyCostPerMachineHour(30, machineId);
  }

  const costPerHour = reading.totalCost / totalRunHours;
  return Number.isFinite(costPerHour) && costPerHour > 0
    ? Math.round((costPerHour + Number.EPSILON) * 100) / 100
    : getAverageEnergyCostPerMachineHour(30, machineId);
}

/**
 * Calculates the average energy cost per machine hour across a configurable historical window (default 30 days).
 */
export async function getAverageEnergyCostPerMachineHour(
  windowDays = 30,
  machineId?: string,
): Promise<number> {
  const now = new Date();
  const windowStart = subDays(startOfDay(now), Math.max(1, windowDays));
  const windowEnd = endOfDay(now);

  const readings = await prisma.energyReading.findMany({
    where: { date: { gte: windowStart, lte: windowEnd } },
  });

  const totalCost = readings.reduce(
    (sum, r) => sum + (Number.isFinite(r.totalCost) && r.totalCost > 0 ? r.totalCost : 0),
    0,
  );

  // Fix 2: If no readings exist in database, return safe standard energy setting default
  if (totalCost <= 0) {
    return DEFAULT_ENERGY_COST_PER_MACHINE_HOUR;
  }

  const totalRunHours = await getTotalRunHours(windowStart, windowEnd, machineId);

  if (totalRunHours <= 0) {
    // If no production logs exist, assume standard 5 active machines x 8 hours/day
    const fallbackHours = 5 * 8 * windowDays;
    const rate = totalCost / fallbackHours;
    return Number.isFinite(rate) && rate > 0
      ? Math.round((rate + Number.EPSILON) * 100) / 100
      : DEFAULT_ENERGY_COST_PER_MACHINE_HOUR;
  }

  const avgCostPerHour = totalCost / totalRunHours;
  return Number.isFinite(avgCostPerHour) && avgCostPerHour > 0
    ? Math.round((avgCostPerHour + Number.EPSILON) * 100) / 100
    : DEFAULT_ENERGY_COST_PER_MACHINE_HOUR;
}
