/**
 * C1-9 — Idempotency core. Offline terminals and network retries must never
 * double-apply an action (G-9). A client id (`X-Client-ID` from the offline
 * queue) is scoped and hashed into a stable 64-hex key stored in the
 * IdempotencyKey table (unique); the DB adapter with the 7-day TTL prune
 * lives in the route/service layer. Pure module.
 */
import { createHash } from "crypto";
import { validation } from "./errors";

/** Stable, scope-qualified key for one client action. */
export function makeIdempotencyKey(clientId: string, scope: string): string {
  const c = normalizeClientId(clientId);
  const s = String(scope).trim();
  if (!s) throw validation("idempotency scope is required");
  return createHash("sha256").update(`${s}:${c}`).digest("hex");
}

/** Trim + length-guard a raw client id; throws VALIDATION AppError. */
export function normalizeClientId(raw: string): string {
  const c = String(raw ?? "").trim();
  if (!c) throw validation("clientId is required");
  if (c.length > 128) throw validation("clientId exceeds 128 characters");
  return c;
}
