/**
 * C9-5 — Typed EHS transaction adapters (F10 guardrails + P27 quota).
 * Pure engine first, then a single-$transaction write with in-tx audit rows.
 * Engine errors surface as typed VALIDATION errors — incidents are
 * append/transition-only: no delete path exists anywhere.
 */

import type { PrismaClient } from "@prisma/client";
import { notFound, validation } from "../core/errors";
import { buildAuditEvent, type AuditEventInput } from "../core/audit";
import {
  validateIncidentReport,
  transitionIncident,
  observationQuotaRows,
  QUOTA_INCIDENT_TYPES,
  type IncidentReportDraftInput,
  type IncidentActionInput,
  type IncidentAction,
  type QuotaManagerRow,
} from "./safety";

type Tx = import("@prisma/client").Prisma.TransactionClient;

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

export interface EhsActor {
  id: string;
  name?: string;
}

function engineError(code: string): never {
  throw validation(code);
}

// ------------------------------------------------------------------ report

export async function reportIncidentTx(
  db: PrismaClient,
  actor: EhsActor,
  draft: IncidentReportDraftInput & { machineId?: string | null },
): Promise<{ id: string; status: string }> {
  const checked = validateIncidentReport(draft);
  if (checked.tag === "err") engineError(checked.error);
  const v = checked.value;

  return db.$transaction(async (tx) => {
    const row = await tx.safetyIncident.create({
      data: {
        type: v.type,
        severity: v.severity,
        status: v.status,
        location: v.location,
        description: v.description,
        reportedBy: actor.name ?? actor.id,
        machineId: draft.machineId ?? null,
      },
      select: { id: true, status: true },
    });
    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "SafetyIncident",
      entityId: row.id,
      action: "CREATE",
      details: `${v.type} (${v.severity}) reported at ${v.location}`,
    });
    return row;
  });
}

// --------------------------------------------------------------- transition

export async function incidentActionTx(
  db: PrismaClient,
  actor: EhsActor,
  incidentId: string,
  action: IncidentAction,
  patch: IncidentActionInput,
): Promise<{ id: string; status: string; closedAt: Date | null }> {
  return db.$transaction(async (tx) => {
    const inc = await tx.safetyIncident.findUnique({ where: { id: incidentId } });
    if (!inc) throw notFound("Safety incident not found");

    const result = transitionIncident(
      {
        id: inc.id,
        type: inc.type,
        severity: inc.severity,
        status: inc.status,
        location: inc.location,
        description: inc.description,
        reportedBy: inc.reportedBy,
        reportedAt: inc.reportedAt,
        capaOwner: inc.capaOwner,
        dueDate: inc.dueDate,
        rootCause: inc.rootCause,
        fiveWhyReason: inc.fiveWhyReason,
        actionTaken: inc.actionTaken,
        closedAt: inc.closedAt,
        closedBy: inc.closedBy,
      },
      action,
      patch,
      actor.name ?? actor.id,
      new Date(),
    );
    if (result.tag === "err") engineError(result.error);
    const v = result.value;

    const updated = await tx.safetyIncident.update({
      where: { id: incidentId },
      data: {
        status: v.status,
        capaOwner: v.capaOwner,
        dueDate: v.dueDate,
        capaDueDate: action === "START_INVESTIGATION" ? v.dueDate : inc.capaDueDate,
        rootCause: v.rootCause,
        fiveWhyReason: v.fiveWhyReason,
        actionTaken: v.actionTaken,
        closedAt: v.closedAt,
        closedBy: v.closedBy,
      },
      select: { id: true, status: true, closedAt: true },
    });

    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "SafetyIncident",
      entityId: incidentId,
      action,
      details:
        action === "CLOSE"
          ? `Incident CLOSED with evidence${v.rootCause ? " (rootCause)" : " (5-Why)"}`
          : `Incident → ${v.status} (CAPA owner: ${v.capaOwner ?? "-"})`,
    });
    return updated;
  });
}

// -------------------------------------------------------------- P27 quota

/**
 * P27 near-miss quota — loads the month's observation incidents and projects
 * per-manager rows through the pure engine. Managers + quota are supplied by
 * the caller (route resolves them from org/settings); one row per manager.
 */
export async function nearMissQuotaTx(
  db: PrismaClient,
  opts: { monthStart: Date; now: Date; managers: string[]; quota: number },
): Promise<{ rows: QuotaManagerRow[]; quota: number; monthStart: Date; counted: number }> {
  const incidents = await db.safetyIncident.findMany({
    where: {
      type: { in: [...QUOTA_INCIDENT_TYPES] },
      reportedAt: { gte: opts.monthStart, lte: opts.now },
    },
    select: { type: true, reportedBy: true, reportedAt: true },
    take: 5000,
  });
  const rows = observationQuotaRows(
    incidents.map((i) => ({ type: i.type, reportedBy: i.reportedBy, reportedAt: i.reportedAt })),
    opts.managers.map((name) => ({ name })),
    opts.quota,
    opts.monthStart,
    opts.now,
  );
  return {
    rows,
    quota: opts.quota,
    monthStart: opts.monthStart,
    counted: incidents.length,
  };
}
