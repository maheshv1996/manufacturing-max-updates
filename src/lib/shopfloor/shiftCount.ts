/**
 * C2-5 — Pure shift-count evaluation + dispute resolution (DEPTH_04 W2 step 7).
 * DB-free. Outgoing operator enters the WIP count; the incoming verifies;
 * within `tolerancePct` (percent of outCount, `count_tolerance` setting) the
 * pair is AGREED, else DISPUTED and a supervisor (authority seat) resolves.
 * v1 parity: `ShiftCount.status` PENDING → AGREED | DISPUTED → RESOLVED.
 */
export type ShiftCountVerdict = "AGREED" | "DISPUTED";
export type ShiftCountStatus = "PENDING" | "AGREED" | "DISPUTED" | "RESOLVED";

export function evaluateShiftCount(outCount: number, inCount: number, tolerancePct: number): ShiftCountVerdict {
  const diff = Math.abs(outCount - inCount);
  const allowance = (outCount * tolerancePct) / 100;
  return diff <= allowance ? "AGREED" : "DISPUTED";
}

export type DisputeResult =
  | { ok: true; status: "RESOLVED" }
  | { ok: false; code: "AUTHORITY_REQUIRED" | "ILLEGAL_TRANSITION"; message: string };

export function resolveDispute(status: ShiftCountStatus, authority: boolean): DisputeResult {
  if (status !== "DISPUTED") {
    return { ok: false, code: "ILLEGAL_TRANSITION", message: `Only a DISPUTED count can be resolved (was ${status})` };
  }
  if (!authority) {
    return { ok: false, code: "AUTHORITY_REQUIRED", message: "Supervisor authority is required to resolve a disputed count" };
  }
  return { ok: true, status: "RESOLVED" };
}
