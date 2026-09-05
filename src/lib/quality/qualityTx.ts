/**
 * C3-6 — Typed quality transaction adapter (DEPTH_04 W5/W6; guardrails G-1,
 * G-3, G-6). Every mutation runs the pure engine first and only then writes,
 * inside one `$transaction`, guarded by the C1 idempotency core when a
 * clientId is present, with in-tx audit rows. No `as any`; the engine is the
 * only source of truth for transitions.
 */
import type { PrismaClient, Prisma } from "@prisma/client";
import { AppError, notFound, validation } from "../core/errors";
import { runIdempotent } from "../core/integrityDb";
import { buildAuditEvent, type AuditEventInput } from "../core/audit";
import { transitionNcr, type NcrActionCtx, type NcrStatus } from "./ncrState";
import { advanceEightD, type EightDEvidence, type EightDStage } from "./eightD";
import { transitionFai, type FaiActionCtx, type FaiStatus } from "./fai";
import { releasePackage, mutatePackage, type ReleaseInput } from "./dataPackage";
import { assertInstrumentUsable } from "./inspectionGate";

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

export interface QualityActor {
  id: string;
  name?: string;
}

async function withIdempotency<T>(
  db: PrismaClient,
  clientId: string | undefined,
  scope: string,
  fn: () => Promise<T>,
): Promise<{ duplicate: boolean; value?: T }> {
  if (!clientId?.trim()) return { duplicate: false, value: await fn() };
  const r = await runIdempotent(db, { clientId, scope }, fn);
  return r.applied ? { duplicate: false, value: r.value } : { duplicate: true };
}

const castStatus = <T extends string>(s: string, allowed: readonly T[]): T => {
  if (!(allowed as readonly string[]).includes(s)) throw validation(`Unknown status ${s}`);
  return s as T;
};

// ---------------------------------------------------------------- NCR ----

export interface CreateNcrInput {
  actor: QualityActor;
  clientId?: string;
  ncrNumber: string;
  quarantineId?: string;
  workOrderId?: string;
  productId?: string;
  quantity: number;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  raisedBy: string;
}

export async function createNcr(db: PrismaClient, input: CreateNcrInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const qty = Number(input.quantity);
      if (!Number.isFinite(qty) || qty <= 0) throw validation("quantity must be a positive number");
      const created = await tx.ncrReport.create({
        data: {
          ncrNumber: input.ncrNumber,
          quarantineId: input.quarantineId ?? null,
          workOrderId: input.workOrderId ?? null,
          productId: input.productId ?? null,
          quantity: qty,
          severity: input.severity ?? "MEDIUM",
          description: input.description,
          raisedBy: input.raisedBy,
          status: "OPEN",
        },
        select: { id: true, ncrNumber: true, status: true },
      });
      await audit(tx, input.actor.name ?? "QC", {
        actor: input.actor.id,
        action: "NCR_CREATED",
        entityType: "NcrReport",
        entityId: created.id,
        details: JSON.stringify({ ncrNumber: created.ncrNumber, quantity: qty }),
      });
      return created;
    });
  const r = await withIdempotency(db, input.clientId, "quality:ncr:create", run);
  return r.duplicate ? { duplicate: true } : r.value;
}

export interface NcrTransitionInput {
  actor: QualityActor;
  clientId?: string;
  ncrId: string;
  action: NcrActionCtx;
}

export async function transitionNcrTx(db: PrismaClient, input: NcrTransitionInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const ncr = await tx.ncrReport.findUnique({
        where: { id: input.ncrId },
        select: { id: true, ncrNumber: true, status: true, disposition: true },
      });
      if (!ncr) throw notFound("NCR not found");
      const gate = transitionNcr(castStatus<NcrStatus>(ncr.status, ["OPEN", "UNDER_REVIEW", "DISPOSITIONED", "CLOSED"]), input.action);
      if (!gate.ok) throw new AppError("VALIDATION", gate.message, { details: { code: gate.code } });

      const data: Prisma.NcrReportUpdateInput = { status: gate.status };
      if (input.action.action === "DISPOSE") {
        data.disposition = input.action.disposition;
        data.dispositionAuthority = input.action.authority;
      }
      if (gate.status === "CLOSED") data.closedAt = new Date();
      const updated = await tx.ncrReport.update({ where: { id: ncr.id }, data, select: { id: true, status: true } });

      const detail =
        input.action.action === "DISPOSE"
          ? `dispose ${input.action.disposition} by ${input.action.authority}: ${input.action.justification}`
          : input.action.action === "CLOSE"
            ? `closed: ${input.action.closeNote}`
            : "review started";
      await audit(tx, input.actor.name ?? "QC", {
        actor: input.actor.id,
        action: `NCR_${input.action.action}`,
        entityType: "NcrReport",
        entityId: ncr.id,
        details: detail,
      });
      return updated;
    });
  const r = await withIdempotency(db, input.clientId, `quality:ncr:${input.action.action}`, run);
  return r.duplicate ? { duplicate: true } : r.value;
}

