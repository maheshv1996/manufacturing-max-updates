import { prisma } from "./prisma";
import { getSettings } from "./settings";

export interface OtDayRow {
  date: string;
  shiftName: string;
  clockIn: Date;
  clockOut: Date;
  workedHours: number;
  otHours: number;
  estimatedOtPay: number;
}

export interface OtOperatorSummary {
  operatorId: string;
  operatorName: string;
  presentDays: number;
  totalWorkedHours: number;
  totalOtHours: number;
  estimatedOtPay: number;
  aboveStatutoryLimit: boolean;
  statutoryLimitHours: number;
}

const round2 = (val: number): number => {
  if (!Number.isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
};

const safeNonNegative = (val: any, fallback = 0): number => {
  const num = Number(val);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
};

// Helper to compute UTC month start and end dates safely
function getMonthDateRange(year: number, month: number) {
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { startDate, endDate };
}

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
  statutoryLimit: number;
}> {
  const settings = await getSettings();
  const threshold = safeNonNegative(settings.otDailyThresholdHours, 8.0);
  const multiplier = safeNonNegative(settings.otMultiplier, 1.5);
  const laborRate = safeNonNegative(settings.laborRatePerHour, 150.0);
  const statutoryLimit = safeNonNegative((settings as any).otMonthlyStatutoryLimitHours, 50.0);

  const { startDate, endDate } = getMonthDateRange(year, month);

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
    
    // Fix 2: Cap single shift duration at 24 hours max
    const rawHours = Math.max(0, diffMs / 3_600_000);
    const workedHours = round2(Math.min(24.0, rawHours));
    const otHours = round2(Math.max(0, workedHours - threshold));
    const estimatedOtPay = round2(otHours * laborRate * multiplier);

    return {
      date: clockIn.toISOString().slice(0, 10),
      shiftName: log.shift?.name || "Standard Shift",
      clockIn,
      clockOut,
      workedHours,
      otHours,
      estimatedOtPay,
    };
  });

  return { rows, threshold, multiplier, laborRate, statutoryLimit };
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
  statutoryLimit: number;
}> {
  const settings = await getSettings();
  const threshold = safeNonNegative(settings.otDailyThresholdHours, 8.0);
  const multiplier = safeNonNegative(settings.otMultiplier, 1.5);
  const laborRate = safeNonNegative(settings.laborRatePerHour, 150.0);
  const statutoryLimit = safeNonNegative((settings as any).otMonthlyStatutoryLimitHours, 50.0);

  const { startDate, endDate } = getMonthDateRange(year, month);

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

    // Fix 1: Compute unique calendar days present
    const uniqueDaysPresent = new Set<string>();

    for (const log of opLogs) {
      const clockIn = new Date(log.clockIn);
      uniqueDaysPresent.add(clockIn.toISOString().slice(0, 10));

      const diffMs = new Date(log.clockOut!).getTime() - clockIn.getTime();
      const rawHours = Math.max(0, diffMs / 3_600_000);
      const workedHours = round2(Math.min(24.0, rawHours));
      const otHours = round2(Math.max(0, workedHours - threshold));

      totalWorkedHours += workedHours;
      totalOtHours += otHours;
    }

    totalWorkedHours = round2(totalWorkedHours);
    totalOtHours = round2(totalOtHours);
    const estimatedOtPay = round2(totalOtHours * laborRate * multiplier);

    return {
      operatorId: op.id,
      operatorName: op.name,
      presentDays: uniqueDaysPresent.size,
      totalWorkedHours,
      totalOtHours,
      estimatedOtPay,
      aboveStatutoryLimit: totalOtHours > statutoryLimit,
      statutoryLimitHours: statutoryLimit,
    };
  });

  return { summaries, threshold, multiplier, laborRate, statutoryLimit };
}
