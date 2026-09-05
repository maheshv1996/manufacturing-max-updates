import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computePayrollRow,
  computeMonthlyPayroll,
  applyStatutoryDeductions,
} from "../src/lib/people/payroll";
import { isOk } from "../src/lib/core/result";

const settings = {
  otDailyThresholdHours: 8,
  otMultiplier: 2,
  laborRatePerHour: 150,
  pfPercent: 12,
  esiThreshold: 21000,
  professionalTax: 200,
};

test("computePayrollRow: basic salary only", () => {
  const r = computePayrollRow(
    {
      employeeCode: "E1",
      employeeName: "Alice",
      basicPay: 30000,
      hra: 0,
      specialAllowance: 0,
      conveyance: 0,
      otherAllowance: 0,
      pfPercent: 12,
      professionalTax: 200,
    },
    {
      presentDays: 30,
      lateDays: 0,
      workedHours: 160,
      otHours: 0,
      regularHours: 160,
    },
    settings,
  );
  assert.equal(isOk(r), true);
  if (isOk(r)) {
    assert.equal(r.value.regularPay, 30000);
    assert.equal(r.value.otPay, 0);
    assert.equal(r.value.grossPay, 30000);
    assert.equal(r.value.pfDeduction, 3600);
    assert.equal(r.value.esiDeduction, 0);
    assert.equal(r.value.ptDeduction, 200);
    assert.equal(r.value.netPay, 30000 - 3600 - 0 - 200);
  }
});

test("computePayrollRow: OT above threshold", () => {
  const r = computePayrollRow(
    {
      employeeCode: "E1",
      employeeName: "Alice",
      basicPay: 30000,
      hra: 0,
      specialAllowance: 0,
      conveyance: 0,
      otherAllowance: 0,
      pfPercent: 12,
      professionalTax: 200,
    },
    {
      presentDays: 30,
      lateDays: 0,
      workedHours: 168,
      otHours: 8,
      regularHours: 160,
    },
    settings,
  );
  assert.equal(isOk(r), true);
  if (isOk(r)) {
    assert.equal(r.value.otPay, 8 * 150 * 2);
    assert.equal(r.value.grossPay, 30000 + 8 * 150 * 2);
  }
});

test("computeMonthlyPayroll: aggregate summary", () => {
  const employees = [
    {
      employeeCode: "E1",
      employeeName: "Alice",
      basicPay: 30000,
      hra: 0,
      specialAllowance: 0,
      conveyance: 0,
      otherAllowance: 0,
      pfPercent: 12,
      professionalTax: 200,
    },
    {
      employeeCode: "E2",
      employeeName: "Bob",
      basicPay: 25000,
      hra: 0,
      specialAllowance: 0,
      conveyance: 0,
      otherAllowance: 0,
      pfPercent: 12,
      professionalTax: 200,
    },
  ];
  const attendanceMap = new Map([
    ["E1", { presentDays: 30, lateDays: 0, workedHours: 160, otHours: 0, regularHours: 160 }],
    ["E2", { presentDays: 30, lateDays: 0, workedHours: 160, otHours: 0, regularHours: 160 }],
  ]);
  const r = computeMonthlyPayroll(employees, attendanceMap, settings, 2026, 9);
  assert.equal(isOk(r), true);
  if (isOk(r)) {
    assert.equal(r.value.rows.length, 2);
    assert.equal(r.value.totals.grossPay, 55000);
    assert.equal(r.value.totals.netPay, 55000 - 3600 - 200 - 3000 - 200);
  }
});

test("computePayrollRow: LOP days and deduction", () => {
  const r = computePayrollRow(
    {
      employeeCode: "E1",
      employeeName: "Alice",
      basicPay: 30000,
      hra: 0,
      specialAllowance: 0,
      conveyance: 0,
      otherAllowance: 0,
      pfPercent: 12,
      professionalTax: 200,
    },
    {
      presentDays: 26,
      lateDays: 2,
      workedHours: 160,
      otHours: 0,
      regularHours: 160,
    },
    settings,
  );
  assert.equal(isOk(r), true);
  if (isOk(r)) {
    // 30 − 26 − 2 = 2 LOP days; deduction = 30000/30 × 2
    assert.equal(r.value.lopDays, 2);
    assert.equal(r.value.lopDeduction, 2000);
    assert.equal(r.value.netPay, 30000 - 3600 - 200 - 2000);
  }
});

test("applyStatutoryDeductions: ESI applies below threshold", () => {
  const r = applyStatutoryDeductions(20000, settings);
  assert.equal(isOk(r), true);
  if (isOk(r)) {
    assert.equal(r.value.esi, 350);
  }
});

test("applyStatutoryDeductions: ESI blocked above threshold", () => {
  const r = applyStatutoryDeductions(25000, settings);
  assert.equal(isOk(r), true);
  if (isOk(r)) {
    assert.equal(r.value.esi, 0);
  }
});