// --------------------------------------------------------------- 8D ----

export interface EightDAdvanceInput {
  actor: QualityActor;
  clientId?: string;
  eightDId: string;
  evidence: EightDEvidence;
  reviewed?: boolean;
}

export async function advanceEightDTx(db: PrismaClient, input: EightDAdvanceInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const e = await tx.eightDReport.findUnique({
        where: { id: input.eightDId },
        select: {
          id: true,
          status: true,
          containmentAction: true,
          rootCauseSummary: true,
          correctiveAction: true,
          preventiveAction: true,
          verificationMethod: true,
        },
      });
      if (!e) throw notFound("8D report not found");
      const current = castStatus<EightDStage>(
        e.status,
        ["D1_TEAM", "D2_PROBLEM", "D3_CONTAINMENT", "D4_ROOT_CAUSE", "D5_CORRECTIVE", "D6_PREVENTIVE", "D7_VERIFY", "D8_CLOSURE", "CLOSED"],
      );
      // Merge persisted evidence with the incoming evidence (persisted wins on truth).
      const evidence: EightDEvidence = {
        containmentRecorded: Boolean(input.evidence.containmentRecorded || e.containmentAction),
        d4RootCause: input.evidence.d4RootCause ?? e.rootCauseSummary ?? "",
        d5Corrective: input.evidence.d5Corrective ?? e.correctiveAction ?? "",
        d6Preventive: input.evidence.d6Preventive ?? e.preventiveAction ?? "",
        d7Verification: input.evidence.d7Verification ?? e.verificationMethod ?? "",
      };
      const gate = advanceEightD(current, evidence, { reviewed: input.reviewed });
      if (!gate.ok) throw new AppError("VALIDATION", gate.message, { details: { code: gate.code, missing: gate.missing } });

      const data: Prisma.EightDReportUpdateInput = { status: gate.status };
      if (input.evidence.containmentRecorded) data.containmentAction = data.containmentAction ?? "recorded";
      if (input.evidence.d4RootCause) data.rootCauseSummary = input.evidence.d4RootCause;
      if (input.evidence.d5Corrective) data.correctiveAction = input.evidence.d5Corrective;
      if (input.evidence.d6Preventive) data.preventiveAction = input.evidence.d6Preventive;
      if (input.evidence.d7Verification) data.verificationMethod = input.evidence.d7Verification;
      const updated = await tx.eightDReport.update({ where: { id: e.id }, data, select: { id: true, status: true } });

      await audit(tx, input.actor.name ?? "QC", {
        actor: input.actor.id,
        action: "EIGHT_D_ADVANCED",
        entityType: "EightDReport",
        entityId: e.id,
        details: `${current} -> ${gate.status}`,
      });
      return updated;
    });
  const r = await withIdempotency(db, input.clientId, "quality:eightd:advance", run);
  return r.duplicate ? { duplicate: true } : r.value;
}

// --------------------------------------------------------------- FAI ----

export interface CreateFaiInput {
  actor: QualityActor;
  clientId?: string;
  faiNumber: string;
  workOrderId: string;
  productId: string;
  drawingRevision?: string;
  preparedBy: string;
  /** Characteristics to create on this report (≥1 for a meaningful report). */
  characteristics: Array<{ charNo: string; description: string; target?: number | null; lsl?: number | null; usl?: number | null; actual?: number | null; pass: boolean }>;
}

export async function createFai(db: PrismaClient, input: CreateFaiInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      if (input.characteristics.length === 0) throw validation("at least one characteristic is required");
      const created = await tx.faiReport.create({
        data: {
          faiNumber: input.faiNumber,
          workOrderId: input.workOrderId,
          productId: input.productId,
          drawingRevision: input.drawingRevision ?? null,
          preparedBy: input.preparedBy,
          status: "IN_PROGRESS",
          characteristics: {
            create: input.characteristics.map((c) => ({
              charNo: c.charNo,
              description: c.description,
              target: c.target ?? null,
              lsl: c.lsl ?? null,
              usl: c.usl ?? null,
              actual: c.actual ?? null,
              status: c.pass ? "PASS" : "FAIL",
            })),
          },
        },
        select: { id: true, faiNumber: true, status: true },
      });
      await audit(tx, input.actor.name ?? "QC", {
        actor: input.actor.id,
        action: "FAI_CREATED",
        entityType: "FaiReport",
        entityId: created.id,
        details: JSON.stringify({ faiNumber: created.faiNumber, characteristics: input.characteristics.length }),
      });
      return created;
    });
  const r = await withIdempotency(db, input.clientId, "quality:fai:create", run);
  return r.duplicate ? { duplicate: true } : r.value;
}

