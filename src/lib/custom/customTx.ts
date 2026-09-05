/**
 * C12 — Custom Entities & Records Typed Transaction Adapter (DEPTH_03 F12).
 * Strictly typed database transactions over Prisma:
 *   - createCustomEntityTx, updateCustomEntityTx, getCustomEntitiesTx, getCustomEntityByIdTx
 *   - createCustomRecordTx, updateCustomRecordTx, deleteCustomRecordTx, getCustomRecordsTx
 * Single Prisma $transaction mutations with in-tx auditLog.create via buildAuditEvent.
 */
import type { PrismaClient } from "@prisma/client";
import { buildAuditEvent, type AuditEventInput } from "../core/audit";
import { conflict, notFound } from "../core/errors";
import { slugifyTitle, validateCustomRecordValues } from "./customEngine";
import type { CustomFieldDefinition } from "./customEngine";

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

export interface CustomActor {
  id: string;
  name?: string;
}

export interface CreateCustomFieldInput {
  key: string;
  label: string;
  fieldType: string;
  required?: boolean;
  options?: string[] | null;
  placeholder?: string | null;
  defaultValue?: unknown;
  sortOrder?: number;
}

export interface CreateCustomEntityInput {
  title: string;
  slug?: string | null;
  description?: string | null;
  icon?: string | null;
  colorTone?: string | null;
  fields?: CreateCustomFieldInput[];
}

export interface UpdateCustomEntityInput {
  title?: string;
  description?: string | null;
  icon?: string | null;
  colorTone?: string | null;
  isActive?: boolean;
}

export async function createCustomEntityTx(
  db: PrismaClient,
  input: CreateCustomEntityInput,
  actor: CustomActor,
) {
  const slug = input.slug ? slugifyTitle(input.slug) : slugifyTitle(input.title);

  const existing = await db.customEntity.findUnique({ where: { slug } });
  if (existing) {
    throw conflict(`Custom entity with slug "${slug}" already exists`);
  }

  return await db.$transaction(async (tx) => {
    const entity = await tx.customEntity.create({
      data: {
        slug,
        title: input.title.trim(),
        description: input.description ?? null,
        icon: input.icon ?? "Layers",
        colorTone: input.colorTone ?? "blue",
        createdBy: actor.id,
        fields: {
          create: (input.fields ?? []).map((f, idx) => ({
            key: f.key.trim().toLowerCase(),
            label: f.label.trim(),
            fieldType: f.fieldType,
            required: Boolean(f.required),
            options: f.options ? (f.options as import("@prisma/client").Prisma.InputJsonValue) : undefined,
            placeholder: f.placeholder ?? null,
            sortOrder: f.sortOrder ?? idx,
          })),
        },
      },
      include: {
        fields: { orderBy: { sortOrder: "asc" } },
      },
    });

    await audit(tx, {
      actor: actor.name || actor.id,
      action: "CUSTOM_ENTITY_CREATED",
      entityType: "CustomEntity",
      entityId: entity.id,
      details: JSON.stringify({ slug: entity.slug, fieldCount: entity.fields.length }),
    });

    return entity;
  });
}

export async function updateCustomEntityTx(
  db: PrismaClient,
  id: string,
  input: UpdateCustomEntityInput,
  actor: CustomActor,
) {
  return await db.$transaction(async (tx) => {
    const updated = await tx.customEntity.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.colorTone !== undefined ? { colorTone: input.colorTone } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: {
        fields: { orderBy: { sortOrder: "asc" } },
      },
    });

    await audit(tx, {
      actor: actor.name || actor.id,
      action: "CUSTOM_ENTITY_UPDATED",
      entityType: "CustomEntity",
      entityId: updated.id,
      details: JSON.stringify(input),
    });

    return updated;
  });
}

