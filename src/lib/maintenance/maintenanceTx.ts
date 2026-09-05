/**
 * C8-7 — Typed maintenance/tooling transaction adapters.
 * Every mutation runs the pure engine first and only then writes,
 * inside one `$transaction`, with in-tx audit rows (C7 peopleTx pattern).
 * Engine errors surface as typed VALIDATION errors — never silent.
 */

import type { PrismaClient, Prisma } from "@prisma/client";
import { notFound, validation } from "../core/errors";
import { buildAuditEvent, type AuditEventInput } from "../core/audit";
import { transitionJob, type JobAction } from "./jobState";
import { scanPmRules, type PmRuleInput } from "./pm";
import { consumeUnits, regrind, scrap, recordCycles } from "./toolLife";
import { projectProductionToolWear } from "./productionWear";
import { detectBreakdownMachines } from "./breakdownScan";
import {
  canIssue,
  recalibrate,
  type InstrumentInput,
  type InstrumentLocation,
  type InstrumentLifecycle,
} from "./calibration";
import { issueSpare, kitShortfall, type SparePartInput } from "./spares";
import { approveLeg, voidPermit, type PermitInput, type PermitLeg } from "./permit";

type Tx = Prisma.TransactionClient;

async function audit(tx: Tx, input: AuditEventInput): Promise<void> {
  const ev = buildAuditEvent(input);
  await tx.auditLog.create({
    data: {
      actor: ev.actor,
      action: ev.action,
      entityType: ev.entityType,
      entityId: ev.entityId,
      details: ev.details ?? "",
      at: ev.at,
    },
  });
}

export interface MaintenanceActor {
  id: string;
  name?: string;
}

function engineError(code: string): never {
  throw validation(code);
}

// ---------------------------------------------------------------- jobs

export async function createJob(
  db: PrismaClient,
  actor: MaintenanceActor,
  input: {
    machineId: string;
    type: "BREAKDOWN" | "PM";
    priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    description: string;
    kitId?: string | null;
  },
): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const machine = await tx.machine.findUnique({ where: { id: input.machineId }, select: { id: true } });
    if (!machine) throw notFound("Machine not found");

    const job = await tx.maintenanceJob.create({
      data: {
        machineId: input.machineId,
        requestedByName: actor.name ?? actor.id,
        type: input.type,
        priority: input.priority ?? "MEDIUM",
        description: input.description,
        kitId: input.kitId ?? null,
      },
      select: { id: true },
    });

    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "MaintenanceJob",
      entityId: job.id,
      action: "CREATE",
      details: `${input.type} job opened: ${input.description}`,
    });
    return job;
  });
}

export async function transitionJobTx(
  db: PrismaClient,
  actor: MaintenanceActor,
  jobId: string,
  a: JobAction,
): Promise<{ id: string; status: string }> {
  return db.$transaction(async (tx) => {
    const job = await tx.maintenanceJob.findUnique({ where: { id: jobId } });
    if (!job) throw notFound("Maintenance job not found");

    const result = transitionJob(
      {
        id: job.id,
        machineId: job.machineId,
        type: job.type,
        priority: job.priority,
        description: job.description,
        status: job.status,
        openedAt: job.openedAt,
        closedAt: job.closedAt,
      },
      a,
    );
    if (result.tag === "err") engineError(result.error);

    const v = result.value;
    const updated = await tx.maintenanceJob.update({
      where: { id: jobId },
      data: {
        status: v.status,
        closedAt: v.closedAt ?? null,
        closedBy: v.closedAt ? (actor.name ?? actor.id) : null,
        laborHours: v.laborHours ?? null,
        rootCause: v.rootCause ?? null,
        countermeasure: v.countermeasure ?? null,
      },
      select: { id: true, status: true },
    });

    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "MaintenanceJob",
      entityId: jobId,
      action: a.action,
      details: `Job → ${v.status}${a.action === "CLOSE" ? ` (${a.laborHours}h)` : ""}`,
    });
    return updated;
  });
}

