/**
 * C8-9b — Measurement-time instrument gate (guardrail G-4: no expired instrument
 * measuring). Pure — an inspection may only record a result using an instrument
 * that `canMeasure` right now. Composes the calibration engine for the Quality
 * domain; the adapter/routes enforce it before a QualityInspection row is created.
 */

import { canMeasure, type InstrumentInput, type MeasurementRefusal } from "../maintenance/calibration";

export type InspectionGateResult = { ok: true } | { ok: false; reason: string; message: string };

const REFUSAL_MESSAGE: Record<Exclude<MeasurementRefusal, { ok: true }>["reason"], string> = {
  EXPIRED: "instrument calibration has expired",
  RETIRED: "instrument is retired from service",
  NOT_ACTIVE: "instrument is not in an active lifecycle",
  QUARANTINED: "instrument is quarantined",
};

/**
 * G-4 for inspections — a usable instrument must measure. EXPIRED, RETIRED,
 * non-ACTIVE and QUARANTINED instruments are refused with a human message.
 * A WITH_OPERATOR instrument is measurement-usable (that is the point of issue).
 */
export function assertInstrumentUsable(inst: InstrumentInput, now: Date): InspectionGateResult {
  const refusal = canMeasure(inst, now);
  if (refusal.ok) return { ok: true };
  const reason = refusal.reason;
  return { ok: false, reason, message: REFUSAL_MESSAGE[reason] };
}