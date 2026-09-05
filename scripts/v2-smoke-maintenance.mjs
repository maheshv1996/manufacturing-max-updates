#!/usr/bin/env node
/**
 * C8-8 — Real-DB smoke test for the maintenance & tooling core (C8).
 * Drives the full lifecycle through the typed adapters against mfgmax_v2_test:
 *   jobs (start/close gates) → PM rules (scan → auto-create PM job) →
 *   tool life (consume/regrind/scrap) → cycle Tool (warn/retire) →
 *   instruments (G-4 expired-block, recal, issue/return) →
 *   spares/kit (no silent negatives, reorder, kit shortfall) →
 *   permit-to-work (3-leg approval, void) →
 *   C8-9: production tool wear (LOG_GOOD projection), G-4 measurement gate,
 *   machine-FAULT → BREAKDOWN auto-scan (detect/create/suppress/cooldown) →
 *   audits.
 * Re-runnable: every scenario is run-scoped.
 *
 * Usage:
 *   node --import tsx scripts/v2-smoke-maintenance.mjs  (DATABASE_URL defaults mfgmax_v2_test)
 */

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:1996@localhost:5432/mfgmax_v2_test";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  createJob,
  transitionJobTx,
  createPmRuleTx,
  scanPmRulesTx,
  maintenanceToolActionTx,
  recordToolCyclesTx,
  instrumentActionTx,
  issueSpareToJobTx,
  issueKitToJobTx,
  createPermitTx,
  permitActionTx,
  applyProductionToolWearTx,
  scanBreakdownsTx,
} from "../src/lib/maintenance/maintenanceTx.ts";
import { createInspectionTx } from "../src/lib/quality/qualityTx.ts";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString, max: 5 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function log(msg) { console.log(`[smoke-maint] ${msg}`); }

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
async function expectValidation(fn, code) {
  try {
    await fn();
  } catch (e) {
    // AppError.message carries the engine code (e.g. "EXPIRED", "SCRAP_REQUIRED")
    if (String(e.message).includes(code)) return;
    throw new Error(`expected ${code}, got ${e.message}`);
  }
  throw new Error(`expected ${code} to be raised, but call succeeded`);
}

const created = {};
const runTag = String(Date.now());
const actor = { id: "smoke-maint", name: "Smoke Maint" };