export interface FaiTransitionInput {
  actor: QualityActor;
  clientId?: string;
  faiId: string;
  /** The engine loads characteristics from the DB itself; the route only picks the action. */
  action: { action: "SUBMIT" } | { action: "DECIDE"; approve: boolean };
  /** charNos whose FAIL carries an approved deviation justification (SUBMIT). */
  justifiedCharNos?: string[];
}

export async function transitionFaiTx(db: PrismaClient, input: FaiTransitionInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const fai = await tx.faiReport.findUnique({
        where: { id: input.faiId },
        select: {
          id: true,
          faiNumber: true,
          status: true,
          characteristics: { select: { id: true, charNo: true, status: true } },
        },
      });
      if (!fai) throw notFound("FAI report not found");
      const justified = new Set(input.justifiedCharNos ?? []);
      const chars = fai.characteristics.map((c) => ({
        id: c.charNo,
        pass: c.status === "PASS",
        deviationJustified: justified.has(c.charNo),
      }));
      const engineCtx: FaiActionCtx =
        input.action.action === "SUBMIT"
          ? { action: "SUBMIT", characteristics: chars }
          : { action: "DECIDE", approve: input.action.approve };
      const gate = transitionFai(castStatus<FaiStatus>(fai.status, ["IN_PROGRESS", "SUBMITTED", "APPROVED", "REJECTED"]), engineCtx);
      if (!gate.ok) throw new AppError("VALIDATION", gate.message, { details: { code: gate.code, characteristics: gate.characteristics } });

      const data: Prisma.FaiReportUpdateInput = { status: gate.status };
      if (gate.status === "APPROVED" || gate.status === "REJECTED") {
        data.approvedBy = input.actor.name ?? input.actor.id;
        data.approvedAt = new Date();
      }
      const updated = await tx.faiReport.update({ where: { id: fai.id }, data, select: { id: true, status: true } });
      await audit(tx, input.actor.name ?? "QC", {
        actor: input.actor.id,
        action: `FAI_${gate.status}`,
        entityType: "FaiReport",
        entityId: fai.id,
        details: `${fai.faiNumber} -> ${gate.status}`,
      });
      return updated;
    });
  const r = await withIdempotency(db, input.clientId, "quality:fai:transition", run);
  return r.duplicate ? { duplicate: true } : r.value;
}

// ------------------------------------------------------ Data package ----

export interface CreateDataPackageInput {
  actor: QualityActor;
  clientId?: string;
  packageNumber: string;
  workOrderId: string;
  snapshot?: unknown;
}

export async function createDataPackage(db: PrismaClient, input: CreateDataPackageInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const created = await tx.dataPackage.create({
        data: {
          packageNumber: input.packageNumber,
          workOrderId: input.workOrderId,
          snapshot: (input.snapshot ?? {}) as object,
          createdBy: input.actor.id,
          status: "DRAFT",
        },
        select: { id: true, packageNumber: true, status: true },
      });
      await audit(tx, input.actor.name ?? "QC", {
        actor: input.actor.id,
        action: "DATA_PACKAGE_CREATED",
        entityType: "DataPackage",
        entityId: created.id,
        details: created.packageNumber,
      });
      return created;
    });
  const r = await withIdempotency(db, input.clientId, "quality:datapackage:create", run);
  return r.duplicate ? { duplicate: true } : r.value;
}

export interface ReleaseDataPackageInput {
  actor: QualityActor;
  clientId?: string;
  packageId: string;
  /** Completeness gates — route assembles from DB (FAI state, certs, contents). */
  gates: ReleaseInput;
}

export async function releaseDataPackageTx(db: PrismaClient, input: ReleaseDataPackageInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const pkg = await tx.dataPackage.findUnique({
        where: { id: input.packageId },
        select: { id: true, packageNumber: true, status: true },
      });
      if (!pkg) throw notFound("Data package not found");
      const gate = releasePackage(input.gates);
      if (!gate.ok) throw new AppError("VALIDATION", gate.message, { details: { code: gate.code } });
      if (pkg.status !== "DRAFT") throw validation("Only a DRAFT package can be released");

      const updated = await tx.dataPackage.update({
        where: { id: pkg.id },
        data: { status: "RELEASED", releasedBy: input.actor.id, releasedAt: new Date() },
        select: { id: true, packageNumber: true, status: true },
      });
      await audit(tx, input.actor.name ?? "QC", {
        actor: input.actor.id,
        action: "DATA_PACKAGE_RELEASED",
        entityType: "DataPackage",
        entityId: pkg.id,
        details: JSON.stringify({ packageNumber: updated.packageNumber, gates: input.gates }),
      });
      return updated;
    });
  const r = await withIdempotency(db, input.clientId, "quality:datapackage:release", run);
  return r.duplicate ? { duplicate: true } : r.value;
}

