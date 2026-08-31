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
  const cleanType = entityType ? String(entityType).trim() : undefined;
  const cleanId = entityId ? String(entityId).trim() : undefined;

  if (cleanType && cleanId) {
    return (prisma as any).override.findMany({
      where: { entityType: cleanType, entityId: cleanId },
    });
  }
  if (cleanType) {
    return (prisma as any).override.findMany({
      where: { entityType: cleanType },
    });
  }
  return (prisma as any).override.findMany({
    orderBy: { at: "desc" },
  });
}

/** Set or update a manual override */
export async function setOverride(data: OverrideData) {
  const entityType = String(data.entityType || "").trim();
  const entityId = String(data.entityId || "").trim();
  const field = String(data.field || "").trim();
  const rawNum = Number(data.value);
  const value = Number.isFinite(rawNum) ? rawNum : 0;
  const note = data.note ? String(data.note).trim() : null;
  const byName = String(data.byName || "SYSTEM").trim();

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
      value,
      note,
      byName,
      at: new Date(),
    },
    create: {
      entityType,
      entityId,
      field,
      value,
      note,
      byName,
      at: new Date(),
    },
  });

  try {
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
  } catch (err) {
    console.error("Failed to create audit log for override:", err);
  }

  return override;
}

/** Clear a manual override */
export async function clearOverride(
  entityType: string,
  entityId: string,
  field: string,
  byName: string,
) {
  const cleanType = String(entityType || "").trim();
  const cleanId = String(entityId || "").trim();
  const cleanField = String(field || "").trim();
  const cleanActor = String(byName || "SYSTEM").trim();

  const existing = await (prisma as any).override.findUnique({
    where: {
      entityType_entityId_field: {
        entityType: cleanType,
        entityId: cleanId,
        field: cleanField,
      },
    },
  });

  if (!existing) return null;

  await (prisma as any).override.delete({
    where: {
      entityType_entityId_field: {
        entityType: cleanType,
        entityId: cleanId,
        field: cleanField,
      },
    },
  });

  try {
    await prisma.auditLog.create({
      data: {
        actor: cleanActor,
        action: "CLEARED_OVERRIDE",
        entityType: `OVERRIDE_${cleanType}`,
        entityId: `${cleanId}:${cleanField}`,
        details: JSON.stringify({ previousValue: existing.value }),
      },
    });
  } catch (err) {
    console.error("Failed to create audit log for cleared override:", err);
  }

  return existing;
}
