import { prisma } from "./prisma";
import { startOfDay, endOfDay, subDays } from "date-fns";

export async function getEnergyCostPerMachineHour(date: Date): Promise<number> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  // Get energy reading for the day
  const reading = await prisma.energyReading.findUnique({
    where: { date: dayStart },
  });

  if (!reading || reading.totalCost === 0) {
    // Fallback: Average over last 30 days
    return getAverageEnergyCostPerMachineHour();
  }

  // Get total machine run hours for the day
  const productionLogs = await prisma.productionLog.findMany({
    where: {
      startTime: { gte: dayStart, lte: dayEnd },
      endTime: { not: null },
    },
  });

  let totalRunHours = 0;
  for (const log of productionLogs) {
    if (log.startTime && log.endTime) {
      const diffMs = log.endTime.getTime() - log.startTime.getTime();
      totalRunHours += Math.max(0, diffMs / 3600000);
    }
  }

  if (totalRunHours === 0) {
    return getAverageEnergyCostPerMachineHour();
  }

  return reading.totalCost / totalRunHours;
}

export async function getAverageEnergyCostPerMachineHour(): Promise<number> {
  // Get last 30 days of readings and run hours
  const thirtyDaysAgo = subDays(startOfDay(new Date()), 30);

  const readings = await prisma.energyReading.findMany({
    where: { date: { gte: thirtyDaysAgo } },
  });

  const totalCost = readings.reduce((sum, r) => sum + r.totalCost, 0);

  const logs = await prisma.productionLog.findMany({
    where: {
      startTime: { gte: thirtyDaysAgo },
      endTime: { not: null },
    },
  });

  let totalRunHours = 0;
  for (const log of logs) {
    if (log.startTime && log.endTime) {
      const diffMs = log.endTime.getTime() - log.startTime.getTime();
      totalRunHours += Math.max(0, diffMs / 3600000);
    }
  }

  if (totalRunHours === 0) {
    // If still 0, fallback to a safe assumed default to avoid division by zero
    // E.g., assume 5 machines running 8 hours a day for 30 days
    const fallbackHours = 5 * 8 * 30;
    return totalCost / fallbackHours || 0; // return 0 if totalCost is 0
  }

  return totalCost / totalRunHours;
}