// ---------------------------------------------------------------- PM rules

/** Approximate machine run-hours (RUNNING telemetry spans) since `since`. */
async function runHoursSince(
  tx: Tx,
  machineId: string,
  since: Date,
  now: Date,
): Promise<number | null> {
  const pings = await tx.telemetryLog.findMany({
    where: { machineId, at: { gte: since, lte: now } },
    orderBy: { at: "asc" },
    select: { state: true, at: true },
  });
  if (pings.length < 2) return null;
  let hours = 0;
  for (let i = 1; i < pings.length; i++) {
    if (pings[i - 1].state === "RUNNING") {
      hours += (pings[i].at.getTime() - pings[i - 1].at.getTime()) / 3_600_000;
    }
  }
  return hours;
}

export async function createPmRuleTx(
  db: PrismaClient,
  actor: MaintenanceActor,
  input: {
    machineId: string;
    title: string;
    intervalDays?: number | null;
    intervalRunHours?: number | null;
    kitId?: string | null;
  },
): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const machine = await tx.machine.findUnique({ where: { id: input.machineId }, select: { id: true } });
    if (!machine) throw notFound("Machine not found");
    if (!input.intervalDays && !input.intervalRunHours) engineError("INTERVAL_REQUIRED");

    const rule = await tx.pMRule.create({
      data: {
        machineId: input.machineId,
        title: input.title,
        intervalDays: input.intervalDays ?? null,
        intervalRunHours: input.intervalRunHours ?? null,
        kitId: input.kitId ?? null,
      },
      select: { id: true },
    });
    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "PMRule",
      entityId: rule.id,
      action: "CREATE",
      details: `PM rule created: ${input.title}`,
    });
    return rule;
  });
}

export async function scanPmRulesTx(
  db: PrismaClient,
  actor: MaintenanceActor,
  opts: { createJobs?: boolean } = {},
): Promise<{ dueCount: number; createdJobs: string[] }> {
  const now = new Date();
  const rules = await db.pMRule.findMany({
    where: { isActive: true },
    include: { machine: { select: { id: true, createdAt: true } } },
  });

  const runHoursByMachine = new Map<string, number>();
  for (const rule of rules) {
    const since = rule.lastDoneAt ?? rule.machine.createdAt;
    const hours = await runHoursSince(db, rule.machineId, since, now);
    if (hours !== null) runHoursByMachine.set(rule.machineId, hours);
  }

  const ruleInputs: PmRuleInput[] = rules.map((r) => ({
    id: r.id,
    machineId: r.machineId,
    title: r.title,
    intervalDays: r.intervalDays,
    intervalRunHours: r.intervalRunHours,
    lastDoneAt: r.lastDoneAt,
    isActive: r.isActive,
  }));

  const due = scanPmRules(ruleInputs, { now, runHoursByMachine });

  const createdJobs: string[] = [];
  if (opts.createJobs) {
    for (const d of due) {
      const rule = rules.find((r) => r.id === d.ruleId);
      if (!rule) continue;
      const job = await createJob(db, actor, {
        machineId: rule.machineId,
        type: "PM",
        priority: "MEDIUM",
        description: `PM (auto): ${rule.title}${d.overdueDays ? ` — ${d.overdueDays}d overdue` : ""} [${d.reason}]`,
        kitId: rule.kitId,
      });
      createdJobs.push(job.id);
      await db.pMRule.update({ where: { id: rule.id }, data: { lastDoneAt: now } });
    }
  }

  return { dueCount: due.length, createdJobs };
}

export async function completePmRuleTx(
  db: PrismaClient,
  actor: MaintenanceActor,
  ruleId: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const rule = await tx.pMRule.findUnique({ where: { id: ruleId } });
    if (!rule) throw notFound("PM rule not found");
    await tx.pMRule.update({ where: { id: ruleId }, data: { lastDoneAt: new Date() } });
    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "PMRule",
      entityId: ruleId,
      action: "COMPLETE",
      details: `PM completed: ${rule.title}`,
    });
  });
}

