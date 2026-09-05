/**
 * C9-1 — EHS safety incident machine (DEPTH_03 F10 guardrails) + P27 quota.
 * • Report → OPEN with type/severity/location/description validation.
 * • START_INVESTIGATION demands a capaOwner before work begins (accountability).
 * • CLOSE (F10) demands closure evidence — rootCause or fiveWhyReason AND
 *   actionTaken — and stamps closedAt/closedBy. There is no delete path: the
 *   register is append/transition-only, history lives in the AuditLog.
 * • P27 near-miss quota: per-manager NEAR_MISS/HAZARD/PPE_VIOLATION count for
 *   the month vs the `ehsObservationQuota` setting (pure projection).
 */

import { ok, err, type Result } from "../core/result";

// ------------------------------------------------------------------ types

export const INCIDENT_TYPES = ["NEAR_MISS", "HAZARD", "PPE_VIOLATION", "INCIDENT"] as const;
export const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];
export type IncidentSeverity = (typeof SEVERITIES)[number];
export type IncidentStatus = "OPEN" | "IN_INVESTIGATION" | "CLOSED";

export interface IncidentInput {
  id: string;
  type: string;
  severity: string;
  status: string;
  location: string;
  description: string;
  reportedBy: string;
  reportedAt: Date;
  capaOwner: string | null;
  dueDate: Date | null;
  rootCause: string | null;
  fiveWhyReason: string | null;
  actionTaken: string | null;
  closedAt: Date | null;
  closedBy: string | null;
}

export interface IncidentReportDraftInput {
  type: string;
  severity: string;
  location: string;
  description: string;
}

export interface IncidentDraft {
  type: IncidentType;
  severity: IncidentSeverity;
  status: "OPEN";
  location: string;
  description: string;
}

export interface IncidentActionInput {
  capaOwner?: string | null;
  rootCause?: string | null;
  fiveWhyReason?: string | null;
  actionTaken?: string | null;
  dueDate?: Date | null;
}

export type IncidentAction = "START_INVESTIGATION" | "CLOSE";

export type IncidentError =
  | "INVALID_TYPE"
  | "INVALID_SEVERITY"
  | "LOCATION_REQUIRED"
  | "DESCRIPTION_REQUIRED"
  | "INVALID_STATUS"
  | "CAPA_OWNER_REQUIRED"
  | "CLOSURE_EVIDENCE_REQUIRED"
  | "ALREADY_CLOSED"
  | "UNKNOWN_ACTION";

export type ClosureEvidenceCode = "ROOT_CAUSE_OR_FIVE_WHY" | "ACTION_TAKEN";

const blank = (s: string | null | undefined): boolean => !s || s.trim().length === 0;

// ------------------------------------------------------------- report gate

export function validateIncidentReport(
  draft: IncidentReportDraftInput,
): Result<IncidentDraft, IncidentError> {
  if (!(INCIDENT_TYPES as readonly string[]).includes(draft.type)) return err("INVALID_TYPE");
  if (!(SEVERITIES as readonly string[]).includes(draft.severity)) return err("INVALID_SEVERITY");
  if (blank(draft.location)) return err("LOCATION_REQUIRED");
  if (blank(draft.description)) return err("DESCRIPTION_REQUIRED");
  return ok({
    type: draft.type as IncidentType,
    severity: draft.severity as IncidentSeverity,
    status: "OPEN",
    location: draft.location.trim(),
    description: draft.description.trim(),
  });
}

/**
 * F10 closure evidence — rootCause OR fiveWhyReason, AND actionTaken.
 * Missing codes come back in stable order so callers can render prompts.
 */
export function closureEvidence(inc: IncidentInput): {
  ok: boolean;
  missing: ClosureEvidenceCode[];
} {
  const missing: ClosureEvidenceCode[] = [];
  if (blank(inc.rootCause) && blank(inc.fiveWhyReason)) missing.push("ROOT_CAUSE_OR_FIVE_WHY");
  if (blank(inc.actionTaken)) missing.push("ACTION_TAKEN");
  return { ok: missing.length === 0, missing };
}

