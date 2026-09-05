/**
 * C5-4 Subcontract challan machine (W4).
 * OUT -> RECEIVED_BACK (certs) -> QC signoff. Accredited-scope gating on
 * dispatch; a FAIL signoff routes an NCR. Pure; no DB.
 */
export type ChallanStatus = "DISPATCHED" | "RECEIVED_BACK" | "QC_PASSED" | "QC_FAILED";

export type DispatchResult =
  | { ok: true; status: "DISPATCHED" }
  | { ok: false; code: "VENDOR_NOT_ACCREDITED" };

export function dispatchChallan(opts: {
  accredited: boolean;
  contractRequiresAccreditation: boolean;
}): DispatchResult {
  if (opts.contractRequiresAccreditation && !opts.accredited) {
    return { ok: false, code: "VENDOR_NOT_ACCREDITED" };
  }
  return { ok: true, status: "DISPATCHED" };
}

export type ReceiveBackResult =
  | { ok: true; status: "RECEIVED_BACK" }
  | { ok: false; code: "CERT_MISSING" | "ILLEGAL_TRANSITION" };

export function receiveBack(opts: {
  status: ChallanStatus;
  certsPresent: number;
  specialProcessCertsRequired: number;
}): ReceiveBackResult {
  if (opts.status !== "DISPATCHED") return { ok: false, code: "ILLEGAL_TRANSITION" };
  if (opts.certsPresent < opts.specialProcessCertsRequired) return { ok: false, code: "CERT_MISSING" };
  return { ok: true, status: "RECEIVED_BACK" };
}

export type SignOffResult =
  | { ok: true; status: "QC_PASSED" | "QC_FAILED"; routesToNcr: boolean }
  | { ok: false; code: "ILLEGAL_TRANSITION" };

export function signOff(opts: { status: ChallanStatus; result: "PASS" | "FAIL" }): SignOffResult {
  if (opts.status !== "RECEIVED_BACK") return { ok: false, code: "ILLEGAL_TRANSITION" };
  if (opts.result === "FAIL") return { ok: true, status: "QC_FAILED", routesToNcr: true };
  return { ok: true, status: "QC_PASSED", routesToNcr: false };
}