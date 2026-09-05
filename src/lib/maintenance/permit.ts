/**
 * C8-6 — Permit to work (W11 safety gate; schema `PermitToWork`).
 * A permit becomes APPROVED only when EHS, maintenance AND production have each
 * signed with a written reason; any live state can be voided (safety first);
 * validity is enforced against the permit window. Guardrail: no released work
 * with an open safety defect. Pure — no DB.
 */

import { ok, err, type Result } from "../core/result";

export type PermitStatus = "PENDING" | "APPROVED" | "VOID";
export type PermitLeg = "EHS" | "MAINTENANCE" | "PRODUCTION";

export interface LegSignature {
  by: string;
  reason: string;
  at: Date;
}

export interface PermitInput {
  id: string;
  permitNo: string;
  type: string; // HOT_WORK | HEIGHT_WORK | CONFINED_SPACE | ELECTRICAL | EXCAVATION
  status: PermitStatus;
  validFrom: Date;
  validUntil: Date;
  legs: Partial<Record<PermitLeg, LegSignature>>;
  approvedAt?: Date | null;
  voidedAt?: Date | null;
}

export type PermitError = "REASON_REQUIRED" | "ILLEGAL_TRANSITION" | "UNKNOWN_LEG";

export function approveLeg(
  permit: PermitInput,
  leg: PermitLeg,
  sig: LegSignature,
): Result<PermitInput, PermitError> {
  if (permit.status !== "PENDING") return err("ILLEGAL_TRANSITION");
  if (!leg || !["EHS", "MAINTENANCE", "PRODUCTION"].includes(leg)) return err("UNKNOWN_LEG");
  if (!sig.reason || sig.reason.trim().length === 0) return err("REASON_REQUIRED");

  const legs = { ...permit.legs, [leg]: { ...sig, reason: sig.reason.trim() } };
  const complete = ["EHS", "MAINTENANCE", "PRODUCTION"].every((l) => Boolean(legs[l as PermitLeg]));

  return ok({
    ...permit,
    legs,
    status: complete ? "APPROVED" : "PENDING",
    approvedAt: complete ? new Date() : permit.approvedAt ?? null,
  });
}

export function voidPermit(
  permit: PermitInput,
  sig: LegSignature,
): Result<PermitInput, PermitError> {
  if (permit.status === "VOID") return err("ILLEGAL_TRANSITION");
  if (!sig.reason || sig.reason.trim().length === 0) return err("REASON_REQUIRED");
  return ok({ ...permit, status: "VOID", voidedAt: new Date() });
}

/** A permit authorizes work only while APPROVED and inside its validity window. */
export function isPermitValid(permit: PermitInput, now: Date): boolean {
  if (permit.status !== "APPROVED") return false;
  return now >= permit.validFrom && now <= permit.validUntil;
}