// ------------------------------------------------------- transition machine

function applyPatch(inc: IncidentInput, patch: IncidentActionInput): IncidentInput {
  return {
    ...inc,
    capaOwner: patch.capaOwner !== undefined ? patch.capaOwner : inc.capaOwner,
    rootCause: patch.rootCause !== undefined ? patch.rootCause : inc.rootCause,
    fiveWhyReason: patch.fiveWhyReason !== undefined ? patch.fiveWhyReason : inc.fiveWhyReason,
    actionTaken: patch.actionTaken !== undefined ? patch.actionTaken : inc.actionTaken,
    dueDate: patch.dueDate !== undefined ? patch.dueDate : inc.dueDate,
  };
}

/**
 * OPEN → IN_INVESTIGATION. Accountability gate: a CAPA owner must be named
 * before investigation work begins. Only reachable from OPEN.
 */
export function startInvestigation(
  inc: IncidentInput,
  patch: IncidentActionInput,
  _actorId: string,
  _now: Date,
): Result<IncidentInput, IncidentError> {
  if (inc.status === "CLOSED") return err("ALREADY_CLOSED");
  if (inc.status !== "OPEN") return err("INVALID_STATUS");
  const next = applyPatch(inc, patch);
  if (blank(next.capaOwner)) return err("CAPA_OWNER_REQUIRED");
  return ok({ ...next, status: "IN_INVESTIGATION" });
}

/**
 * → CLOSED (F10). Closure evidence is evaluated on the post-patch record, so a
 * caller may supply the root cause in the same request that closes. Stamps
 * closedAt/closedBy. OPEN and IN_INVESTIGATION both close here.
 */
export function closeIncident(
  inc: IncidentInput,
  patch: IncidentActionInput,
  actorId: string,
  now: Date,
): Result<IncidentInput, IncidentError> {
  if (inc.status === "CLOSED") return err("ALREADY_CLOSED");
  const next = applyPatch(inc, patch);
  if (!closureEvidence(next).ok) return err("CLOSURE_EVIDENCE_REQUIRED");
  return ok({ ...next, status: "CLOSED", closedAt: now, closedBy: actorId });
}

export function transitionIncident(
  inc: IncidentInput,
  action: string,
  patch: IncidentActionInput,
  actorId: string,
  now: Date,
): Result<IncidentInput, IncidentError> {
  if (action === "START_INVESTIGATION") return startInvestigation(inc, patch, actorId, now);
  if (action === "CLOSE") return closeIncident(inc, patch, actorId, now);
  return err("UNKNOWN_ACTION");
}

// ------------------------------------------------------------------ P27 quota

/** Observation types that count toward the manager near-miss quota. */
export const QUOTA_INCIDENT_TYPES = ["NEAR_MISS", "HAZARD", "PPE_VIOLATION"] as const;

export interface QuotaIncidentRow {
  type: string;
  reportedBy: string;
  reportedAt: Date;
}

export interface QuotaManagerRow {
  name: string;
  count: number;
  missed: boolean;
}

/**
 * P27 — per-manager observation quota projection for one month window
 * [monthStart, now]. Pure: the adapter supplies incidents, manager names and
 * the `ehsObservationQuota` setting value. One row per manager even at zero.
 */
export function observationQuotaRows(
  incidents: QuotaIncidentRow[],
  managers: { name: string }[],
  quota: number,
  monthStart: Date,
  now: Date,
): QuotaManagerRow[] {
  const counted = incidents.filter(
    (i) =>
      (QUOTA_INCIDENT_TYPES as readonly string[]).includes(i.type) &&
      i.reportedAt.getTime() >= monthStart.getTime() &&
      i.reportedAt.getTime() <= now.getTime(),
  );
  return managers
    .filter((m) => !!m.name && m.name.trim().length > 0)
    .map((m) => {
      const name = m.name.trim();
      const count = counted.filter((i) => i.reportedBy.trim() === name).length;
      return { name: m.name, count, missed: count < quota };
    });
}