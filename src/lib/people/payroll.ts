import { ok, type Result } from "../core/result";

export interface SalaryStructureInput {
  employeeCode: string;
  employeeName: string;
  basicPay: number;
  hra: number;
  specialAllowance: number;
  conveyance: number;
  otherAllowance: number;
  pfPercent: number;
  professionalTax: number;
}

export interface AttendanceInput {
  presentDays: number;
  lateDays: number;
  workedHours: number;
  otHours: number;
  regularHours: number;
}

export interface PayrollSettings {
  otDailyThresholdHours: number;
  otMultiplier: number;
  laborRatePerHour: number;
  pfPercent: number;
  esiThreshold: number;
  professionalTax: number;
}

export interface PayrollRow {
  employeeCode: string;
  employeeName: string;
  presentDays: number;
  lateDays: number;
  workedHours: number;
  otHours: number;
  regularHours: number;
  regularPay: number;
  otPay: number;
  grossPay: number;
  pfDeduction: number;
  esiDeduction: number;
  ptDeduction: number;
  lopDays: number;
  lopDeduction: number;
  netPay: number;
}

export interface MonthlyPayrollSummary {
  year: number;
  month: number;
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
    pfDeduction: number;
    esiDeduction: number;
    ptDeduction: number;
    lopDeduction: number;
    netPay: number;
  };
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function applyStatutoryDeductions(grossPay: number, settings: PayrollSettings): Result<{ pf: number; esi: number; pt: number }, string> {
  const pf = round2((grossPay * settings.pfPercent) / 100);
  const esi = grossPay <= settings.esiThreshold ? round2((grossPay * 1.75) / 100) : 0;
  const pt = settings.professionalTax;
  return ok({ pf, esi, pt });
}

export function computePayrollRow(
  employee: SalaryStructureInput,
  attendance: AttendanceInput,
  settings: PayrollSettings,
): Result<PayrollRow, string> {
  const monthlyBasic = round2(employee.basicPay);
  const monthlyHra = round2(employee.hra);
  const monthlySpecial = round2(employee.specialAllowance);
  const monthlyConveyance = round2(employee.conveyance);
  const monthlyOther = round2(employee.otherAllowance);

  const grossBeforeDeductions = round2(
    monthlyBasic + monthlyHra + monthlySpecial + monthlyConveyance + monthlyOther,
  );

  const regularPay = grossBeforeDeductions;
  const otPay = round2(attendance.otHours * settings.laborRatePerHour * settings.otMultiplier);
  const grossPay = round2(regularPay + otPay);

  const statutory = applyStatutoryDeductions(grossPay, settings);
  if (statutory.tag === "err") return statutory;

  const { pf, esi, pt } = statutory.value;

  const lopDays = Math.max(0, round2(30 - attendance.presentDays - attendance.lateDays));
  const lopDeduction = round2((grossPay / 30) * lopDays);
  const totalDeductions = round2(pf + esi + pt + lopDeduction);
  const netPay = round2(grossPay - totalDeductions);

  const row: PayrollRow = {
    employeeCode: employee.employeeCode,
    employeeName: employee.employeeName,
    presentDays: attendance.presentDays,
    lateDays: attendance.lateDays,
    workedHours: attendance.workedHours,
    otHours: attendance.otHours,
    regularHours: attendance.regularHours,
    regularPay,
    otPay,
    grossPay,
    pfDeduction: pf,
    esiDeduction: esi,
    ptDeduction: pt,
    lopDays,
    lopDeduction,
    netPay,
  };

  return ok(row);
}

export function computeMonthlyPayroll(
  employees: SalaryStructureInput[],
  attendanceMap: Map<string, AttendanceInput>,
  settings: PayrollSettings,
  year: number,
  month: number,
): Result<MonthlyPayrollSummary, string> {
  const rows: PayrollRow[] = [];
  const totals = {
    presentDays: 0,
    lateDays: 0,
    workedHours: 0,
    otHours: 0,
    regularHours: 0,
    regularPay: 0,
    otPay: 0,
    grossPay: 0,
    pfDeduction: 0,
    esiDeduction: 0,
    ptDeduction: 0,
    lopDays: 0,
    lopDeduction: 0,
    netPay: 0,
  };

  for (const emp of employees) {
    const attendance = attendanceMap.get(emp.employeeCode) ?? {
      presentDays: 0,
      lateDays: 0,
      workedHours: 0,
      otHours: 0,
      regularHours: 0,
    };
    const r = computePayrollRow(emp, attendance, settings);
    if (r.tag === "err") return r;
    rows.push(r.value);
    totals.presentDays += r.value.presentDays;
    totals.lateDays += r.value.lateDays;
    totals.workedHours += r.value.workedHours;
    totals.otHours += r.value.otHours;
    totals.regularHours += r.value.regularHours;
    totals.regularPay += r.value.regularPay;
    totals.otPay += r.value.otPay;
    totals.grossPay += r.value.grossPay;
    totals.pfDeduction += r.value.pfDeduction;
    totals.esiDeduction += r.value.esiDeduction;
    totals.ptDeduction += r.value.ptDeduction;
    totals.lopDays += r.value.lopDays;
    totals.lopDeduction += r.value.lopDeduction;
    totals.netPay += r.value.netPay;
  }

  return ok({ year, month, rows, totals });
}
