import { prisma } from "./prisma";

export async function logAudit({
  actor,
  action,
  entityType,
  entityId,
  details,
}: {
  actor: string;
  action: string;
  entityType: string;
  entityId?: string;
  details: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actor,
        action,
        entityType,
        entityId,
        details,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
    // We intentionally don't throw here so that audit log failures don't
    // strictly break the primary transaction if run alongside it without a transaction,
    // though in a very strict system they might.
  }
}
