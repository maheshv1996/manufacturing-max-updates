/**
 * C12 — Org Reporting Lines & Chart Hierarchy Typed Transaction Adapter (DEPTH_02 §7).
 * Strictly typed database transactions over Prisma:
 *   - createReportingLineTx
 *   - terminateReportingLineTx
 *   - getReportingLinesTx
 *   - getOrgChartHierarchyTx
 * Enforces DAG cycle detection before persistence, single $transaction mutations with in-tx auditLog.create.
 */
import type { PrismaClient } from "@prisma/client";
import { buildAuditEvent, type AuditEventInput } from "../core/audit";
import { validation, notFound } from "../core/errors";
import {
  detectReportingCycle,
  buildOrgHierarchyTree,
  type ReportingLineRecord,
  type OrgUnitRecord,
  type OrgUserRecord,
} from "./reportingLineEngine";

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

export interface ReportingLineActor {
  id: string;
  name?: string;
}

export interface CreateReportingLineInput {
  reportUserId: string;
  managerUserId: string;
  orgUnitId?: string | null;
  validFrom?: Date | string;
  validTo?: Date | string | null;
}

export async function createReportingLineTx(
  db: PrismaClient,
  input: CreateReportingLineInput,
  actor: ReportingLineActor,
) {
  // Load all currently active reporting lines to run DAG cycle check
  const existingRows = await db.reportingLine.findMany({
    where: { validTo: null },
    select: { id: true, reportUserId: true, managerUserId: true },
  });

  const existingLines: ReportingLineRecord[] = existingRows.map((r) => ({
    id: r.id,
    reportUserId: r.reportUserId,
    managerUserId: r.managerUserId,
  }));

  const cycleCheck = detectReportingCycle(
    existingLines,
    input.reportUserId,
    input.managerUserId,
  );

  if (cycleCheck.hasCycle) {
    throw validation(cycleCheck.reason || "Reporting line would introduce a hierarchy cycle.");
  }

  return await db.$transaction(async (tx) => {
    const line = await tx.reportingLine.create({
      data: {
        reportUserId: input.reportUserId,
        managerUserId: input.managerUserId,
        orgUnitId: input.orgUnitId ?? null,
        validFrom: input.validFrom ? new Date(input.validFrom) : new Date(),
        validTo: input.validTo ? new Date(input.validTo) : null,
      },
    });

    await audit(tx, {
      actor: actor.name || actor.id,
      action: "REPORTING_LINE_CREATED",
      entityType: "ReportingLine",
      entityId: line.id,
      details: JSON.stringify({
        reportUserId: line.reportUserId,
        managerUserId: line.managerUserId,
      }),
    });

    return line;
  });
}

export async function terminateReportingLineTx(
  db: PrismaClient,
  id: string,
  actor: ReportingLineActor,
) {
  const line = await db.reportingLine.findUnique({ where: { id } });
  if (!line) {
    throw notFound("Reporting line not found");
  }

  return await db.$transaction(async (tx) => {
    const updated = await tx.reportingLine.update({
      where: { id },
      data: { validTo: new Date() },
    });

    await audit(tx, {
      actor: actor.name || actor.id,
      action: "REPORTING_LINE_TERMINATED",
      entityType: "ReportingLine",
      entityId: updated.id,
      details: JSON.stringify({
        reportUserId: updated.reportUserId,
        managerUserId: updated.managerUserId,
      }),
    });

    return updated;
  });
}

export async function getReportingLinesTx(
  db: PrismaClient,
  filter?: { reportUserId?: string; managerUserId?: string; activeOnly?: boolean },
) {
  return await db.reportingLine.findMany({
    where: {
      ...(filter?.reportUserId ? { reportUserId: filter.reportUserId } : {}),
      ...(filter?.managerUserId ? { managerUserId: filter.managerUserId } : {}),
      ...(filter?.activeOnly ? { validTo: null } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOrgChartHierarchyTx(
  db: PrismaClient,
  _plantId?: string,
) {
  const [units, users, lines] = await Promise.all([
    db.orgUnit.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, parentId: true, headUserId: true },
      orderBy: { code: "asc" },
    }),
    db.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        employeeNumber: true,
        roleAssignments: {
          where: { status: "ACTIVE" },
          select: { orgUnitId: true },
          take: 1,
        },
      },
    }),
    db.reportingLine.findMany({
      where: { validTo: null },
      select: { id: true, reportUserId: true, managerUserId: true, orgUnitId: true },
    }),
  ]);

  const unitRecords: OrgUnitRecord[] = units.map((u) => ({
    id: u.id,
    code: u.code,
    name: u.name,
    parentId: u.parentId,
    headUserId: u.headUserId,
  }));

  const userRecords: OrgUserRecord[] = users.map((u) => ({
    id: u.id,
    name: u.name || u.id,
    employeeNumber: u.employeeNumber,
    orgUnitId: u.roleAssignments[0]?.orgUnitId ?? null,
  }));

  const lineRecords: ReportingLineRecord[] = lines.map((l) => ({
    id: l.id,
    reportUserId: l.reportUserId,
    managerUserId: l.managerUserId,
    orgUnitId: l.orgUnitId,
  }));

  return buildOrgHierarchyTree(unitRecords, userRecords, lineRecords);
}
