#!/usr/bin/env node
/**
 * C7-6 — Real-DB smoke test for the people & payroll core (C7).
 * Drives the full lifecycle through the typed adapters against mfgmax_v2_test:
 *   employee → user link → attendance clocking → attendance stats →
 *   leave request → approve / illegal-transition guards → payroll run →
 *   payslip integrity (LOP) → payroll-run guard → audit rows.
 *
 * Usage:
 *   node scripts/v2-smoke-people.mjs   (DATABASE_URL defaults to mfgmax_v2_test)
 */

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:1996@localhost:5432/mfgmax_v2_test";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createEmployee, computeAttendanceStats, approveLeave, rejectLeave, cancelLeave, runPayrollForMonth } from "../src/lib/people/peopleTx.ts";
import { transitionLeave } from "../src/lib/people/leaves.ts";
import { isOk, isErr } from "../src/lib/core/result.ts";
import { isSessionExpired, needsRotation, rotateSession, refreshSession } from "../src/lib/sessionRotation.ts";
import { verifySessionToken } from "../src/lib/auth.ts";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString, max: 5 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function log(msg) { console.log(`[smoke-people] ${msg}`); }

const results = { pass: 0, fail: 0, tests: [] };
async function smoke(name, fn) {
  try {
    await fn();
    results.pass++;
    results.tests.push({ name, status: "PASS" });
    log(`PASS: ${name}`);
  } catch (e) {
    results.fail++;
    results.tests.push({ name, status: "FAIL", error: e.message });
    log(`FAIL: ${name} — ${e.message}`);
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

const created = {};
const actor = { id: "smoke-admin", name: "Smoke Admin" };

async function main() {
  await prisma.$connect();
  log("connected to DB");
  const runStart = new Date();
  const runTag = `${Date.now()}`;

  // Actor must be a real User (FK targets: approvedById, audit chains).
  let admin = await prisma.user.findFirst({ where: { username: "admin" } });
  if (!admin) {
    admin = await prisma.user.create({ data: { name: "Smoke Admin", username: `smoke.admin.${runTag}` } });
  }
  actor.id = admin.id;
  actor.name = admin.name;
  log(`acting as user ${admin.id} (${admin.name})`);

  // ---------------------------------------------------------------- employees
  await smoke("createEmployee (engine-validated, audited)", async () => {
    const employeeNumber = `EMP-SMOKE-${runTag}`;
    await createEmployee(prisma, actor, {
      employeeNumber,
      name: `Asha Verma ${runTag}`,
      designation: "CNC Operator",
      department: "Machining",
      panNumber: "ABCDE1234F",
      aadhaarNumber: "123456789012",
      pfUan: "100000000001",
      esiNumber: "31000000000000001",
    });
    const emp = await prisma.employee.findUnique({ where: { employeeNumber } });
    assert(emp, "employee row missing");
    assert(emp.panNumber === "ABCDE1234F", "PAN not persisted");
    created.employee = emp;
  });

  await smoke("createEmployee rejects invalid PAN (fail-closed)", async () => {
    let threw = null;
    try {
      await createEmployee(prisma, actor, {
        employeeNumber: `EMP-BAD-${Date.now()}`,
        name: "Bad PAN",
        panNumber: "12ABCDE34F", // wrong shape
      });
    } catch (e) { threw = e; }
    assert(threw, "expected validation error");
    const leaked = await prisma.employee.findFirst({ where: { name: "Bad PAN" } });
    assert(!leaked, "invalid employee must not persist");
  });

  await smoke("link User (badge join key) for attendance + payroll", async () => {
    const shift = await prisma.shift.create({
      data: { name: `SMOKE-SHIFT-${runTag}`, startTime: "06:00", endTime: "14:00" },
    });
    const user = await prisma.user.create({
      data: { name: created.employee.name, username: `smoke.asha.${runTag}`, employeeNumber: created.employee.employeeNumber },
    });
    await prisma.employee.update({ where: { id: created.employee.id }, data: { userId: user.id } });
    created.user = user;
    created.shift = shift;
  });

  // ---------------------------------------------------------------- attendance
  const base = new Date("2026-09-01T06:00:00");
  await smoke("clock attendance: 26 present + 2 late days", async () => {
    for (let day = 1; day <= 28; day++) {
      const clockIn = new Date(base); clockIn.setDate(day);
      const clockOut = new Date(clockIn); clockOut.setHours(15);
      await prisma.attendanceLog.create({
        data: {
          userId: created.user.id,
          shiftId: created.shift.id,
          clockIn,
          clockOut,
          status: day === 27 || day === 28 ? "LATE" : "PRESENT",
        },
      });
    }
    const count = await prisma.attendanceLog.count({ where: { userId: created.user.id } });
    assert(count === 28, `expected 28 logs, got ${count}`);
  });

  let stats;
  await smoke("computeAttendanceStats: 26P/2L, hours + OT", async () => {
    const logs = await prisma.attendanceLog.findMany({ where: { userId: created.user.id } });
    const r = await computeAttendanceStats(logs, created.user.id, 2026, 9);
    assert(r.presentDays === 26, `presentDays ${r.presentDays}`);
    assert(r.lateDays === 2, `lateDays ${r.lateDays}`);
    assert(r.workedHours === 252, `workedHours ${r.workedHours}`); // 9h × 28d
    assert(r.otHours === 28, `otHours ${r.otHours}`); // 1h/day over 8
    stats = r;
  });

  // ---------------------------------------------------------------- leaves
  await smoke("createLeave PENDING", async () => {
    const leave = await prisma.leaveRequest.create({
      data: {
        userId: created.user.id,
        type: "PL",
        fromDate: new Date("2026-09-21"),
        toDate: new Date("2026-09-21"),
        days: 1,
        reason: "Family function",
        status: "PENDING",
      },
    });
    created.leave = leave;
    assert(leave.status === "PENDING");
  });

  await smoke("transitionLeave: APPROVE requires PENDING (engine)", async () => {
    const r = transitionLeave("APPROVED", "APPROVE");
    assert(isErr(r) && r.error === "ILLEGAL_TRANSITION", `expected ILLEGAL_TRANSITION, got ${JSON.stringify(r)}`);
  });

  await smoke("approveLeave (adapter, audited)", async () => {
    await approveLeave(prisma, actor, created.leave.id);
    const lv = await prisma.leaveRequest.findUnique({ where: { id: created.leave.id } });
    assert(lv.status === "APPROVED", `status ${lv.status}`);
    assert(lv.approvedById === actor.id, "approvedById missing");
  });

  await smoke("leave CANCELLED state persists (new enum member)", async () => {
    const lv2 = await prisma.leaveRequest.create({
      data: {
        userId: created.user.id,
        type: "SL",
        fromDate: new Date("2026-09-22"),
        toDate: new Date("2026-09-22"),
        days: 1,
        reason: "Fever",
        status: "PENDING",
      },
    });
    const blocked = transitionLeave(lv2.status, "CANCEL");
    assert(isOk(blocked) && blocked.value.status === "CANCELLED", "engine must allow CANCEL from PENDING");
    await cancelLeave(prisma, actor, lv2.id);
    const after = await prisma.leaveRequest.findUnique({ where: { id: lv2.id } });
    assert(after.status === "CANCELLED", `expected CANCELLED, got ${after.status}`);
  });

  await smoke("rejectLeave requires a reason (engine)", async () => {
    const lv3 = await prisma.leaveRequest.create({
      data: {
        userId: created.user.id,
        type: "CL",
        fromDate: new Date("2026-09-23"),
        toDate: new Date("2026-09-23"),
        days: 1,
        reason: "Errand",
        status: "PENDING",
      },
    });
    const refused = transitionLeave(lv3.status, "REJECT");
    assert(isErr(refused) && refused.error === "REASON_REQUIRED", `expected REASON_REQUIRED, got ${JSON.stringify(refused)}`);
    await rejectLeave(prisma, actor, lv3.id, "Peak production week");
    const after = await prisma.leaveRequest.findUnique({ where: { id: lv3.id } });
    assert(after.status === "REJECTED");
  });

  // ---------------------------------------------------------------- payroll
  await smoke("runPayrollForMonth: run + payslip with LOP integrity", async () => {
    const employees = [{
      employeeCode: created.employee.employeeNumber,
      employeeName: created.employee.name,
      basicPay: 30000, hra: 0, specialAllowance: 0, conveyance: 0, otherAllowance: 0,
      pfPercent: 12, professionalTax: 200,
    }];
    const attendanceMap = new Map([[created.employee.employeeNumber, {
      presentDays: stats.presentDays, lateDays: stats.lateDays,
      workedHours: stats.workedHours, otHours: stats.otHours, regularHours: stats.regularHours,
    }]]);
    await runPayrollForMonth(prisma, actor, 2026, 9, employees, attendanceMap, {
      otDailyThresholdHours: 8, otMultiplier: 2, laborRatePerHour: 150,
      pfPercent: 12, esiThreshold: 21000, professionalTax: 200,
    });

    const run = await prisma.payrollRun.findUnique({ where: { month: "2026-09" } });
    assert(run, "PayrollRun missing");
    assert(run.status === "DRAFT", `run status ${run.status}`);
    created.run = run;

    const slip = await prisma.payslip.findFirst({
      where: { month: "2026-09", salaryStructure: { employeeCode: created.employee.employeeNumber } },
    });
    assert(slip, "Payslip missing");
    // LOP: 30 − 26P − 2L = 2 days; schema formula (gross / 30) × lopDays with gross
    // incl. OT: 38400/30 × 2 = 2560; OT pay = 28h × 150 × 2 = 8400
    assert(slip.lopDays === 2, `lopDays ${slip.lopDays}`);
    assert(slip.lopDeduction === 2560, `lopDeduction ${slip.lopDeduction}`);
    assert(slip.grossPay === 38400, `grossPay ${slip.grossPay}`); // 30000 + 8400
    assert(slip.pfDeduction === 4608, `pfDeduction ${slip.pfDeduction}`); // 12% of 38400
    assert(slip.esiDeduction === 0, `esiDeduction ${slip.esiDeduction}`); // above 21000 threshold
    assert(slip.netPay === 38400 - 4608 - 200 - 2560, `netPay ${slip.netPay}`);
    created.slip = slip;
  });

  await smoke("PayrollRun restart overwrites cleanly (idempotent re-run)", async () => {
    const employees = [{
      employeeCode: created.employee.employeeNumber,
      employeeName: created.employee.name,
      basicPay: 30000, hra: 0, specialAllowance: 0, conveyance: 0, otherAllowance: 0,
      pfPercent: 12, professionalTax: 200,
    }];
    const attendanceMap = new Map([[created.employee.employeeNumber, {
      presentDays: 30, lateDays: 0, workedHours: 270, otHours: 30, regularHours: 240,
    }]]);
    await runPayrollForMonth(prisma, actor, 2026, 9, employees, attendanceMap, {
      otDailyThresholdHours: 8, otMultiplier: 2, laborRatePerHour: 150,
      pfPercent: 12, esiThreshold: 21000, professionalTax: 200,
    });
    const slip = await prisma.payslip.findFirst({
      where: { month: "2026-09", salaryStructure: { employeeCode: created.employee.employeeNumber } },
    });
    // 30 present → LOP gone; proves the re-run overwrote the first run's values
    assert(slip.lopDays === 0, `re-run lopDays ${slip.lopDays}`);
    assert(slip.lopDeduction === 0, `re-run lopDeduction ${slip.lopDeduction}`);
    assert(slip.grossPay === 30000 + 30 * 150 * 2, `re-run grossPay ${slip.grossPay}`);
    const runs = await prisma.payrollRun.findMany({ where: { month: "2026-09" } });
    assert(runs.length === 1, `expected 1 run row, got ${runs.length}`);
  });

  await smoke("audits written for people lifecycle", async () => {
    const audits = await prisma.auditLog.findMany({
      where: {
        at: { gte: runStart },
        entityType: { in: ["Employee", "LeaveRequest", "PayrollRun"] },
      },
    });
    const actions = new Set(audits.map((a) => a.action));
    assert(actions.has("CREATE"), "employee CREATE audit missing");
    assert(actions.has("APPROVE"), "leave APPROVE audit missing");
    assert(actions.has("CANCEL"), "leave CANCEL audit missing");
    assert(actions.has("REJECT"), "leave REJECT audit missing");
    assert(actions.has("RUN"), "payroll RUN audit missing");
  });

  // ---------------------------------------------------------------- C7-4 session rotation
  await smoke("sessionRotation: expiry + staleness + reissue round-trip", async () => {
    const policy = { maxAgeHours: 24 };
    const candidate = {
      id: created.user.id, username: created.user.username, name: created.employee.name,
      roleId: "r", roleName: "ops", permissions: ["people.view"],
      isOwner: false, level: "WORKER", mustChangePassword: false,
      sess: 2, issuedAt: new Date(),
    };
    assert(!isSessionExpired(candidate, policy), "fresh session must not be expired");
    assert(needsRotation(2, 3) && needsRotation(3, 2), "epoch mismatch must need rotation");
    assert(!needsRotation(2, 2), "matching epoch is current");

    const r = rotateSession(candidate, 2, policy);
    assert(isOk(r) && r.value.action === "REISSUE", `rotateSession: ${JSON.stringify(r)}`);

    const stale = rotateSession(candidate, 5, policy);
    assert(isErr(stale) && stale.error === "EPOCH_STALE", "stale epoch must be refused");

    const fresh = await refreshSession(candidate, 2, policy);
    assert(isOk(fresh), "refreshSession must reissue");
    if (isOk(fresh)) {
      const verified = await verifySessionToken(fresh.value.token);
      assert(verified && verified.sess === 2 && verified.id === created.user.id, "token round-trip failed");
    }
  });

  await prisma.$disconnect();

  log(`\n=== SMOKE RESULTS ===`);
  results.tests.forEach((t) => log(`${t.status}: ${t.name}${t.error ? ` — ${t.error}` : ""}`));
  log(`total: ${results.pass + results.fail} | pass: ${results.pass} | fail: ${results.fail}`);
  process.exit(results.fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
