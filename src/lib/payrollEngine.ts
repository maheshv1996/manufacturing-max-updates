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

/**
 * Calculate monthly payroll metrics for all operators.
 */
export async function computeMonthlyPayroll(
  year: number,
  month: number,
  plantId: string = "ALL",
): Promise<MonthlyPayrollSummary> {
  const settings = await getSettings();
  const threshold = settings.otDailyThresholdHours;
  const multiplier = settings.otMultiplier;
  const laborRate = settings.laborRatePerHour;
  const statutoryLimit = settings.otStatutoryLimitHours;

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const operators = await prisma.user.findMany({
    where: {
      role: { name: "Operator" },
      ...(plantId !== "ALL" ? { homePlantId: plantId } : {}),
    },
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

  const rows: PayrollRow[] = operators.map((op) => {
    const opLogs = logs.filter((l) => l.userId === op.id);
    const presentDays = opLogs.length;
    const lateDays = opLogs.filter((l) => l.status === "LATE").length;

    let workedHours = 0;
    let otHours = 0;
    let regularHours = 0;

    for (const log of opLogs) {
      const diffMs =
        new Date(log.clockOut!).getTime() - new Date(log.clockIn).getTime();
      const logWorked = Number(Math.max(0, diffMs / 3_600_000).toFixed(2));
      const logOt = Number(Math.max(0, logWorked - threshold).toFixed(2));
      const logReg = Number(Math.min(logWorked, threshold).toFixed(2));

      workedHours += logWorked;
      otHours += logOt;
      regularHours += logReg;
    }

    workedHours = Number(workedHours.toFixed(2));
    otHours = Number(otHours.toFixed(2));
    regularHours = Number(regularHours.toFixed(2));

    const regularPay = Number((regularHours * laborRate).toFixed(2));
    const otPay = Number((otHours * laborRate * multiplier).toFixed(2));
    const grossPay = Number((regularPay + otPay).toFixed(2));
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

  totals.workedHours = Number(totals.workedHours.toFixed(2));
  totals.otHours = Number(totals.otHours.toFixed(2));
  totals.regularHours = Number(totals.regularHours.toFixed(2));
  totals.regularPay = Number(totals.regularPay.toFixed(2));
  totals.otPay = Number(totals.otPay.toFixed(2));
  totals.grossPay = Number(totals.grossPay.toFixed(2));

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
