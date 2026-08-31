import { prisma } from "./prisma";
import { getSettings } from "./settings";

export interface PayrollRow {
  operatorId: string;
  operatorName: string;
  presentDays: number;
  lateDays: number;
  workedHours: number;
  otHours: number;
  regularHours: number;
  regularPay: number;
  otPay: number;
  grossPay: number;
  aboveStatutoryLimit: boolean;
}

export interface MonthlyPayrollSummary {
  year: number;
  month: number;
  threshold: number;
  multiplier: number;
  laborRate: number;
  statutoryLimit: number;
  rows: PayrollRow[];
  totals: {
    presentDays: number;
    lateDays: number;
    workedHours: number;
    otHours: number;
    regularHours: number;
    regularPay: number;
    otPay: number;
    grossPay: number;
  };
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Calculate monthly payroll metrics for all operators.
 */
export async function computeMonthlyPayroll(
  year: number,
  month: number,
  plantId: string = "ALL",
): Promise<MonthlyPayrollSummary> {
  const settings = await getSettings();
  const threshold = Math.max(0, Number(settings.otDailyThresholdHours) || 8);
  const multiplier = Math.max(1, Number(settings.otMultiplier) || 2.0);
  const laborRate = Math.max(0, Number(settings.laborRatePerHour) || 150);
  const statutoryLimit = Math.max(0, Number(settings.otStatutoryLimitHours) || 50);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const operators = await prisma.user.findMany({
    where: {
      OR: [
        { role: { name: { equals: "Operator", mode: "insensitive" } } },
        { level: "WORKER" },
      ],
      ...(plantId !== "ALL" ? { homePlantId: plantId } : {}),
    },
    orderBy: { name: "asc" },
  });

  const operatorIds = operators.map((o) => o.id);

  const logs = await prisma.attendanceLog.findMany({
    where: {
      clockIn: { gte: startDate, lte: endDate },
      clockOut: { not: null },
      userId: { in: operatorIds },
    },
    include: { user: true },
  });

  const rows: PayrollRow[] = operators.map((op) => {
    const opLogs = logs.filter((l) => l.userId === op.id);

    // Count distinct calendar days present
    const distinctDays = new Set(
      opLogs
        .map((l) => {
          const d = l.clockIn instanceof Date ? l.clockIn : new Date(l.clockIn);
          return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
        })
        .filter(Boolean),
    );
    const presentDays = distinctDays.size;
    const lateDays = opLogs.filter((l) => String(l.status).toUpperCase() === "LATE").length;

    let workedHours = 0;
    let otHours = 0;
    let regularHours = 0;

    for (const log of opLogs) {
      if (!log.clockIn || !log.clockOut) continue;
      const cin = new Date(log.clockIn).getTime();
      const cout = new Date(log.clockOut).getTime();
      if (isNaN(cin) || isNaN(cout)) continue;

      const diffMs = Math.max(0, cout - cin);
      const logWorked = round2(diffMs / 3_600_000);
      const logOt = round2(Math.max(0, logWorked - threshold));
      const logReg = round2(Math.min(logWorked, threshold));

      workedHours += logWorked;
      otHours += logOt;
      regularHours += logReg;
    }

    workedHours = round2(workedHours);
    otHours = round2(otHours);
    regularHours = round2(regularHours);

    const regularPay = round2(regularHours * laborRate);
    const otPay = round2(otHours * laborRate * multiplier);
    const grossPay = round2(regularPay + otPay);
    const aboveStatutoryLimit = otHours > statutoryLimit;

    return {
      operatorId: op.id,
      operatorName: op.name,
      presentDays,
      lateDays,
      workedHours,
      otHours,
      regularHours,
      regularPay,
      otPay,
      grossPay,
      aboveStatutoryLimit,
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.presentDays += r.presentDays;
      acc.lateDays += r.lateDays;
      acc.workedHours += r.workedHours;
      acc.otHours += r.otHours;
      acc.regularHours += r.regularHours;
      acc.regularPay += r.regularPay;
      acc.otPay += r.otPay;
      acc.grossPay += r.grossPay;
      return acc;
    },
    {
      presentDays: 0,
      lateDays: 0,
      workedHours: 0,
      otHours: 0,
      regularHours: 0,
      regularPay: 0,
      otPay: 0,
      grossPay: 0,
    },
  );

  totals.workedHours = round2(totals.workedHours);
  totals.otHours = round2(totals.otHours);
  totals.regularHours = round2(totals.regularHours);
  totals.regularPay = round2(totals.regularPay);
  totals.otPay = round2(totals.otPay);
  totals.grossPay = round2(totals.grossPay);

  return {
    year,
    month,
    threshold,
    multiplier,
    laborRate,
    statutoryLimit,
    rows,
    totals,
  };
}