// ---------------------------------------------------------------- tooling (units)

export async function maintenanceToolActionTx(
  db: PrismaClient,
  actor: MaintenanceActor,
  toolId: string,
  a: { action: "CONSUME"; units: number; woNumber?: string } | { action: "REGRIND"; costRupees?: number } | { action: "SCRAP"; reason: string },
): Promise<{ id: string; lifeStatus: string }> {
  return db.$transaction(async (tx) => {
    const tool = await tx.maintenanceTool.findUnique({ where: { id: toolId } });
    if (!tool) throw notFound("Maintenance tool not found");

    const input = {
      id: tool.id,
      code: tool.code,
      ratedLifeUnits: tool.ratedLifeUnits,
      usedUnits: tool.usedUnits,
      regrinds: tool.regrinds,
      maxRegrinds: tool.maxRegrinds,
      lifeStatus: tool.lifeStatus as "AVAILABLE" | "IN_USE" | "NEEDS_REGRIND" | "SCRAPPED",
    };

    let result;
    let logAction: string;
    let note: string;
    let costRupees = 0;
    if (a.action === "CONSUME") {
      result = consumeUnits(input, a.units, new Date());
      logAction = "ISSUE";
      note = `Consumed ${a.units} units${a.woNumber ? ` on ${a.woNumber}` : ""}`;
    } else if (a.action === "REGRIND") {
      result = regrind(input, { costRupees: a.costRupees ?? 0, now: new Date() });
      logAction = "REGRIND";
      note = `Regrind #${input.regrinds + 1}`;
      costRupees = a.costRupees ?? 0;
    } else {
      result = scrap(input, { reason: a.reason, now: new Date() });
      logAction = "SCRAP";
      note = a.reason;
    }
    if (result.tag === "err") engineError(result.error);

    const v = result.value;
    const updated = await tx.maintenanceTool.update({
      where: { id: toolId },
      data: {
        usedUnits: v.usedUnits,
        regrinds: v.regrinds,
        lifeStatus: v.lifeStatus,
        lastChangedAt: new Date(),
      },
      select: { id: true, lifeStatus: true },
    });

    await tx.toolLifeLog.create({
      data: {
        toolId,
        action: logAction,
        woNumber: a.action === "CONSUME" ? (a.woNumber ?? null) : null,
        costRupees,
        note,
        actor: actor.name ?? actor.id,
      },
    });
    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "MaintenanceTool",
      entityId: toolId,
      action: logAction,
      details: `${tool.code}: ${note} → ${v.lifeStatus}`,
    });

    return updated;
  });
}

export async function recordToolCyclesTx(
  db: PrismaClient,
  actor: MaintenanceActor,
  toolId: string,
  cycles: number,
): Promise<{ id: string; status: string; currentCycles: number }> {
  return db.$transaction(async (tx) => {
    const tool = await tx.tool.findUnique({ where: { id: toolId } });
    if (!tool) throw notFound("Tool not found");

    const result = recordCycles(
      {
        id: tool.id,
        toolCode: tool.toolCode,
        maxLifeCycles: tool.maxLifeCycles,
        currentCycles: tool.currentCycles,
        warningThreshold: tool.warningThreshold,
        status: tool.status,
      },
      cycles,
      new Date(),
    );
    if (result.tag === "err") engineError(result.error);

    const updated = await tx.tool.update({
      where: { id: toolId },
      data: { currentCycles: result.value.currentCycles, status: result.value.status },
      select: { id: true, status: true, currentCycles: true },
    });

    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "Tool",
      entityId: toolId,
      action: "CONSUME",
      details: `${tool.toolCode}: +${cycles} cycles → ${updated.currentCycles}/${tool.maxLifeCycles} (${updated.status})`,
    });
    return updated;
  });
}

