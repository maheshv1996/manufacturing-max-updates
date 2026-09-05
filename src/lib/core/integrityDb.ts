/**
 * C1 — DB adapters for the integrity primitives (audit / idempotency /
 * sequence). These are the only sanctioned ways to (a) write an audit row,
 * (b) guard a mutating operation with an idempotency key, and (c) allocate a
 * transactional document number. The pure rules live in audit.ts,
 * idempotency.ts, sequence.ts; this layer owns the Prisma calls.
 */
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { buildAuditEvent, type AuditEventInput } from "./audit";
import { makeIdempotencyKey, normalizeClientId } from "./idempotency";
import { validateSequenceName } from "./sequence";
import { validation } from "./errors";

/** Insert one audit row. */
export async function recordAudit(
  db: PrismaClient,
  input: AuditEventInput,
): Promise<void> {
  const ev = buildAuditEvent(input);
  await db.auditLog.create({
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

export type IdempotencyResult<T> = { applied: true; value: T } | { applied: false };

/**
 * Reserve the idempotency key first; only then run `fn`. A duplicate key
 * (network retry) returns { applied: false } without running `fn`. If `fn`
 * throws, the reservation is released so the retry can actually retry.
 */
export async function runIdempotent<T>(
  db: PrismaClient,
  args: { clientId: string; scope: string },
  fn: () => Promise<T>,
): Promise<IdempotencyResult<T>> {
  const clientId = makeIdempotencyKey(normalizeClientId(args.clientId), args.scope);
  try {
    await db.idempotencyKey.create({
      data: { clientId, endpoint: args.scope.slice(0, 120) },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { applied: false };
    }
    throw e;
  }

  try {
    const value = await fn();
    return { applied: true, value };
  } catch (e) {
    // Release the reservation so a genuine retry can succeed.
    await db.idempotencyKey.deleteMany({ where: { clientId } }).catch(() => {});
    throw e;
  }
}

/** Allocate the next value for a named sequence inside one transaction. */
export async function allocateSequence(db: PrismaClient, name: string): Promise<number> {
  if (!validateSequenceName(name)) {
    throw validation(`Invalid sequence name: ${name}`);
  }
  return db.$transaction(async (tx) => {
    const row = await tx.sequenceCounter.upsert({
      where: { id: name },
      create: { id: name, nextVal: 1 },
      update: { nextVal: { increment: 1 } },
    });
    return row.nextVal;
  });
}
