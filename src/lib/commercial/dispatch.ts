/**
 * C6-2 — Dispatch record state machine (DEPTH_03 F6; schema DispatchRecordStatus).
 * Pure functions; no DB.
 */

export type DispatchStatus = "PLANNED" | "DISPATCHED";

export type DispatchAction =
  | { action: "DISPATCH"; vehicleNo: string; driverName: string; eWayBillNo?: string }
  | { action: "CANCEL"; reason?: string };

export type DispatchTransitionResult =
  | { ok: true; status: DispatchStatus }
  | { ok: false; code: "ILLEGAL_TRANSITION" | "TERMINAL_STATE" | "REASON_REQUIRED"; message: string };

const illegal = (from: DispatchStatus, action: string): DispatchTransitionResult => ({
  ok: false,
  code: "ILLEGAL_TRANSITION",
  message: `Cannot ${action} a dispatch record in state ${from}`,
});

export function transitionDispatch(current: DispatchStatus, a: DispatchAction): DispatchTransitionResult {
  switch (a.action) {
    case "DISPATCH": {
      if (current !== "PLANNED") return illegal(current, "DISPATCH");
      if (!a.vehicleNo || !a.vehicleNo.trim()) {
        return { ok: false, code: "REASON_REQUIRED", message: "vehicleNo is required for dispatch" };
      }
      if (!a.driverName || !a.driverName.trim()) {
        return { ok: false, code: "REASON_REQUIRED", message: "driverName is required for dispatch" };
      }
      return { ok: true, status: "DISPATCHED" };
    }
    case "CANCEL": {
      if (current === "DISPATCHED") return { ok: false, code: "TERMINAL_STATE", message: "Cannot cancel a dispatched record" };
      if (current !== "PLANNED") return illegal(current, "CANCEL");
      return { ok: true, status: "PLANNED" };
    }
  }
}