// ---------------------------------------------------------------- instruments (G-4)

function toInstrumentInput(row: {
  id: string;
  serialNumber: string;
  calibratedAt: Date;
  expiresAt: Date;
  location: string;
  lifecycle: string;
}): InstrumentInput {
  return {
    id: row.id,
    serialNumber: row.serialNumber,
    calibratedAt: row.calibratedAt,
    expiresAt: row.expiresAt,
    location: row.location as InstrumentLocation,
    lifecycle: row.lifecycle as InstrumentLifecycle,
  };
}

export async function instrumentActionTx(
  db: PrismaClient,
  actor: MaintenanceActor,
  instrumentId: string,
  a:
    | { action: "ISSUE"; issuedToName: string; expectedReturnAt: Date; notes?: string }
    | { action: "RETURN"; notes?: string }
    | { action: "RECALIBRATE"; intervalDays: number; certNumber?: string },
): Promise<{ id: string; location: string }> {
  return db.$transaction(async (tx) => {
    const inst = await tx.calibratedTool.findUnique({ where: { id: instrumentId } });
    if (!inst) throw notFound("Instrument not found");
    const input = toInstrumentInput(inst);

    if (a.action === "ISSUE") {
      const decision = canIssue(input, new Date(), a.expectedReturnAt);
      if (!decision.ok) engineError(decision.reason);

      await tx.instrumentIssue.create({
        data: {
          calibratedToolId: instrumentId,
          issuedToName: a.issuedToName,
          issuedBy: actor.name ?? actor.id,
          expectedReturnAt: a.expectedReturnAt,
          notes: a.notes ?? null,
        },
      });
      const updated = await tx.calibratedTool.update({
        where: { id: instrumentId },
        data: { location: "WITH_OPERATOR" },
        select: { id: true, location: true },
      });
      await audit(tx, {
        actor: actor.name ?? actor.id,
        entityType: "CalibratedTool",
        entityId: instrumentId,
        action: "ISSUE",
        details: `${inst.serialNumber} issued to ${a.issuedToName}`,
      });
      return updated;
    }

    if (a.action === "RETURN") {
      const open = await tx.instrumentIssue.findFirst({
        where: { calibratedToolId: instrumentId, returnedAt: null },
        orderBy: { issuedAt: "desc" },
      });
      if (!open) engineError("NO_OPEN_ISSUE");
      if (input.location !== "WITH_OPERATOR") engineError("NOT_ISSUED");

      await tx.instrumentIssue.update({
        where: { id: open.id },
        data: { returnedAt: new Date(), returnedToName: actor.name ?? actor.id, notes: a.notes ?? open.notes },
      });
      const updated = await tx.calibratedTool.update({
        where: { id: instrumentId },
        data: { location: "LAB_CABINET" },
        select: { id: true, location: true },
      });
      await audit(tx, {
        actor: actor.name ?? actor.id,
        entityType: "CalibratedTool",
        entityId: instrumentId,
        action: "RETURN",
        details: `${inst.serialNumber} returned to crib`,
      });
      return updated;
    }

    // RECALIBRATE
    const rec = recalibrate(input, a.intervalDays, new Date());
    if (rec.tag === "err") engineError(rec.error);
    const updated = await tx.calibratedTool.update({
      where: { id: instrumentId },
      data: {
        calibratedAt: rec.value.calibratedAt,
        expiresAt: rec.value.expiresAt,
        location: rec.value.location,
        calibrationIntervalDays: a.intervalDays,
        ...(a.certNumber ? { certNumber: a.certNumber } : {}),
      },
      select: { id: true, location: true },
    });
    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "CalibratedTool",
      entityId: instrumentId,
      action: "RECALIBRATE",
      details: `${inst.serialNumber} recalibrated (interval ${a.intervalDays}d)${a.certNumber ? ` cert ${a.certNumber}` : ""}`,
    });
    return updated;
  });
}