export async function getCustomEntitiesTx(
  db: PrismaClient,
  opts?: { activeOnly?: boolean },
) {
  return await db.customEntity.findMany({
    where: opts?.activeOnly ? { isActive: true } : undefined,
    include: {
      fields: { orderBy: { sortOrder: "asc" } },
      _count: { select: { records: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCustomEntityByIdTx(db: PrismaClient, id: string) {
  return await db.customEntity.findUnique({
    where: { id },
    include: {
      fields: { orderBy: { sortOrder: "asc" } },
      _count: { select: { records: true } },
    },
  });
}

export interface CreateCustomRecordInput {
  entityId: string;
  values: Record<string, unknown>;
}

export async function createCustomRecordTx(
  db: PrismaClient,
  input: CreateCustomRecordInput,
  actor: CustomActor,
) {
  const entity = await db.customEntity.findUnique({
    where: { id: input.entityId },
    include: { fields: true },
  });

  if (!entity || !entity.isActive) {
    throw notFound("Custom entity not found or inactive");
  }

  const fieldDefs: CustomFieldDefinition[] = entity.fields.map((f) => ({
    key: f.key,
    label: f.label,
    fieldType: f.fieldType,
    required: f.required,
    options: Array.isArray(f.options) ? (f.options as string[]) : null,
    placeholder: f.placeholder,
  }));

  const validationResult = validateCustomRecordValues(fieldDefs, input.values);
  if (validationResult.tag === "err") {
    throw validationResult.error;
  }
  const cleanValues = validationResult.value;

  return await db.$transaction(async (tx) => {
    const record = await tx.customRecord.create({
      data: {
        entityId: entity.id,
        values: cleanValues as import("@prisma/client").Prisma.InputJsonValue,
        createdBy: actor.id,
      },
    });

    await audit(tx, {
      actor: actor.name || actor.id,
      action: "CUSTOM_RECORD_CREATED",
      entityType: entity.slug,
      entityId: record.id,
      details: JSON.stringify({ keys: Object.keys(cleanValues) }),
    });

    return record;
  });
}

export async function updateCustomRecordTx(
  db: PrismaClient,
  recordId: string,
  values: Record<string, unknown>,
  actor: CustomActor,
) {
  const record = await db.customRecord.findUnique({
    where: { id: recordId },
    include: { entity: { include: { fields: true } } },
  });

  if (!record) {
    throw notFound("Custom record not found");
  }

  const fieldDefs: CustomFieldDefinition[] = record.entity.fields.map((f) => ({
    key: f.key,
    label: f.label,
    fieldType: f.fieldType,
    required: f.required,
    options: Array.isArray(f.options) ? (f.options as string[]) : null,
    placeholder: f.placeholder,
  }));

  const existingValues = (record.values as Record<string, unknown>) || {};
  const mergedValues = { ...existingValues, ...values };

  const validationResult = validateCustomRecordValues(fieldDefs, mergedValues);
  if (validationResult.tag === "err") {
    throw validationResult.error;
  }
  const cleanValues = validationResult.value;

  return await db.$transaction(async (tx) => {
    const updated = await tx.customRecord.update({
      where: { id: record.id },
      data: {
        values: cleanValues as import("@prisma/client").Prisma.InputJsonValue,
      },
    });

    await audit(tx, {
      actor: actor.name || actor.id,
      action: "CUSTOM_RECORD_UPDATED",
      entityType: record.entity.slug,
      entityId: updated.id,
      details: JSON.stringify({ updatedKeys: Object.keys(values) }),
    });

    return updated;
  });
}

export async function deleteCustomRecordTx(
  db: PrismaClient,
  recordId: string,
  actor: CustomActor,
) {
  const record = await db.customRecord.findUnique({
    where: { id: recordId },
    include: { entity: true },
  });

  if (!record) {
    throw notFound("Custom record not found");
  }

  return await db.$transaction(async (tx) => {
    await tx.customRecord.delete({
      where: { id: record.id },
    });

    await audit(tx, {
      actor: actor.name || actor.id,
      action: "CUSTOM_RECORD_DELETED",
      entityType: record.entity.slug,
      entityId: record.id,
      details: JSON.stringify({ entityId: record.entityId }),
    });

    return { success: true };
  });
}

export async function getCustomRecordsTx(
  db: PrismaClient,
  entityId: string,
  opts?: { take?: number; skip?: number },
) {
  return await db.customRecord.findMany({
    where: { entityId },
    orderBy: { createdAt: "desc" },
    take: opts?.take ?? 100,
    skip: opts?.skip ?? 0,
  });
}
