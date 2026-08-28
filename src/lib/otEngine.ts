import { prisma } from "./prisma";
import { getSettings } from "./settings";

export interface OtDayRow {
  date: string;
  shiftName: string;
  clockIn: Date;
  clockOut: Date;
  workedHours: number;
  otHours: number;
}

export interface OtOperatorSummary {
  operatorId: string;
  operatorName: string;
  presentDays: number;
  totalWorkedHours: number;
  totalOtHours: number;
  estimatedOtPay: number;
  aboveStatutoryLimit: boolean;
}

/** Statutory monthly OT limit in hours */
const OT_STATUTORY_LIMIT = 50;

/**
 * Compute per-day OT rows for one operator in a given month.
 * Only includes days where the operator has a clockOut recorded.
 */
export async function computeOperatorOtDetail(
  operatorId: string,
  year: number,
  month: number,
): Promise<{
  rows: OtDayRow[];
  threshold: number;
  multiplier: number;
  laborRate: number;
}> {
  const settings = await getSettings();
  const threshold = settings.otDailyThresholdHours;
  const multiplier = settings.otMultiplier;
  const laborRate = settings.laborRatePerHour;

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const logs = await prisma.attendanceLog.findMany({
    where: {
      userId: operatorId,
      clockIn: { gte: startDate, lte: endDate },
      clockOut: { not: null },
    },
    include: { shift: true },
    orderBy: { clockIn: "asc" },
  });

  const rows: OtDayRow[] = logs.map((log) => {
    const clockIn = new Date(log.clockIn);
    const clockOut = new Date(log.clockOut!);
    const diffMs = clockOut.getTime() - clockIn.getTime();
    const workedHours = Number(Math.max(0, diffMs / 3_600_000).toFixed(2));
    const otHours = Number(Math.max(0, workedHours - threshold).toFixed(2));

    return {
      date: clockIn.toISOString().slice(0, 10),
      shiftName: log.shift?.name || "Shift",
      clockIn,
      clockOut,
      workedHours,
      otHours,
    };
  });

  return { rows, threshold, multiplier, laborRate };
}

/**
 * Compute OT summary for ALL operators in a given month.
 * Returns one summary row per operator.
 */
export async function computeMonthlyOtSummary(
  year: number,
  month: number,
): Promise<{
  summaries: OtOperatorSummary[];
  threshold: number;
  multiplier: number;
  laborRate: number;
}> {
  const settings = await getSettings();
  const threshold = settings.otDailyThresholdHours;
  const multiplier = settings.otMultiplier;
  const laborRate = settings.laborRatePerHour;

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const operators = await prisma.user.findMany({
    where: { role: { name: "Operator" } },
    orderBy: { name: "asc" },
  });

  const logs = await prisma.attendanceLog.findMany({
    where: {
      clockIn: { gte: startDate, lte: endDate },
      clockOut: { not: null },
      user: { role: { name: "Operator" } },
    },
    include: { user: true },
  });

  const summaries: OtOperatorSummary[] = operators.map((op) => {
    const opLogs = logs.filter((l) => l.userId === op.id);
    let totalWorkedHours = 0;
    let totalOtHours = 0;

    for (const log of opLogs) {
      const diffMs =
        new Date(log.clockOut!).getTime() - new Date(log.clockIn).getTime();
      const workedHours = Number(Math.max(0, diffMs / 3_600_000).toFixed(2));
      const otHours = Number(Math.max(0, workedHours - threshold).toFixed(2));
      totalWorkedHours += workedHours;
      totalOtHours += otHours;
    }

    totalWorkedHours = Number(totalWorkedHours.toFixed(2));
    totalOtHours = Number(totalOtHours.toFixed(2));

    return {
      operatorId: op.id,
      operatorName: op.name,
      presentDays: opLogs.length,
      totalWorkedHours,
      totalOtHours,
      estimatedOtPay: Number(
        (totalOtHours * laborRate * multiplier).toFixed(2),
      ),
      aboveStatutoryLimit: totalOtHours > OT_STATUTORY_LIMIT,
    };
  });

  return { summaries, threshold, multiplier, laborRate };
}