export interface MutateDataPackageInput {
  actor: QualityActor;
  clientId?: string;
  packageId: string;
  newRevision?: boolean;
  snapshot?: unknown;
}

export async function mutateDataPackageTx(db: PrismaClient, input: MutateDataPackageInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const pkg = await tx.dataPackage.findUnique({
        where: { id: input.packageId },
        select: { id: true, packageNumber: true, status: true, snapshot: true },
      });
      if (!pkg) throw notFound("Data package not found");
      const gate = mutatePackage(pkg.status as "DRAFT" | "RELEASED", { newRevision: input.newRevision });
      if (!gate.ok) throw new AppError("VALIDATION", gate.message, { details: { code: gate.code } });

      const updated = await tx.dataPackage.update({
        where: { id: pkg.id },
        data: { snapshot: (input.snapshot ?? pkg.snapshot ?? {}) as object },
        select: { id: true, packageNumber: true, status: true },
      });
      await audit(tx, input.actor.name ?? "QC", {
        actor: input.actor.id,
        action: input.newRevision ? "DATA_PACKAGE_REVISED" : "DATA_PACKAGE_UPDATED",
        entityType: "DataPackage",
        entityId: pkg.id,
        details: updated.packageNumber,
      });
      return updated;
    });
  const r = await withIdempotency(db, input.clientId, "quality:datapackage:mutate", run);
  return r.duplicate ? { duplicate: true } : r.value;
}

// ---------------------------------------------------------------- inspections (C8-9b G-4 gate)

export interface CreateInspectionInput {
  actor: QualityActor;
  clientId?: string;
  workOrderId: string;
  inspectorId?: string;
  totalInspected: number;
  passed: number;
  failed: number;
  defectCodeId?: string;
  /** The recording instrument — G-4 requires it to be usable for measurement now. */
  calibratedToolId?: string;
  notes?: string;
}

export async function createInspectionTx(db: PrismaClient, input: CreateInspectionInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const total = Number(input.totalInspected);
      const passed = Number(input.passed);
      const failed = Number(input.failed);
      if (!Number.isInteger(total) || total <= 0) throw validation("totalInspected must be a positive integer");
      if (!Number.isInteger(passed) || passed < 0) throw validation("passed must be a non-negative integer");
      if (!Number.isInteger(failed) || failed < 0) throw validation("failed must be a non-negative integer");
      if (passed + failed > total) throw validation("passed + failed cannot exceed totalInspected");

      const wo = await tx.workOrder.findUnique({ where: { id: input.workOrderId }, select: { id: true } });
      if (!wo) throw notFound("Work order not found");

      // G-4 (C8-9b): an EXPIRED / RETIRED / QUARANTINED / non-ACTIVE instrument can
      // never record a measurement — enforced here at the data boundary, not just UI.
      if (input.calibratedToolId) {
        const inst = await tx.calibratedTool.findUnique({ where: { id: input.calibratedToolId } });
        if (!inst) throw notFound("Instrument not found");
        const gate = assertInstrumentUsable(
          {
            id: inst.id,
            serialNumber: inst.serialNumber,
            calibratedAt: inst.calibratedAt,
            expiresAt: inst.expiresAt,
            location: inst.location as "LAB_CABINET" | "WITH_OPERATOR" | "SHOPFLOOR" | "QUARANTINE",
            lifecycle: inst.lifecycle as "PROCUREMENT" | "ACTIVE" | "RETIRED",
          },
          new Date(),
        );
        if (!gate.ok) {
          throw validation(`Instrument ${inst.serialNumber} cannot record this inspection: ${gate.message} (G-4)`);
        }
      }

      const created = await tx.qualityInspection.create({
        data: {
          workOrderId: input.workOrderId,
          inspectorId: input.inspectorId ?? null,
          totalInspected: total,
          passed,
          failed,
          defectCodeId: input.defectCodeId ?? null,
          calibratedToolId: input.calibratedToolId ?? null,
          notes: input.notes ?? null,
        },
        select: { id: true, workOrderId: true, totalInspected: true, passed: true, failed: true },
      });
      await audit(tx, input.actor.name ?? "QC", {
        actor: input.actor.id,
        action: "INSPECTION_CREATED",
        entityType: "QualityInspection",
        entityId: created.id,
        details: JSON.stringify({
          workOrderId: created.workOrderId,
          total: created.totalInspected,
          passed: created.passed,
          failed: created.failed,
        }),
      });
      return created;
    });
  const r = await withIdempotency(db, input.clientId, "quality:inspection:create", run);
  return r.duplicate ? { duplicate: true } : r.value;
}