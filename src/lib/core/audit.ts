/**
 * C1-9 — Audit core. Every state transition in the system records an
 * AuditEvent (v1 `AuditLog` row shape). This builder is the typed entry
 * point; the DB adapter (insert into AuditLog via Prisma) is wired in the
 * route/service layer. Pure module.
 */
import { validation } from "./errors";

export interface AuditEventInput {
  actor: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: string | null;
}

export interface AuditEvent extends AuditEventInput {
  at: Date;
}

/** Build a validated audit event. Throws VALIDATION AppError on bad input. */
export function buildAuditEvent(input: AuditEventInput): AuditEvent {
  if (!input.actor || !input.actor.trim()) {
    throw validation("audit actor is required");
  }
  if (!input.action || !input.action.trim()) {
    throw validation("audit action is required");
  }
  if (!input.entityType || !input.entityType.trim()) {
    throw validation("audit entityType is required");
  }
  return {
    actor: input.actor,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    details: input.details ?? null,
    at: new Date(),
  };
}