// ---------------------------------------------------------------- spares & kits

function toSpareInput(row: {
  id: string;
  sku: string;
  name: string;
  currentQty: number;
  minQty: number;
  reorderPoint: number;
  leadTimeDays: number;
  avgDailyUsage: number;
}): SparePartInput {
  return { ...row };
}

export async function issueSpareToJobTx(
  db: PrismaClient,
  actor: MaintenanceActor,
  spareId: string,
  jobId: string | null,
  qty: number,
): Promise<{ spareId: string; remainingQty: number; reorder: boolean }> {
  return db.$transaction(async (tx) => {
    const spareRow = await tx.sparePart.findUnique({ where: { id: spareId } });
    if (!spareRow) throw notFound("Spare part not found");

    if (jobId) {
      const job = await tx.maintenanceJob.findUnique({ where: { id: jobId }, select: { status: true, partsUsed: true } });
      if (!job) throw notFound("Maintenance job not found");
      if (job.status === "CLOSED") engineError("JOB_CLOSED");
      await tx.maintenanceJob.update({
        where: { id: jobId },
        data: { partsUsed: `${job.partsUsed ? job.partsUsed + "; " : ""}${spareRow.sku} x${qty}` },
      });
    }

    const result = issueSpare(toSpareInput(spareRow), qty);
    if (result.tag === "err") engineError(result.error);

    const remaining = result.value.currentQty;
    await tx.sparePart.update({ where: { id: spareId }, data: { currentQty: remaining } });

    const reorder = remaining <= spareRow.reorderPoint;
    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "SparePart",
      entityId: spareId,
      action: "ISSUE",
      details: `${spareRow.sku} x${qty} issued${jobId ? ` to job ${jobId}` : ""} — remaining ${remaining}${reorder ? " (REORDER)" : ""}`,
    });
    return { spareId, remainingQty: remaining, reorder };
  });
}

export async function issueKitToJobTx(
  db: PrismaClient,
  actor: MaintenanceActor,
  kitId: string,
  jobId: string,
): Promise<{ issued: { spareId: string; qty: number }[] }> {
  return db.$transaction(async (tx) => {
    const kit = await tx.spareKit.findUnique({ where: { id: kitId }, include: { items: { include: { spare: true } } } });
    if (!kit) throw notFound("Spare kit not found");
    const job = await tx.maintenanceJob.findUnique({ where: { id: jobId }, select: { status: true } });
    if (!job) throw notFound("Maintenance job not found");
    if (job.status === "CLOSED") engineError("JOB_CLOSED");

    const lines = kit.items.map((i) => ({ spare: toSpareInput(i.spare), required: i.quantity }));
    const shortfall = kitShortfall(lines);
    if (!shortfall.canIssue) engineError(`KIT_SHORTFALL:${shortfall.missing.map((m) => m.sku).join(",")}`);

    const issued: { spareId: string; qty: number }[] = [];
    for (const line of lines) {
      const r = issueSpare(line.spare, line.required);
      if (r.tag === "err") engineError(r.error); // all-or-nothing inside the tx
      await tx.sparePart.update({ where: { id: line.spare.id }, data: { currentQty: r.value.currentQty } });
      issued.push({ spareId: line.spare.id, qty: line.required });
    }

    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "SpareKit",
      entityId: kitId,
      action: "ISSUE",
      details: `Kit "${kit.name}" issued to job ${jobId} (${issued.length} lines)`,
    });
    return { issued };
  });
}

// ---------------------------------------------------------------- permits to work

function toPermitInput(row: {
  id: string;
  permitNo: string;
  type: string;
  status: string;
  validFrom: Date;
  validUntil: Date;
  ehsApprovedBy: string | null;
  ehsApprovedAt: Date | null;
  ehsApprovedReason: string | null;
  maintApprovedBy: string | null;
  maintApprovedAt: Date | null;
  maintApprovedReason: string | null;
  prodApprovedBy: string | null;
  prodApprovedAt: Date | null;
  prodApprovedReason: string | null;
}): PermitInput {
  return {
    id: row.id,
    permitNo: row.permitNo,
    type: row.type,
    status: row.status as PermitInput["status"],
    validFrom: row.validFrom,
    validUntil: row.validUntil,
    legs: {
      EHS: row.ehsApprovedBy ? { by: row.ehsApprovedBy, reason: row.ehsApprovedReason ?? "", at: row.ehsApprovedAt ?? new Date() } : undefined,
      MAINTENANCE: row.maintApprovedBy ? { by: row.maintApprovedBy, reason: row.maintApprovedReason ?? "", at: row.maintApprovedAt ?? new Date() } : undefined,
      PRODUCTION: row.prodApprovedBy ? { by: row.prodApprovedBy, reason: row.prodApprovedReason ?? "", at: row.prodApprovedAt ?? new Date() } : undefined,
    },
  };
}

export async function createPermitTx(
  db: PrismaClient,
  actor: MaintenanceActor,
  nextPermitNo: string,
  input: {
    maintenanceJobId: string;
    type: string;
    description: string;
    location: string;
    validFrom: Date;
    validUntil: Date;
  },
): Promise<{ id: string; permitNo: string }> {
  return db.$transaction(async (tx) => {
    const job = await tx.maintenanceJob.findUnique({ where: { id: input.maintenanceJobId }, select: { id: true } });
    if (!job) throw notFound("Maintenance job not found");
    if (input.validUntil <= input.validFrom) engineError("INVALID_WINDOW");

    const permit = await tx.permitToWork.create({
      data: {
        permitNo: nextPermitNo,
        maintenanceJobId: input.maintenanceJobId,
        type: input.type,
        description: input.description,
        location: input.location,
        requestedBy: actor.name ?? actor.id,
        validFrom: input.validFrom,
        validUntil: input.validUntil,
      },
      select: { id: true, permitNo: true },
    });
    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "PermitToWork",
      entityId: permit.id,
      action: "CREATE",
      details: `${permit.permitNo} (${input.type}) requested for job ${input.maintenanceJobId}`,
    });
    return permit;
  });
}

export async function permitActionTx(
  db: PrismaClient,
  actor: MaintenanceActor,
  permitId: string,
  a: { action: "APPROVE_LEG"; leg: PermitLeg; reason: string } | { action: "VOID"; reason: string },
): Promise<{ id: string; status: string }> {
  return db.$transaction(async (tx) => {
    const row = await tx.permitToWork.findUnique({ where: { id: permitId } });
    if (!row) throw notFound("Permit not found");
    const permit = toPermitInput(row);

    let result;
    if (a.action === "APPROVE_LEG") {
      result = approveLeg(permit, a.leg, { by: actor.name ?? actor.id, reason: a.reason, at: new Date() });
    } else {
      result = voidPermit(permit, { by: actor.name ?? actor.id, reason: a.reason, at: new Date() });
    }
    if (result.tag === "err") engineError(result.error);
    const v = result.value;

    const legs = v.legs;
    const updated = await tx.permitToWork.update({
      where: { id: permitId },
      data: {
        status: v.status,
        ehsApprovedBy: legs.EHS?.by ?? null,
        ehsApprovedAt: legs.EHS?.at ?? null,
        ehsApprovedReason: legs.EHS?.reason ?? null,
        maintApprovedBy: legs.MAINTENANCE?.by ?? null,
        maintApprovedAt: legs.MAINTENANCE?.at ?? null,
        maintApprovedReason: legs.MAINTENANCE?.reason ?? null,
        prodApprovedBy: legs.PRODUCTION?.by ?? null,
        prodApprovedAt: legs.PRODUCTION?.at ?? null,
        prodApprovedReason: legs.PRODUCTION?.reason ?? null,
        voidedAt: v.status === "VOID" ? new Date() : null,
        voidedBy: v.status === "VOID" ? (actor.name ?? actor.id) : null,
      },
      select: { id: true, status: true },
    });

    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "PermitToWork",
      entityId: permitId,
      action: a.action,
      details: `${row.permitNo}: ${a.action === "APPROVE_LEG" ? `${a.leg} leg signed` : "voided"} → ${v.status}`,
    });
    return updated;
  });
}

// ---------------------------------------------------------------- production-driven tool wear (C8-9a)

export interface ProductionToolWearOpts {
  workOrderId?: string | null;
  at?: Date;
}

/**
 * C8-9a — Apply machine tool wear from a production LOG_GOOD. Pure projection
 * (`projectProductionToolWear`) applied in one transaction: cycle-counted Tools
 * advance via the engine (warn → RETIRE at max), unit-life MaintenanceTools
 * consume rated life and flip NEEDS_REGRIND at the threshold (the mandatory
 * replace path). Cross-threshold events write a ToolLifeLog row (action CONSUME,
 * woId set) + one TOOL_WEAR audit summary per call.
 */
export async function applyProductionToolWearInTx(
  tx: Tx,
  actor: MaintenanceActor,
  machineId: string,
  units: number,
  opts: ProductionToolWearOpts = {},
): Promise<{ cycles: number; unitsUpdated: number; regrindEvents: number }> {
  if (!Number.isInteger(units) || units <= 0) throw validation("units must be a positive integer");
  const at = opts.at ?? new Date();

  const [cycleTools, unitTools] = await Promise.all([
    tx.tool.findMany({ where: { assignedMachineId: machineId, status: { not: "RETIRED" } } }),
    tx.maintenanceTool.findMany({ where: { machineId, lifeStatus: { not: "SCRAPPED" } } }),
  ]);

  const projection = projectProductionToolWear({
    cycleTools: cycleTools.map((t) => ({
      id: t.id,
      toolCode: t.toolCode,
      maxLifeCycles: t.maxLifeCycles,
      currentCycles: t.currentCycles,
      warningThreshold: t.warningThreshold,
      status: t.status,
    })),
    unitTools: unitTools.map((t) => ({
      id: t.id,
      code: t.code,
      ratedLifeUnits: t.ratedLifeUnits,
      usedUnits: t.usedUnits,
      regrinds: t.regrinds,
      maxRegrinds: t.maxRegrinds,
      lifeStatus: t.lifeStatus as "AVAILABLE" | "IN_USE" | "NEEDS_REGRIND" | "SCRAPPED",
    })),
    units,
    now: at,
  });

  for (const c of projection.cycles) {
    await tx.tool.update({ where: { id: c.id }, data: { currentCycles: c.currentCycles, status: c.status } });
  }

  let regrindEvents = 0;
  for (const u of projection.units) {
    await tx.maintenanceTool.update({
      where: { id: u.id },
      data: { usedUnits: u.usedUnits, lifeStatus: u.lifeStatus, lastChangedAt: at },
    });
    if (u.crossedThreshold) {
      regrindEvents += 1;
      await tx.toolLifeLog.create({
        data: {
          toolId: u.id,
          action: "CONSUME",
          woId: opts.workOrderId ?? null,
          note: `Auto-consumed ${units} units on LOG_GOOD → ${u.lifeStatus}`,
          actor: actor.name ?? actor.id,
          at,
        },
      });
    }
  }

  if (projection.cycles.length > 0 || projection.units.length > 0) {
    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "MACHINE",
      entityId: machineId,
      action: "TOOL_WEAR",
      details: `LOG_GOOD ${units} pcs → ${projection.cycles.length} cycle tools, ${projection.units.length} unit tools (${regrindEvents} crossed threshold)`,
    });
  }

  return { cycles: projection.cycles.length, unitsUpdated: projection.units.length, regrindEvents };
}

/** Standalone variant — own transaction (used by smokes/tests off the shopfloor path). */
export async function applyProductionToolWearTx(
  db: PrismaClient,
  actor: MaintenanceActor,
  machineId: string,
  units: number,
  opts: ProductionToolWearOpts = {},
): Promise<{ cycles: number; unitsUpdated: number; regrindEvents: number }> {
  return db.$transaction((tx) => applyProductionToolWearInTx(tx, actor, machineId, units, opts));
}
// ---------------------------------------------------------------- machine FAULT → BREAKDOWN (C8-9c)

export interface BreakdownScanOpts {
  createJobs?: boolean;
  cooldownMinutes?: number;
}

/**
 * C8-9c — Scan machines currently in FAULT (IoT/Andon) and auto-create a
 * BREAKDOWN MaintenanceJob where none is open (W11: "breakdowns create jobs
 * from machine DOWN events"). Pure detection (`detectBreakdownMachines`) runs
 * first; job creation + audits happen in the same transaction. Re-runnable —
 * an open job suppresses duplicates, and an optional cooldown guards re-open
 * after a recent closure.
 */
export async function scanBreakdownsTx(
  db: PrismaClient,
  actor: MaintenanceActor,
  opts: BreakdownScanOpts = {},
): Promise<{ faultCount: number; candidates: number; createdCount: number; created: string[] }> {
  return db.$transaction(async (tx) => {
    const machines = await tx.machine.findMany({
      where: { currentState: "FAULT" },
      select: { id: true, name: true },
    });
    if (machines.length === 0) return { faultCount: 0, candidates: 0, createdCount: 0, created: [] };

    const machineIds = machines.map((m) => m.id);
    const [openJobs, closedJobs] = await Promise.all([
      tx.maintenanceJob.findMany({
        where: { machineId: { in: machineIds }, type: "BREAKDOWN", status: { in: ["OPEN", "IN_PROGRESS"] } },
        select: { machineId: true },
      }),
      tx.maintenanceJob.findMany({
        where: { machineId: { in: machineIds }, type: "BREAKDOWN", status: "CLOSED", closedAt: { not: null } },
        select: { machineId: true, closedAt: true },
        orderBy: { closedAt: "desc" },
      }),
    ]);

    const openSet = new Set(openJobs.map((j) => j.machineId));
    const lastClosedByMachine = new Map<string, Date>();
    for (const j of closedJobs) {
      if (!lastClosedByMachine.has(j.machineId) && j.closedAt) lastClosedByMachine.set(j.machineId, j.closedAt);
    }

    const scan = detectBreakdownMachines(
      machines.map((m) => ({
        machineId: m.id,
        name: m.name,
        faultState: true,
        hasOpenBreakdown: openSet.has(m.id),
        lastBreakdownClosedAt: lastClosedByMachine.get(m.id) ?? null,
      })),
      { now: new Date(), cooldownMinutes: opts.cooldownMinutes },
    );

    const created: string[] = [];
    if (opts.createJobs) {
      for (const c of scan.candidates) {
        const job = await tx.maintenanceJob.create({
          data: {
            machineId: c.machineId,
            requestedByName: actor.name ?? actor.id,
            type: "BREAKDOWN",
            priority: "HIGH",
            description: `Auto-created from machine FAULT state (${c.name ?? c.machineId})`,
          },
          select: { id: true },
        });
        created.push(job.id);
        await audit(tx, {
          actor: actor.name ?? actor.id,
          entityType: "MaintenanceJob",
          entityId: job.id,
          action: "BREAKDOWN_AUTO_CREATED",
          details: `Machine ${c.name ?? c.machineId} in FAULT with no open breakdown`,
        });
      }
    }

    return { faultCount: machines.length, candidates: scan.candidates.length, createdCount: created.length, created };
  });
}
