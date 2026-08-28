import { prisma } from "./prisma";

export interface OverrideData {
  entityType: string;
  entityId: string;
  field: string;
  value: number;
  note?: string;
  byName: string;
}

/** Get all overrides for an entity, or all overrides in the system if no arguments */
export async function getOverrides(entityType?: string, entityId?: string) {
  if (entityType && entityId) {
    return (prisma as any).override.findMany({
      where: { entityType, entityId },
    });
  }
  if (entityType) {
    return (prisma as any).override.findMany({
      where: { entityType },
    });
  }
  return (prisma as any).override.findMany({
    orderBy: { at: "desc" },
  });
}

/** Set or update a manual override */
export async function setOverride(data: OverrideData) {
  const { entityType, entityId, field, value, note, byName } = data;

  const existing = await (prisma as any).override.findUnique({
    where: {
      entityType_entityId_field: { entityType, entityId, field },
    },
  });

  const override = await (prisma as any).override.upsert({
    where: {
      entityType_entityId_field: { entityType, entityId, field },
    },
    update: {
      value: Number(value),
      note: note || null,
      byName,
      at: new Date(),
    },
    create: {
      entityType,
      entityId,
      field,
      value: Number(value),
      note: note || null,
      byName,
      at: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      actor: byName,
      action: existing ? "UPDATED_OVERRIDE" : "CREATED_OVERRIDE",
      entityType: `OVERRIDE_${entityType}`,
      entityId: `${entityId}:${field}`,
      details: JSON.stringify({
        field,
        value,
        note,
        previousValue: existing?.value,
      }),
    },
  });

  return override;
}

/** Clear a manual override */
export async function clearOverride(
  entityType: string,
  entityId: string,
  field: string,
  byName: string,
) {
  const existing = await (prisma as any).override.findUnique({
    where: {
      entityType_entityId_field: { entityType, entityId, field },
    },
  });

  if (!existing) return null;

  await (prisma as any).override.delete({
    where: {
      entityType_entityId_field: { entityType, entityId, field },
    },
  });

  await prisma.auditLog.create({
    data: {
      actor: byName,
      action: "CLEARED_OVERRIDE",
      entityType: `OVERRIDE_${entityType}`,
      entityId: `${entityId}:${field}`,
      details: JSON.stringify({ previousValue: existing.value }),
    },
  });

  return existing;
}
