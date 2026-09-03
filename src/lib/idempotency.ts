import { prisma } from "./prisma";

/**
 * DB-backed idempotency guard. Replaces the previous in-memory Set
 * (which was lost on every serverless cold start / replica).
 *
 * Contract:
 *  - clientId is taken from X-Client-ID header or body.clientId (offlineSync.ts)
 *  - First caller inserts the key and proceeds; duplicate callers get 409-style { duplicate:true }
 *  - Key is persisted with a TTL index (createdAt) so it can be pruned externally if needed
 *  - Response is optionally cached so replayed requests return the original result without re-executing side effects
 */

export async function checkIdempotency(
  clientId: string | null | undefined,
  _endpoint?: string | null,
): Promise<{ duplicate: boolean; existing?: any }> {
  if (!clientId) return { duplicate: false };
  const existing = await (prisma as any).idempotencyKey.findUnique({ where: { clientId } });
  if (existing) {
    return { duplicate: true, existing };
  }
  return { duplicate: false };
}

export async function reserveIdempotency(
  tx: any,
  clientId: string,
  endpoint?: string | null,
): Promise<boolean> {
  // Returns false if already reserved (unique violation means duplicate)
  try {
    await tx.idempotencyKey.create({ data: { clientId, endpoint: endpoint || null } });
    return true;
  } catch (e: any) {
    if (e?.code === "P2002" || String(e?.message || "").includes("Unique constraint")) {
      return false;
    }
    throw e;
  }
}

export async function completeIdempotency(
  clientId: string | null | undefined,
  response: any,
): Promise<void> {
  if (!clientId) return;
  try {
    await (prisma as any).idempotencyKey.update({
      where: { clientId },
      data: { response: response ?? null },
    });
  } catch {
    // best-effort: don't fail the main transaction if caching response fails
  }
}

export function extractClientId(request: Request, body: any, headersList?: any): string | null {
  const fromBody = body?.clientId ? String(body.clientId).trim() : null;
  if (fromBody) return fromBody;
  // Next headers() is a Headers object; plain Request has .headers
  if (headersList?.get) {
    const h = headersList.get("x-client-id");
    if (h) return String(h).trim();
  }
  const rh = (request as any)?.headers?.get?.("x-client-id");
  if (rh) return String(rh).trim();
  return null;
}

/**
 * Prune idempotency keys older than `days` (default 7). Keeps table bounded.
 * Call from a daily cron / `CRON_SECRET` protected endpoint or desktop watchdog.
 */
export async function pruneIdempotencyKeys(days = 7): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86400000);
  const result = await (prisma as any).idempotencyKey.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count ?? 0;
}