async function main() {
  await prisma.$connect();
  log("connected to DB");
  const runStart = new Date();

  // Admin actor (FK-valid for audit chains where approvedBy etc. reference User)
  const admin = await prisma.user.findFirst({ where: { username: "admin" } })
    ?? await prisma.user.create({ data: { name: "Smoke Maint", username: `smoke.maint.${runTag}` } });
  actor.id = admin.id;
  actor.name = admin.name;

  // ---------------------------------------------------------------- seed machines
  const line = await prisma.productionLine.create({ data: { name: `SMOKE-LINE-${runTag}` } });
  const machineA = await prisma.machine.create({ data: { name: `M-A-${runTag}`, code: `MA-${runTag}`, lineId: line.id } });
  const machineB = await prisma.machine.create({ data: { name: `M-B-${runTag}`, code: `MB-${runTag}`, lineId: line.id } });
  created.machineA = machineA;
  created.machineB = machineB;
  log(`machines ${machineA.code}, ${machineB.code}`);

  // ---------------------------------------------------------------- jobs
  await smoke("create BREAKDOWN job", async () => {
    const job = await createJob(prisma, actor, {
      machineId: machineA.id, type: "BREAKDOWN", priority: "HIGH", description: `Shaft noise ${runTag}`,
    });
    assert(job.id, "job id missing");
    created.breakdown = job;
  });

  await smoke("START then CLOSE: laborHours mandatory", async () => {
    await transitionJobTx(prisma, actor, created.breakdown.id, { action: "START" });
    await expectValidation(
      () => transitionJobTx(prisma, actor, created.breakdown.id, { action: "CLOSE" }),
      "FINDINGS_REQUIRED",
    );
    const row = await prisma.maintenanceJob.findUnique({ where: { id: created.breakdown.id } });
    assert(row.status === "IN_PROGRESS", `status should stay IN_PROGRESS, got ${row.status}`);
  });

  await smoke("BREAKDOWN close: rootCause required (W11 exception path)", async () => {
    await expectValidation(
      () => transitionJobTx(prisma, actor, created.breakdown.id, { action: "CLOSE", laborHours: 2 }),
      "ROOT_CAUSE_REQUIRED",
    );
  });

  await smoke("BREAKDOWN close with RCA succeeds and persists closedAt/laborHours", async () => {
    const r = await transitionJobTx(prisma, actor, created.breakdown.id, {
      action: "CLOSE", laborHours: 2.5, rootCause: "Worn bearing", countermeasure: "Replace + PM cadence",
    });
    assert(r.status === "CLOSED", `status ${r.status}`);
    const row = await prisma.maintenanceJob.findUnique({ where: { id: created.breakdown.id } });
    assert(row.closedAt, "closedAt missing");
    assert(row.laborHours === 2.5, `laborHours ${row.laborHours}`);
    assert(row.rootCause === "Worn bearing", "rootCause not persisted");
  });

  // ---------------------------------------------------------------- PM rules
  await smoke("PM rule: calendar due → scan detects, SCAN_AND_CREATE makes one job only", async () => {
    const rule = await createPmRuleTx(prisma, actor, {
      machineId: machineB.id, title: `Monthly lube ${runTag}`, intervalDays: 30,
      lastDoneAt: undefined,
    });
    // give the rule a past lastDoneAt (40d ago) directly — engine reads this
    await prisma.pMRule.update({ where: { id: rule.id }, data: { lastDoneAt: new Date(Date.now() - 40 * 864e5) } });
    created.rule = rule;

    const scan1 = await scanPmRulesTx(prisma, actor, {});
    assert(scan1.dueCount >= 1, `scan should find the calendar-due rule, got dueCount ${scan1.dueCount}`);

    const scan2 = await scanPmRulesTx(prisma, actor, { createJobs: true });
    assert(scan2.createdJobs.length >= 1, "SCAN_AND_CREATE should create a PM job");
    const openPmJobs = await prisma.maintenanceJob.count({
      where: { machineId: machineB.id, type: "PM", status: "OPEN" },
    });
    assert(openPmJobs >= 1, "expected a PM job");

    const scan3 = await scanPmRulesTx(prisma, actor, { createJobs: true });
    assert(scan3.createdJobs.length === 0, "re-scan must not duplicate (rule stamped lastDoneAt)");
    const openPmJobs2 = await prisma.maintenanceJob.count({
      where: { machineId: machineB.id, type: "PM", status: "OPEN" },
    });
    assert(openPmJobs2 === openPmJobs, `PM job duplicated: ${openPmJobs} → ${openPmJobs2}`);
    created.pmJob = await prisma.maintenanceJob.findFirst({
      where: { machineId: machineB.id, type: "PM", status: "OPEN" },
    });
  });

  await smoke("PM rule: run-hour trigger via RUNNING telemetry", async () => {
    const rule = await createPmRuleTx(prisma, actor, {
      machineId: machineA.id, title: `500h service ${runTag}`, intervalRunHours: 1,
    });
    await prisma.pMRule.update({ where: { id: rule.id }, data: { lastDoneAt: new Date(Date.now() - 3 * 36e5) } });
    for (let i = 0; i < 3; i++) {
      await prisma.telemetryLog.create({
        data: { machineId: machineA.id, state: "RUNNING", at: new Date(Date.now() - (2 - i) * 36e5) },
      });
    }
    const scan = await scanPmRulesTx(prisma, actor, {});
    assert(scan.dueCount >= 1, "run-hour rule should be due (2h RUNNING telemetry since last PM)");
  });

  // ---------------------------------------------------------------- tools (units)
  const tool = await prisma.maintenanceTool.create({
    data: { code: `TL-${runTag}`, name: "Die A", kind: "DIE", ratedLifeUnits: 100, maxRegrinds: 3 },
  });
  created.tool = tool;

  await smoke("tool: consume to rated life → NEEDS_REGRIND", async () => {
    const r = await maintenanceToolActionTx(prisma, actor, tool.id, { action: "CONSUME", units: 100, woNumber: "WO-X" });
    assert(r.lifeStatus === "NEEDS_REGRIND", `status ${r.lifeStatus}`);
  });

  await smoke("tool: REGRIND resets life (AVAVAILABLE), maxRegrinds forces SCRAP", async () => {
    const r1 = await maintenanceToolActionTx(prisma, actor, tool.id, { action: "REGRIND", costRupees: 500 });
    assert(r1.lifeStatus === "AVAILABLE", `status ${r1.lifeStatus}`);
    for (let i = 0; i < 2; i++) {
      await maintenanceToolActionTx(prisma, actor, tool.id, { action: "CONSUME", units: 100 });
      await maintenanceToolActionTx(prisma, actor, tool.id, { action: "REGRIND" });
    }
    await maintenanceToolActionTx(prisma, actor, tool.id, { action: "CONSUME", units: 100 });
    await expectValidation(
      () => maintenanceToolActionTx(prisma, actor, tool.id, { action: "REGRIND" }),
      "SCRAP_REQUIRED",
    );
    const r5 = await maintenanceToolActionTx(prisma, actor, tool.id, { action: "SCRAP", reason: "Life exhausted" });
    assert(r5.lifeStatus === "SCRAPPED", `status ${r5.lifeStatus}`);
    const logs = await prisma.toolLifeLog.count({ where: { toolId: tool.id } });
    assert(logs >= 7, `expected ≥7 lifecycle log rows, got ${logs}`);
  });

  // ---------------------------------------------------------------- tool (cycles)
  const cycleTool = await prisma.tool.create({
    data: { toolCode: `FIX-${runTag}`, name: "Fixture C", maxLifeCycles: 100, warningThreshold: 85 },
  });
  await smoke("cycle tool: warn at threshold, RETIRE at max, retired refuses cycles", async () => {
    const w = await recordToolCyclesTx(prisma, actor, cycleTool.id, 90);
    assert(w.status === "WARNING", `status ${w.status}`);
    const r = await recordToolCyclesTx(prisma, actor, cycleTool.id, 10);
    assert(r.status === "RETIRED", `status ${r.status}`);
    await expectValidation(
      () => recordToolCyclesTx(prisma, actor, cycleTool.id, 1),
      "RETIRED",
    );
  });

  // ---------------------------------------------------------------- instruments (G-4)
  const instrument = await prisma.calibratedTool.create({
    data: {
      toolType: "MICROMETER", name: "Mic-01", serialNumber: `MIC-${runTag}`,
      calibratedAt: new Date(Date.now() - 400 * 864e5), expiresAt: new Date(Date.now() - 10 * 864e5),
      status: "EXPIRED", location: "SHOPFLOOR", lifecycle: "ACTIVE",
    },
  });
  created.instrument = instrument;

  await smoke("instrument: EXPIRED blocks issue (G-4) until recalibrated", async () => {
    await expectValidation(
      () => instrumentActionTx(prisma, actor, instrument.id, { action: "ISSUE", issuedToName: "Shop", expectedReturnAt: new Date(Date.now() + 864e5) }),
      "EXPIRED",
    );
    const rec = await instrumentActionTx(prisma, actor, instrument.id, { action: "RECALIBRATE", intervalDays: 180, certNumber: "CERT-1" });
    assert(rec.location === "LAB_CABINET", `location ${rec.location}`);
    const row = await prisma.calibratedTool.findUnique({ where: { id: instrument.id } });
    assert(row.expiresAt > new Date(), "expiresAt not renewed");
  });

  await smoke("instrument: issue → WITH_OPERATOR, double-issue blocked, return → crib", async () => {
    const issued = await instrumentActionTx(prisma, actor, instrument.id, {
      action: "ISSUE", issuedToName: "Operator P", expectedReturnAt: new Date(Date.now() + 3 * 864e5),
    });
    assert(issued.location === "WITH_OPERATOR", `location ${issued.location}`);
    await expectValidation(
      () => instrumentActionTx(prisma, actor, instrument.id, { action: "ISSUE", issuedToName: "Operator Q", expectedReturnAt: new Date(Date.now() + 864e5) }),
      "ALREADY_ISSUED",
    );
    const ret = await instrumentActionTx(prisma, actor, instrument.id, { action: "RETURN" });
    assert(ret.location === "LAB_CABINET", `location ${ret.location}`);
    const issue = await prisma.instrumentIssue.findFirst({ where: { calibratedToolId: instrument.id }, orderBy: { issuedAt: "desc" } });
    assert(issue.returnedAt, "returnedAt missing");
  });

  // ---------------------------------------------------------------- spares & kits
  const spare = await prisma.sparePart.create({
    data: { sku: `BRG-${runTag}`, name: "Bearing", currentQty: 2, minQty: 1, reorderPoint: 3, leadTimeDays: 15, avgDailyUsage: 0.5 },
  });
  await smoke("spare: over-issue blocked, issue to zero flags reorder", async () => {
    await expectValidation(
      () => issueSpareToJobTx(prisma, actor, spare.id, created.pmJob.id, 3),
      "INSUFFICIENT_STOCK",
    );
    const r = await issueSpareToJobTx(prisma, actor, spare.id, created.pmJob.id, 2);
    assert(r.remainingQty === 0, `remaining ${r.remainingQty}`);
    assert(r.reorder === true, "reorder flag must fire at 0 ≤ reorderPoint 3");
  });

  await smoke("spare kit: full issue drains lines, shortfall blocks all-or-nothing", async () => {
    const spA = await prisma.sparePart.create({ data: { sku: `SK-A-${runTag}`, name: "Seal A", currentQty: 1 } });
    const spB = await prisma.sparePart.create({ data: { sku: `SK-B-${runTag}`, name: "Seal B", currentQty: 1 } });
    const kit = await prisma.spareKit.create({
      data: {
        name: `Kit-${runTag}`,
        items: {
          create: [
            { spareId: spA.id, quantity: 1 },
            { spareId: spB.id, quantity: 1 },
          ],
        },
      },
    });
    const r = await issueKitToJobTx(prisma, actor, kit.id, created.pmJob.id);
    assert(r.issued.length === 2, `issued ${r.issued.length}`);
    await expectValidation(
      () => issueKitToJobTx(prisma, actor, kit.id, created.pmJob.id),
      "KIT_SHORTFALL",
    );
  });

  // ---------------------------------------------------------------- permits
  await smoke("permit: three-leg approval → APPROVED → void", async () => {
    const permit = await createPermitTx(prisma, actor, `PTW-SMOKE-${runTag}`, {
      maintenanceJobId: created.pmJob.id,
      type: "HOT_WORK", description: "Welding on machine B", location: "Cell 2",
      validFrom: new Date(Date.now() - 864e5), validUntil: new Date(Date.now() + 864e5),
    });
    created.permit = permit;

    const ehs = await permitActionTx(prisma, actor, permit.id, { action: "APPROVE_LEG", leg: "EHS", reason: "Fire watch posted" });
    assert(ehs.status === "PENDING", "one leg must not approve");
    const maint = await permitActionTx(prisma, actor, permit.id, { action: "APPROVE_LEG", leg: "MAINTENANCE", reason: "Isolation verified" });
    assert(maint.status === "PENDING", "two legs must not approve");
    const prod = await permitActionTx(prisma, actor, permit.id, { action: "APPROVE_LEG", leg: "PRODUCTION", reason: "Line clear" });
    assert(prod.status === "APPROVED", `status ${prod.status}`);

    const row = await prisma.permitToWork.findUnique({ where: { id: permit.id } });
    assert(row.ehsApprovedBy && row.maintApprovedBy && row.prodApprovedBy, "all three legs must persist");

    const voided = await permitActionTx(prisma, actor, permit.id, { action: "VOID", reason: "Scope changed" });
    assert(voided.status === "VOID", `status ${voided.status}`);
    const row2 = await prisma.permitToWork.findUnique({ where: { id: permit.id } });
    assert(row2.voidedAt, "voidedAt missing");
  });

  // ---------------------------------------------------------------- C8-9 setup (wear / inspection / breakdown)
  const wearCycleTool = await prisma.tool.create({
    data: { toolCode: `WEAR-C-${runTag}`, name: "Wear Cycle Tool", maxLifeCycles: 10, warningThreshold: 80, assignedMachineId: machineA.id },
  });
  const wearUnitTool = await prisma.maintenanceTool.create({
    data: { code: `WEAR-U-${runTag}`, name: "Wear Unit Die", kind: "DIE", ratedLifeUnits: 10, machineId: machineA.id, maxRegrinds: 3 },
  });
  const smokeProduct = await prisma.product.create({ data: { sku: `SMOKE-P-${runTag}`, name: "Smoke Part" } });
  const smokeWo = await prisma.workOrder.create({
    data: {
      woNumber: `WO-SMOKE-${runTag}`, productId: smokeProduct.id, plannedQuantity: 50,
      plannedStartDate: new Date(Date.now() - 864e5), plannedEndDate: new Date(Date.now() + 864e5),
    },
  });
  const expiredGauge = await prisma.calibratedTool.create({
    data: {
      toolType: "GAUGE", name: "Cal-Expired", serialNumber: `CAL-X-${runTag}`,
      calibratedAt: new Date(Date.now() - 400 * 864e5), expiresAt: new Date(Date.now() - 10 * 864e5),
      status: "EXPIRED", location: "SHOPFLOOR", lifecycle: "ACTIVE",
    },
  });
  const goodGauge = await prisma.calibratedTool.create({
    data: {
      toolType: "MICROMETER", name: "Cal-Good", serialNumber: `CAL-G-${runTag}`,
      calibratedAt: new Date(Date.now() - 30 * 864e5), expiresAt: new Date(Date.now() + 150 * 864e5),
      status: "OK", location: "LAB_CABINET", lifecycle: "ACTIVE",
    },
  });

  // ---------------------------------------------------------------- C8-9 verification
  await smoke("C8-9a: LOG_GOOD wear — cycle tool warns at threshold %, retires at max", async () => {
    const r1 = await applyProductionToolWearTx(prisma, actor, machineA.id, 8, { workOrderId: smokeWo.id });
    assert(r1.cycles === 1 && r1.unitsUpdated === 1, `projection cycles=${r1.cycles} units=${r1.unitsUpdated}`);
    let t = await prisma.tool.findUnique({ where: { id: wearCycleTool.id } });
    assert(t.currentCycles === 8 && t.status === "WARNING", `80% wear should warn, got ${t.status} @ ${t.currentCycles}`);
    const r2 = await applyProductionToolWearTx(prisma, actor, machineA.id, 2);
    t = await prisma.tool.findUnique({ where: { id: wearCycleTool.id } });
    assert(t.status === "RETIRED" && t.currentCycles === 10, `retired expected, got ${t.status} @ ${t.currentCycles}`);
    const unit = await prisma.maintenanceTool.findUnique({ where: { id: wearUnitTool.id } });
    assert(unit.usedUnits === 10 && unit.lifeStatus === "NEEDS_REGRIND", `unit ${unit.usedUnits}/${unit.lifeStatus}`);
    const crossings = await prisma.toolLifeLog.count({ where: { toolId: wearUnitTool.id, action: "CONSUME" } });
    assert(crossings === 1, `exactly one CONSUME alert on the rated-life crossing, got ${crossings}`);
    const r3 = await applyProductionToolWearTx(prisma, actor, machineA.id, 3);
    assert(r3.cycles === 0, "RETIRED tooling must never re-arm from production");
    assert(r3.unitsUpdated === 1, "NEEDS_REGRIND unit tool keeps consuming until replaced");
    const crossings2 = await prisma.toolLifeLog.count({ where: { toolId: wearUnitTool.id, action: "CONSUME" } });
    assert(crossings2 === 1, `crossing must not re-fire while NEEDS_REGRIND, got ${crossings2}`);
  });

  await smoke("C8-9b: G-4 at measurement time — expired gauge cannot record an inspection", async () => {
    await expectValidation(
      () => createInspectionTx(prisma, {
        actor, workOrderId: smokeWo.id, totalInspected: 5, passed: 5, failed: 0,
        calibratedToolId: expiredGauge.id,
      }),
      "G-4",
    );
    const none = await prisma.qualityInspection.count({ where: { workOrderId: smokeWo.id } });
    assert(none === 0, "refused inspection must not persist");
  });

  await smoke("C8-9b: valid gauge records inspection; counter arithmetic is validated", async () => {
    await expectValidation(
      () => createInspectionTx(prisma, { actor, workOrderId: smokeWo.id, totalInspected: 5, passed: 4, failed: 2 }),
      "cannot exceed",
    );
    const created = await createInspectionTx(prisma, {
      actor, workOrderId: smokeWo.id, totalInspected: 5, passed: 4, failed: 1, calibratedToolId: goodGauge.id,
    });
    assert(created.id, "inspection id missing");
    const row = await prisma.qualityInspection.findUnique({ where: { id: created.id } });
    assert(row && row.passed === 4 && row.failed === 1, "inspection row not persisted");
  });

  await smoke("C8-9c: machine FAULT → scan detects, auto-creates one BREAKDOWN, suppresses while open", async () => {
    await prisma.machine.update({ where: { id: machineB.id }, data: { currentState: "FAULT" } });
    const scan1 = await scanBreakdownsTx(prisma, actor, {});
    assert(scan1.faultCount >= 1 && scan1.createdCount === 0, `SCAN must not write (faults=${scan1.faultCount}, created=${scan1.createdCount})`);
    assert(scan1.candidates >= 1, "FAULT machine with no open breakdown must be a candidate");
    const scan2 = await scanBreakdownsTx(prisma, actor, { createJobs: true });
    assert(scan2.createdCount >= 1, "SCAN_AND_CREATE must open a BREAKDOWN job");
    const scan3 = await scanBreakdownsTx(prisma, actor, { createJobs: true });
    assert(scan3.createdCount === 0, "open breakdown must suppress duplicates");
  });

  await smoke("C8-9c: cooldown guards re-open after closure", async () => {
    const auto = await prisma.maintenanceJob.findFirst({
      where: { machineId: machineB.id, type: "BREAKDOWN", status: "OPEN" },
    });
    assert(auto, "auto-created job missing");
    await transitionJobTx(prisma, actor, auto.id, { action: "START" });
    await transitionJobTx(prisma, actor, auto.id, { action: "CLOSE", laborHours: 1, rootCause: "Auto-detected from FAULT scan" });
    const scan4 = await scanBreakdownsTx(prisma, actor, { createJobs: true, cooldownMinutes: 60 });
    assert(scan4.createdCount === 0, "cooldown must suppress re-open");
    const scan5 = await scanBreakdownsTx(prisma, actor, { createJobs: true });
    assert(scan5.createdCount >= 1, "without cooldown a FAULT machine re-opens");
    await prisma.machine.update({ where: { id: machineB.id }, data: { currentState: "IDLE" } });
  });

  // ---------------------------------------------------------------- audits
  await smoke("audits cover the maintenance lifecycle", async () => {
    const types = ["MaintenanceJob", "PMRule", "MaintenanceTool", "Tool", "CalibratedTool", "SparePart", "SpareKit", "PermitToWork", "MACHINE", "QualityInspection"];
    const audits = await prisma.auditLog.findMany({
      where: { at: { gte: runStart }, entityType: { in: types } },
      select: { entityType: true, action: true },
    });
    const seen = new Set(audits.map((a) => `${a.entityType}:${a.action}`));
    const expected = [
      "MaintenanceJob:CREATE", "MaintenanceJob:START", "MaintenanceJob:CLOSE",
      "PMRule:CREATE", "MaintenanceTool:ISSUE", "MaintenanceTool:REGRIND", "MaintenanceTool:SCRAP",
      "Tool:CONSUME", "CalibratedTool:ISSUE", "CalibratedTool:RETURN", "CalibratedTool:RECALIBRATE",
      "SparePart:ISSUE", "SpareKit:ISSUE", "PermitToWork:CREATE", "PermitToWork:APPROVE_LEG", "PermitToWork:VOID",
      "MACHINE:TOOL_WEAR", "MaintenanceJob:BREAKDOWN_AUTO_CREATED", "QualityInspection:INSPECTION_CREATED",
    ];
    const missing = expected.filter((k) => !seen.has(k));
    assert(missing.length === 0, `missing audits: ${missing.join(", ")}`);
  });

  await prisma.$disconnect();

  log(`\n=== SMOKE RESULTS ===`);
  results.tests.forEach((t) => log(`${t.status}: ${t.name}${t.error ? ` — ${t.error}` : ""}`));
  log(`total: ${results.pass + results.fail} | pass: ${results.pass} | fail: ${results.fail}`);
  process.exit(results.fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });