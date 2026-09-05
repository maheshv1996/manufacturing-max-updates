/**
 * C2-6 — Typed shopfloor action adapter (DEPTH_04 W2; v1 operator route parity).
 * The DB layer that drives the pure engines (woState / eventLedger / readiness)
 * inside one `$transaction` per action, guarded by the C1 idempotency core when
 * a clientId is present. Server-side gates enforced here, never client-side:
 * fixture gate (reused `checkFixtureGate`), FAI-before-production (G-1, v1
 * parity on LOG_GOOD), WO status transitions via `transitionWoStatus`, counter
 * integrity via `eventLedger` rules.
 *
 * Re-spec deltas vs v1 (recorded in the C2 plan): counters require an open log
 * created by START_JOB (v1 lazily created one); LOG_SCRAP requires a defect
 * code (v1 defaulted DEFECT_GENERIC); COMPLETE_JOB enforces good >= planned
 * unless an authorized override carries a written reason (v1 never checked);
 * REPORT_DOWNTIME errors on an already-open downtime (v1 auto-closed it).
 * Scrap auto-quarantine row creation is kept (v1 parity); the MRB/NCR flow on
 * top is C3's.
 */
import type { PrismaClient, Prisma } from "@prisma/client";
import { AppError, forbidden, notFound, validation } from "../core/errors";
import { runIdempotent } from "../core/integrityDb";
import { buildAuditEvent, type AuditEventInput } from "../core/audit";
import { transitionWoStatus } from "./woState";
import { checkFixtureGate } from "../fixtureGate";

export type JobActionName =
  | "START_JOB"
  | "LOG_GOOD"
  | "LOG_SCRAP"
  | "LOG_REWORK"
  | "REPORT_DOWNTIME"
  | "END_DOWNTIME"
  | "SETUP"
  | "RUN"
  | "CHANGEOVER"
  | "COMPLETE_JOB";

export interface JobActionCommon {
  action: JobActionName;
  /** Actor seat id (route resolves + authorizes). */
  actorId: string;
  actorName?: string;
  /** Idempotency key from the terminal client (X-Client-ID). */
  clientId?: string;
  /** Client clock ms — conflict check against server authority (v1 parity). */
  clientTimestamp?: number;
  at?: Date;
}

export interface JobActionInput extends JobActionCommon {
  workOrderId?: string | null;
  machineId?: string | null;
  operatorId?: string | null;
  shiftId?: string | null;
  qty?: number;
  defectCode?: string;
  reasonId?: string;
  notes?: string | null;
  /** Fixture/complete overrides: route verifies authority, adapter requires the reason. */
  overrideReason?: string;
}

export type JobActionResult =
  | { duplicate: true }
  | { duplicate: false; message: string; workOrderId?: string | null; machineId?: string | null };

type Tx = Prisma.TransactionClient;

async function audit(tx: Tx, actorName: string, input: AuditEventInput): Promise<void> {
  const ev = buildAuditEvent(input);
  await tx.auditLog.create({
    data: {
      actor: ev.actor || actorName,
      action: ev.action,
      entityType: ev.entityType,
      entityId: ev.entityId,
      details: ev.details ?? "",
      at: ev.at,
    },
  });
}

async function assertNoStateConflict(tx: Tx, machineId: string | null | undefined, clientTimestamp?: number): Promise<void> {
  if (!machineId || !clientTimestamp) return;
  const m = await tx.machine.findUnique({ where: { id: machineId }, select: { id: true, name: true, status: true, updatedAt: true } });
  if (m && m.updatedAt.getTime() > clientTimestamp + 3000) {
    throw new AppError("CONFLICT", `State Conflict: Machine '${m.name}' status (${m.status}) was updated by another terminal. Preserved server authority.`, {
      details: { stateConflict: true, serverTimestamp: m.updatedAt.getTime() },
    });
  }
}

/** Guardrail G-1 (v1 parity): LOG_GOOD blocked until an APPROVED FAI exists when the WO requires one. */
async function assertFaiGate(tx: Tx, workOrderId: string): Promise<void> {
  const wo = await tx.workOrder.findUnique({
    where: { id: workOrderId },
    select: { faiRequired: true, faiReports: { select: { status: true } } },
  });
  if (!wo) throw notFound("Work order not found");
  if (wo.faiRequired && !wo.faiReports.some((r) => r.status === "APPROVED")) {
    throw forbidden("An approved FAI report is required before logging production (G-1)");
  }
}

export async function applyJobAction(db: PrismaClient, input: JobActionInput): Promise<JobActionResult> {
  const at = input.at ?? new Date();
  const run = async (): Promise<JobActionResult> => {
    switch (input.action) {
      case "START_JOB": {
        const workOrderId = String(input.workOrderId ?? "").trim();
        const machineId = String(input.machineId ?? "").trim();
        if (!workOrderId || !machineId) throw validation("workOrderId and machineId are required");

        const fixtureGate = await checkFixtureGate(workOrderId);
        if (fixtureGate.blocked && !(input.overrideReason?.trim() ?? "")) {
          throw forbidden(fixtureGate.error ?? "Fixture gate blocked job start", { fixture: fixtureGate.fixture });
        }

        await db.$transaction(async (tx) => {
          await assertNoStateConflict(tx, machineId, input.clientTimestamp);
          const wo = await tx.workOrder.findUnique({
            where: { id: workOrderId },
            select: { id: true, woNumber: true, status: true },
          });
          if (!wo) throw notFound("Work order not found");
          // Readiness (materials/certs/rev/calibration) is asserted by the route
          // before calling; the state engine owns the status gate + fixture gate.
          const overridden = Boolean(input.overrideReason?.trim());
          const gate = transitionWoStatus(wo.status as "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD", {
            action: "START_JOB",
            ready: true,
            // A written manager override releases the fixture gate (v1 parity).
            fixtureOk: !fixtureGate.blocked || overridden,
          });
          if (!gate.ok) throw forbidden(gate.message, { code: gate.code });

          const machine = await tx.machine.findUnique({ where: { id: machineId }, select: { id: true } });
          if (!machine) throw notFound("Machine not found");

          await tx.workOrder.update({ where: { id: workOrderId }, data: { status: "IN_PROGRESS" } });
          await tx.productionLog.create({
            data: {
              workOrderId,
              machineId,
              operatorId: input.operatorId ?? null,
              shiftId: input.shiftId ?? null,
              goodQuantity: 0,
              scrapQuantity: 0,
              reworkQuantity: 0,
              startTime: at,
            },
          });
          await tx.machine.update({ where: { id: machineId }, data: { status: "RUNNING" } });
          await audit(tx, input.actorName ?? "Operator", {
            actor: input.actorId,
            action: "START_JOB",
            entityType: "MACHINE",
            entityId: machineId,
            details: `Started job for WO ${wo.woNumber} on machine ${machineId}`,
          });
        });
        return { duplicate: false, message: "Job started", workOrderId, machineId };
      }

      case "LOG_GOOD":
      case "LOG_SCRAP":
      case "LOG_REWORK": {
        const workOrderId = String(input.workOrderId ?? "").trim();
        const machineId = String(input.machineId ?? "").trim();
        const qty = input.qty;
        if (!workOrderId || !machineId || !Number.isInteger(qty) || (qty ?? 0) <= 0) {
          throw validation("workOrderId, machineId and a positive integer qty are required");
        }
        if (input.action === "LOG_SCRAP" && !(input.defectCode?.trim() ?? "")) {
          throw validation("defectCode is required for LOG_SCRAP");
        }          await db.$transaction(async (tx) => {
          await assertNoStateConflict(tx, machineId, input.clientTimestamp);
          if (input.action === "LOG_GOOD") await assertFaiGate(tx, workOrderId);

          const log = await tx.productionLog.findFirst({
            where: { workOrderId, machineId, endTime: null },
            orderBy: { startTime: "desc" },
          });
          // eventLedger rule: counters mutate only an open log (strict parity re-spec).
          if (!log) {
            throw validation("No open production log on this machine — START_JOB first");
          }

          if (input.action === "LOG_GOOD") {
            await tx.productionLog.update({ where: { id: log.id }, data: { goodQuantity: { increment: qty } } });
          } else if (input.action === "LOG_SCRAP") {
            await tx.productionLog.update({ where: { id: log.id }, data: { scrapQuantity: { increment: qty } } });
            await tx.scrapQuarantine.create({
              data: {
                workOrderId,
                quantity: qty as number,
                defectCode: input.defectCode as string,
                loggedBy: input.actorName ?? "Operator",
              },
            });
          } else {
            await tx.productionLog.update({ where: { id: log.id }, data: { reworkQuantity: { increment: qty } } });
          }

          await audit(tx, input.actorName ?? "Operator", {
            actor: input.actorId,
            action: input.action,
            entityType: "WORK_ORDER",
            entityId: workOrderId,
            details: `${input.action} qty=${qty} on machine ${machineId}`,
          });
        });
        return { duplicate: false, message: `${input.action} recorded`, workOrderId, machineId };
      }

      case "REPORT_DOWNTIME": {
        const machineId = String(input.machineId ?? "").trim();
        const reasonId = String(input.reasonId ?? "").trim();
        if (!machineId || !reasonId) throw validation("machineId and reasonId are required");

        await db.$transaction(async (tx) => {
          await assertNoStateConflict(tx, machineId, input.clientTimestamp);
          const open = await tx.downtimeLog.findFirst({ where: { machineId, endTime: null } });
          if (open) throw validation("A downtime is already open on this machine — END_DOWNTIME first");
          const reason = await tx.downtimeReason.findUnique({ where: { id: reasonId }, select: { id: true } });
          if (!reason) throw notFound("Downtime reason not found");

          const log = await tx.downtimeLog.create({
            data: {
              machineId,
              workOrderId: input.workOrderId ?? null,
              reasonId,
              operatorId: input.operatorId ?? null,
              startTime: at,
              endTime: null,
              notes: input.notes ?? null,
            },
            select: { id: true },
          });
          await tx.machine.update({ where: { id: machineId }, data: { status: "DOWN" } });
          await audit(tx, input.actorName ?? "Operator", {
            actor: input.actorId,
            action: "REPORT_DOWNTIME",
            entityType: "MACHINE",
            entityId: machineId,
            details: `Downtime ${log.id} reason ${reasonId}`,
          });
        });
        return { duplicate: false, message: "Downtime reported", machineId, workOrderId: input.workOrderId ?? null };
      }

      case "END_DOWNTIME": {
        const machineId = String(input.machineId ?? "").trim();
        if (!machineId) throw validation("machineId is required");

        await db.$transaction(async (tx) => {
          const open = await tx.downtimeLog.findFirst({ where: { machineId, endTime: null }, orderBy: { startTime: "desc" } });
          if (!open) throw validation("No open downtime to end");
          const durationMinutes = Math.max(1, Math.round((at.getTime() - open.startTime.getTime()) / 60000));
          await tx.downtimeLog.update({
            where: { id: open.id },
            data: { endTime: at, durationMinutes },
          });
          await tx.machine.update({ where: { id: machineId }, data: { status: "RUNNING" } });
          await audit(tx, input.actorName ?? "Operator", {
            actor: input.actorId,
            action: "END_DOWNTIME",
            entityType: "MACHINE",
            entityId: machineId,
            details: `Ended downtime ${open.id} (${durationMinutes} min)`,
          });
        });
        return { duplicate: false, message: "Downtime resolved", machineId };
      }

      case "SETUP":
      case "RUN":
      case "CHANGEOVER": {
        const machineId = String(input.machineId ?? "").trim();
        if (!machineId) throw validation("machineId is required");
        const machineStatus: Record<"SETUP" | "RUN" | "CHANGEOVER", string> = {
          SETUP: "SETUP",
          RUN: "RUNNING",
          CHANGEOVER: "SETUP",
        };
        await db.$transaction(async (tx) => {
          await assertNoStateConflict(tx, machineId, input.clientTimestamp);
          const m = await tx.machine.findUnique({ where: { id: machineId }, select: { id: true } });
          if (!m) throw notFound("Machine not found");
          // v1 parity: SETUP/CHANGEOVER close open production + downtime logs
          // (setup is productive activity, not run time).
          if (input.action !== "RUN") {
            await tx.productionLog.updateMany({ where: { machineId, endTime: null }, data: { endTime: at } });
            await tx.downtimeLog.updateMany({ where: { machineId, endTime: null }, data: { endTime: at } });
          }
          await tx.machine.update({
            where: { id: machineId },
            data: { status: machineStatus[input.action as "SETUP" | "RUN" | "CHANGEOVER"], currentState: input.action === "RUN" ? "RUNNING" : "SETUP" },
          });
          await audit(tx, input.actorName ?? "Operator", {
            actor: input.actorId,
            action: input.action,
            entityType: "MACHINE",
            entityId: machineId,
            details: `${input.action} on machine ${machineId}`,
          });
        });
        return { duplicate: false, message: input.action, machineId };
      }

      case "COMPLETE_JOB": {
        const workOrderId = String(input.workOrderId ?? "").trim();
        const machineId = input.machineId ? String(input.machineId).trim() : null;
        if (!workOrderId) throw validation("workOrderId is required");

        await db.$transaction(async (tx) => {
          await assertNoStateConflict(tx, machineId, input.clientTimestamp);
          const wo = await tx.workOrder.findUnique({
            where: { id: workOrderId },
            select: { id: true, woNumber: true, status: true, plannedQuantity: true },
          });
          if (!wo) throw notFound("Work order not found");
          const agg = await tx.productionLog.aggregate({
            where: { workOrderId },
            _sum: { goodQuantity: true },
          });
          const goodTotal = agg._sum.goodQuantity ?? 0;
          const gate = transitionWoStatus(
            wo.status as "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD",
            {
              action: "COMPLETE",
              goodQuantity: goodTotal,
              plannedQuantity: wo.plannedQuantity,
              override: Boolean(input.overrideReason?.trim()),
            },
          );
          if (!gate.ok) throw validation(gate.message, { code: gate.code, goodTotal, plannedQuantity: wo.plannedQuantity });

          await tx.workOrder.update({ where: { id: workOrderId }, data: { status: "COMPLETED" } });
          await tx.productionLog.updateMany({ where: { workOrderId, endTime: null }, data: { endTime: at } });
          if (machineId) {
            await tx.downtimeLog.updateMany({ where: { machineId, endTime: null }, data: { endTime: at } });
            await tx.machine.update({ where: { id: machineId }, data: { status: "IDLE" } });
          }
          await audit(tx, input.actorName ?? "Operator", {
            actor: input.actorId,
            action: "COMPLETE_JOB",
            entityType: "WORK_ORDER",
            entityId: workOrderId,
            details: `Completed WO ${wo.woNumber} (good=${goodTotal}/${wo.plannedQuantity})${input.overrideReason ? ` — override: ${input.overrideReason}` : ""}`,
          });
        });
        return { duplicate: false, message: "Work order completed", workOrderId, machineId };
      }
    }
  };

  const clientId = input.clientId?.trim() || undefined;
  if (!clientId) return run();
  const outcome = await runIdempotent(db, { clientId, scope: `shopfloor:${input.action}` }, run);
  return outcome.applied ? outcome.value : { duplicate: true };
}
