/**
 * C3-1 — Pure NCR state machine (DEPTH_04 W5; v1 schema enums).
 * OPEN → UNDER_REVIEW → DISPOSITIONED → CLOSED. Disposition requires an
 * authority + written justification; USE_AS_IS needs CUSTOMER authority when
 * the contract requires a concession (org-configurable flag, guardrail-adjacent:
 * the flag itself is config, but once set the authority check is law).
 * CLOSED requires a written note (re-spec: mandatory reasons on status moves).
 */
export type NcrStatus = "OPEN" | "UNDER_REVIEW" | "DISPOSITIONED" | "CLOSED";
export type NcrDisposition = "USE_AS_IS" | "REWORK" | "SCRAP" | "RETURN_TO_SUPPLIER";
export type DispositionAuthority = "QUALITY" | "ENGINEERING" | "CUSTOMER";

export type NcrActionCtx =
  | { action: "START_REVIEW" }
  | {
      action: "DISPOSE";
      disposition: NcrDisposition;
      authority: DispositionAuthority;
      justification: string;
      /** Org-config: does the customer contract require a concession for USE_AS_IS? */
      contractRequiresCustomerConcession?: boolean;
    }
  | { action: "CLOSE"; closeNote?: string };

export type NcrTransition =
  | { ok: true; status: NcrStatus }
  | { ok: false; code: "JUSTIFICATION_REQUIRED" | "AUTHORITY_REQUIRED" | "NOTE_REQUIRED" | "ILLEGAL_TRANSITION"; message: string };

const illegal = (from: NcrStatus, action: string): NcrTransition => ({
  ok: false,
  code: "ILLEGAL_TRANSITION",
  message: `Cannot ${action} an NCR in state ${from}`,
});

export function transitionNcr(current: NcrStatus, a: NcrActionCtx): NcrTransition {
  switch (a.action) {
    case "START_REVIEW": {
      if (current !== "OPEN") return illegal(current, "START_REVIEW");
      return { ok: true, status: "UNDER_REVIEW" };
    }
    case "DISPOSE": {
      if (current !== "UNDER_REVIEW") return illegal(current, "DISPOSE");
      if (!a.justification?.trim()) {
        return { ok: false, code: "JUSTIFICATION_REQUIRED", message: "A written justification is required for disposition" };
      }
      if (
        a.disposition === "USE_AS_IS" &&
        a.contractRequiresCustomerConcession === true &&
        a.authority !== "CUSTOMER"
      ) {
        return {
          ok: false,
          code: "AUTHORITY_REQUIRED",
          message: "USE_AS_IS requires CUSTOMER authority when the contract requires a concession",
        };
      }
      return { ok: true, status: "DISPOSITIONED" };
    }
    case "CLOSE": {
      if (current !== "DISPOSITIONED") return illegal(current, "CLOSE");
      if (!a.closeNote?.trim()) {
        return { ok: false, code: "NOTE_REQUIRED", message: "A written note is required to close an NCR" };
      }
      return { ok: true, status: "CLOSED" };
    }
  }
}