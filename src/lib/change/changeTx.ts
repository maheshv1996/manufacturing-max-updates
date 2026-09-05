/**
 * C4-4 — Typed change-control adapter (DEPTH_04 W7; G-5 revision-as-law).
 * ECO transitions and document revision issues run the pure engines first,
 * then write inside one `$transaction`, guarded by the C1 idempotency core,
 * with in-tx audits. Issuing a document revision archives the superseded
 * row (status ARCHIVED, no delete) — revision law, not overwrite.
 */
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { AppError, notFound, validation } from "../core/errors";
import { runIdempotent } from "../core/integrityDb";
import { buildAuditEvent, type AuditEventInput } from "../core/audit";
import { transitionEco, type EcoStatus, type EcoActionCtx, type EcoEffectivityType } from "./eco";
import { issueRevision } from "./documentRev";

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

export interface ChangeActor {
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

export interface EcoItemInput {
  entityType: "BOM" | "DRAWING" | "ROUTING";
  productId: string;
  action: "REPLACE" | "ADD" | "REMOVE";
  oldData?: unknown;
  newData?: unknown;
  notes?: string;
}

export interface CreateEcoInput {
  actor: ChangeActor;
  clientId?: string;
  ecoNumber: string;
  title: string;
  description: string;
  raisedBy: string;
  effectivityType?: EcoEffectivityType;
  items: EcoItemInput[];
}

export async function createEco(db: PrismaClient, input: CreateEcoInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      if (input.items.length === 0) throw validation("an ECO needs at least one change item");
      const created = await tx.eco.create({
        data: {
          ecoNumber: input.ecoNumber,
          title: input.title,
          description: input.description,
          raisedBy: input.raisedBy,
          status: "DRAFT",
          effectivityType: input.effectivityType ?? "DATE",
          effectivityValue: "",
          items: {
            create: input.items.map((it) => ({
              entityType: it.entityType,
              productId: it.productId,
              action: it.action,
              oldData: it.oldData === undefined ? Prisma.JsonNull : (it.oldData as Prisma.InputJsonValue),
              newData: it.newData === undefined ? Prisma.JsonNull : (it.newData as Prisma.InputJsonValue),
              notes: it.notes ?? null,
            })),
          },
        },
        select: { id: true, ecoNumber: true, status: true },
      });
      await audit(tx, input.actor.name ?? "Engineering", {
        actor: input.actor.id,
        action: "ECO_CREATED",
        entityType: "Eco",
        entityId: created.id,
        details: JSON.stringify({ ecoNumber: created.ecoNumber, items: input.items.length }),
      });
      return created;
    });
  const r = await withIdempotency(db, input.clientId, "change:eco:create", run);
  return r.duplicate ? { duplicate: true } : r.value;
}

export interface EcoTransitionInput {
  actor: ChangeActor;
  clientId?: string;
  ecoId: string;
  action: EcoActionCtx;
}

export async function transitionEcoTx(db: PrismaClient, input: EcoTransitionInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const eco = await tx.eco.findUnique({
        where: { id: input.ecoId },
        select: { id: true, ecoNumber: true, status: true, _count: { select: { items: true } } },
      });
      if (!eco) throw notFound("ECO not found");
      const status = eco.status as EcoStatus;
      const ctx: EcoActionCtx =
        input.action.action === "APPROVE"
          ? {
              action: "APPROVE",
              itemCount: eco._count.items,
              effectivityType: input.action.effectivityType,
              effectivityValue: input.action.effectivityValue,
            }
          : input.action;
      const gate = transitionEco(status, ctx);
      if (!gate.ok) throw new AppError("VALIDATION", gate.message, { details: { code: gate.code } });

      const data: Prisma.EcoUpdateInput = { status: gate.status };
      if (gate.status === "APPROVED" && input.action.action === "APPROVE") {
        data.effectivityType = input.action.effectivityType;
        data.effectivityValue = input.action.effectivityValue.trim();
        data.approvedBy = input.actor.name ?? input.actor.id;
        data.approvedAt = new Date();
      }
      if (gate.status === "IMPLEMENTED") data.implementedAt = new Date();
      const updated = await tx.eco.update({ where: { id: eco.id }, data, select: { id: true, ecoNumber: true, status: true } });

      await audit(tx, input.actor.name ?? "Engineering", {
        actor: input.actor.id,
        action: `ECO_${gate.status}`,
        entityType: "Eco",
        entityId: eco.id,
        details:
          input.action.action === "APPROVE"
            ? `effectivity ${input.action.effectivityType}=${input.action.effectivityValue}`
            : input.action.action === "REJECT"
              ? `rejected: ${input.action.note}`
              : `implemented${input.action.note ? `: ${input.action.note}` : ""}`,
      });
      return updated;
    });
  const r = await withIdempotency(db, input.clientId, `change:eco:${input.action.action}`, run);
  return r.duplicate ? { duplicate: true } : r.value;
}

export interface IssueDocumentRevInput {
  actor: ChangeActor;
  clientId?: string;
  documentId: string;
  newVersion: number;
  uploadedBy?: string;
}

export async function issueDocumentRevTx(db: PrismaClient, input: IssueDocumentRevInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const doc = await tx.document.findUnique({
        where: { id: input.documentId },
        select: { id: true, title: true, version: true, status: true },
      });
      if (!doc) throw notFound("Document not found");
      const gate = issueRevision(String(doc.version), String(input.newVersion));
      if (!gate.ok) throw new AppError("VALIDATION", gate.message, { details: { code: gate.code } });

      // Revision law: the superseded row is archived, never deleted or overwritten.
      await tx.document.update({ where: { id: doc.id }, data: { status: "ARCHIVED" } });
      const created = await tx.document.create({
        data: {
          title: doc.title,
          productId: (await tx.document.findUnique({ where: { id: doc.id }, select: { productId: true } }))?.productId ?? "",
          version: input.newVersion,
          mimeType: "application/octet-stream",
          fileData: Buffer.alloc(0),
          sizeKb: 0,
          status: "CURRENT",
          uploadedBy: input.uploadedBy ?? input.actor.name ?? "Engineering",
          notes: `Supersedes version ${doc.version}`,
        },
        select: { id: true, version: true, status: true },
      });
      await audit(tx, input.actor.name ?? "Engineering", {
        actor: input.actor.id,
        action: "DOC_REV_ISSUED",
        entityType: "Document",
        entityId: created.id,
        details: `${doc.title}: v${doc.version} archived, v${created.version} CURRENT`,
      });
      return created;
    });
  const r = await withIdempotency(db, input.clientId, "change:document:issue", run);
  return r.duplicate ? { duplicate: true } : r.value;
}