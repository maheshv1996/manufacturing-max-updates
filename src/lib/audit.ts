import { prisma } from "./prisma";

export type AuditSeverity = "INFO" | "WARN" | "CRITICAL" | "SECURITY";

export interface AuditLogInput {
  actor: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details: string | Record<string, any>;
  severity?: AuditSeverity;
  ipAddress?: string | null;
  userAgent?: string | null;
  at?: Date;
}

export interface AuditLogResult {
  success: boolean;
  id?: string;
  error?: string;
}

const MAX_DETAILS_LENGTH = 4000;

function formatDetails(
  details: string | Record<string, any>,
  severity?: AuditSeverity,
  ipAddress?: string | null,
  userAgent?: string | null,
): string {
  let text = "";
  try {
    text = typeof details === "object" ? JSON.stringify(details) : String(details || "");
  } catch {
    text = "[Unserializable Object Payload]";
  }

  const metaParts = [];
  if (severity && severity !== "INFO") metaParts.push(`[SEVERITY:${severity}]`);
  if (ipAddress) metaParts.push(`[IP:${ipAddress}]`);
  if (userAgent) metaParts.push(`[UA:${String(userAgent).slice(0, 100)}]`);

  if (metaParts.length > 0) {
    text = `${metaParts.join(" ")} ${text}`;
  }

  // Truncate if exceeds max allowed length
  if (text.length > MAX_DETAILS_LENGTH) {
    text = text.slice(0, MAX_DETAILS_LENGTH) + "... [TRUNCATED]";
  }

  return text;
}

/**
 * Logs a single audit event with rich context, validation, and error safety.
 */
export async function logAudit({
  actor,
  action,
  entityType,
  entityId,
  details,
  severity = "INFO",
  ipAddress,
  userAgent,
  at,
}: AuditLogInput): Promise<AuditLogResult> {
  const safeActor = String(actor || "SYSTEM").trim().slice(0, 100) || "SYSTEM";
  const safeAction = String(action || "UNKNOWN_ACTION").trim().toUpperCase().slice(0, 100);
  const safeEntityType = String(entityType || "GENERIC").trim().toUpperCase().slice(0, 100);
  const formattedDetails = formatDetails(details, severity, ipAddress, userAgent);

  try {
    const created = await prisma.auditLog.create({
      data: {
        actor: safeActor,
        action: safeAction,
        entityType: safeEntityType,
        entityId: entityId ? String(entityId).slice(0, 100) : null,
        details: formattedDetails,
        at: at || new Date(),
      },
    });

    return { success: true, id: created.id };
  } catch (error: any) {
    console.error(`Failed to write audit log for [${safeAction} on ${safeEntityType}]:`, error);
    return { success: false, error: error?.message || "Audit log creation failed" };
  }
}

/**
 * Logs an audit event inside an existing Prisma transaction client.
 */
export async function logAuditTx(
  tx: { auditLog: { create: (args: any) => Promise<any> } },
  {
    actor,
    action,
    entityType,
    entityId,
    details,
    severity = "INFO",
    ipAddress,
    userAgent,
    at,
  }: AuditLogInput,
) {
  const safeActor = String(actor || "SYSTEM").trim().slice(0, 100) || "SYSTEM";
  const safeAction = String(action || "UNKNOWN_ACTION").trim().toUpperCase().slice(0, 100);
  const safeEntityType = String(entityType || "GENERIC").trim().toUpperCase().slice(0, 100);
  const formattedDetails = formatDetails(details, severity, ipAddress, userAgent);

  return tx.auditLog.create({
    data: {
      actor: safeActor,
      action: safeAction,
      entityType: safeEntityType,
      entityId: entityId ? String(entityId).slice(0, 100) : null,
      details: formattedDetails,
      at: at || new Date(),
    },
  });
}

/**
 * Batch logs multiple audit events in a single database transaction.
 */
export async function logAuditBatch(
  entries: AuditLogInput[],
): Promise<{ success: boolean; count: number; error?: string }> {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { success: true, count: 0 };
  }

  try {
    const data = entries.map((entry) => ({
      actor: String(entry.actor || "SYSTEM").trim().slice(0, 100) || "SYSTEM",
      action: String(entry.action || "UNKNOWN_ACTION").trim().toUpperCase().slice(0, 100),
      entityType: String(entry.entityType || "GENERIC").trim().toUpperCase().slice(0, 100),
      entityId: entry.entityId ? String(entry.entityId).slice(0, 100) : null,
      details: formatDetails(entry.details, entry.severity, entry.ipAddress, entry.userAgent),
      at: entry.at || new Date(),
    }));

    const result = await prisma.auditLog.createMany({ data });
    return { success: true, count: result.count };
  } catch (error: any) {
    console.error("Failed to write audit log batch:", error);
    return { success: false, count: 0, error: error?.message || "Batch audit log failed" };
  }
}
