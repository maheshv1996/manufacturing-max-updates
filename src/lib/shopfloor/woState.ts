/**
 * C2-1 — Pure WorkOrder status state machine (DEPTH_04 W2, v1 parity).
 * DB-free by design: callers pass the current status and gate inputs, the
 * engine answers with the next status or a typed block code. The DB adapter
 * (C2-6) is a dumb mapper; no Prisma import here.
 *
 * v1 parity: START_JOB / HOLD(RESUME) / COMPLETE_JOB map to the actions below;
 * the fixture gate lives in ctx (v1 checked it in-route), readiness in ctx
 * (C2-3). Re-spec delta: HOLD now requires a written reason (audit mandate);
 * START_JOB on an already-running WO is ILLEGAL (retries are handled by the
 * idempotency layer, not by re-running the transition).
 */
export type WoStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";

export type WoBlockCode =
  | "NOT_READY"
  | "FIXTURE_BLOCKED"
  | "QTY_SHORT"
  | "REASON_REQUIRED"
  | "ILLEGAL_TRANSITION";

export type WoActionCtx =
  | { action: "START_JOB"; ready: boolean; fixtureOk: boolean }
  | { action: "HOLD"; reason?: string }
  | { action: "RESUME" }
  | { action: "COMPLETE"; goodQuantity: number; plannedQuantity: number; override?: boolean };

export type WoTransition =
  | { ok: true; status: WoStatus }
  | { ok: false; code: WoBlockCode; message: string };

const illegal = (from: WoStatus, action: string): WoTransition => ({
  ok: false,
  code: "ILLEGAL_TRANSITION",
  message: `Cannot ${action} a ${from} work order`,
});

export function transitionWoStatus(current: WoStatus, a: WoActionCtx): WoTransition {
  switch (a.action) {
    case "START_JOB": {
      if (current !== "PLANNED") return illegal(current, "START_JOB");
      if (!a.ready) {
        return { ok: false, code: "NOT_READY", message: "Work order is not ready (see readiness gaps)" };
      }
      if (!a.fixtureOk) {
        return { ok: false, code: "FIXTURE_BLOCKED", message: "Fixture is not AVAILABLE — manager override required" };
      }
      return { ok: true, status: "IN_PROGRESS" };
    }
    case "HOLD": {
      if (current !== "IN_PROGRESS") return illegal(current, "HOLD");
      const reason = a.reason?.trim() ?? "";
      if (!reason) {
        return { ok: false, code: "REASON_REQUIRED", message: "A written reason is required to hold a work order" };
      }
      return { ok: true, status: "ON_HOLD" };
    }
    case "RESUME": {
      if (current !== "ON_HOLD") return illegal(current, "RESUME");
      return { ok: true, status: "IN_PROGRESS" };
    }
    case "COMPLETE": {
      if (current !== "IN_PROGRESS") return illegal(current, "COMPLETE");
      if (a.goodQuantity < a.plannedQuantity && a.override !== true) {
        return {
          ok: false,
          code: "QTY_SHORT",
          message: `Good quantity ${a.goodQuantity} is below planned ${a.plannedQuantity} — authorized override required`,
        };
      }
      return { ok: true, status: "COMPLETED" };
    }
  }
}
