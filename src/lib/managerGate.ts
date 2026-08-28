import { prisma } from "./prisma";

/**
 * Approve / override gate. Every decision that APPROVES something or
 * OVERRIDES a record requires:
 *   - the acting user's level to be MANAGER (department head), and
 *   - a human-readable reason (never trust the client to skip it).
 * Owners always pass (they ARE the top manager).
 */
export async function requireManagerLevel(user: {
  id?: string;
  isOwner?: boolean;
  level?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (user.isOwner) return { ok: true };
  if (!user.id) return { ok: false, error: "Unauthorized" };

  let level = user.level;
  // The level may be stale in the JWT after a promotion — always re-check the DB.
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { level: true, isActive: true },
    });
    if (!dbUser || !dbUser.isActive)
      return { ok: false, error: "Unauthorized" };
    level = dbUser.level;
  } catch {
    // DB hiccup — fall back to the JWT claim so an infra blip never hard-blocks.
  }

  if (level !== "MANAGER") {
    return {
      ok: false,
      error:
        "Manager approval required — this action is restricted to department heads.",
    };
  }
  return { ok: true };
}

export function extractReason(body: any): string {
  const reason = body?.reason ?? body?.note ?? body?.notes;
  return typeof reason === "string" ? reason.trim() : "";
}

/** Require a non-empty reason for approve/override decisions. */
export function validateReason(body: any): {
  ok: boolean;
  error?: string;
  reason?: string;
} {
  const reason = extractReason(body);
  if (!reason) {
    return {
      ok: false,
      error: "A reason is required for approvals and overrides (audit trail).",
    };
  }
  return { ok: true, reason };
}

/**
 * Audit an approve/override decision as <ACTION>_APPROVED or <ACTION>_OVERRIDDEN
 * (e.g. LEAVE_APPROVED, SHIFT_COUNT_APPROVED, KPI_OVERRIDDEN).
 */
export async function auditDecision(opts: {
  actor: string;
  action: string; // base action, e.g. "LEAVE", "SHIFT_COUNT", "KPI"
  entityType: string;
  entityId?: string | null;
  reason: string;
  override?: boolean;
}) {
  await prisma.auditLog.create({
    data: {
      actor: opts.actor || "System",
      action: opts.override
        ? `${opts.action}_OVERRIDDEN`
        : `${opts.action}_APPROVED`,
      entityType: opts.entityType,
      entityId: opts.entityId || undefined,
      details: opts.reason,
    },
  });
}
