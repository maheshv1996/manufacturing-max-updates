/**
 * C2-3 — Pure WorkOrder readiness check (DEPTH_04 W2 step 2).
 * DB-free: the caller assembles a structural snapshot (stock, certs, drawing
 * rev, fixture, calibration, FAI state); the engine answers ready + a typed
 * gap list. Re-spec note: extends v1 `readinessEngine.ts` (materials only) to
 * the full W2 readiness surface — v1 material statuses preserved for the
 * material subset. FAI gating is guardrail G-1, never configurable away.
 */
export type ReadinessGapCode =
  | "MATERIAL_SHORT"
  | "CERT_MISSING"
  | "DRAWING_REV"
  | "FIXTURE_UNAVAILABLE"
  | "CALIBRATION_EXPIRED"
  | "FAI_PENDING";

export interface MaterialStatus {
  sku: string;
  name: string;
  requiredQty: number;
  availableQty: number;
}

export interface ReadinessSnapshot {
  materials: MaterialStatus[];
  /** Material mill certs flagged for this WO (v1 `requireMillCerts` family). */
  certsRequired: boolean;
  certsPresent: boolean;
  drawingRevCurrent: boolean;
  fixtureAvailable: boolean;
  assignedInstrumentsCalibrated: boolean;
  /** First-article gate (G-1): part-rev requires an APPROVED FAI before full production. */
  faiRequired: boolean;
  faiSatisfied: boolean;
}

export interface ReadinessGap {
  code: ReadinessGapCode;
  label: string;
}

export interface ReadinessResult {
  ready: boolean;
  gaps: ReadinessGap[];
}

export function checkReadiness(s: ReadinessSnapshot): ReadinessResult {
  const gaps: ReadinessGap[] = [];

  const short = s.materials.filter((m) => m.availableQty < m.requiredQty);
  if (short.length > 0) {
    const names = short.map((m) => `${m.name} (${m.sku})`).join(", ");
    gaps.push({ code: "MATERIAL_SHORT", label: `Short material: ${names}` });
  }
  if (s.certsRequired && !s.certsPresent) {
    gaps.push({ code: "CERT_MISSING", label: "Required material certificates are missing" });
  }
  if (!s.drawingRevCurrent) {
    gaps.push({ code: "DRAWING_REV", label: "Drawing revision is not current (ECO effectivity pending)" });
  }
  if (!s.fixtureAvailable) {
    gaps.push({ code: "FIXTURE_UNAVAILABLE", label: "Fixture is not AVAILABLE" });
  }
  if (!s.assignedInstrumentsCalibrated) {
    gaps.push({ code: "CALIBRATION_EXPIRED", label: "Assigned instruments are not in calibration" });
  }
  if (s.faiRequired && !s.faiSatisfied) {
    gaps.push({ code: "FAI_PENDING", label: "First-article (AS9102 FAI) not yet approved for this part revision" });
  }

  return { ready: gaps.length === 0, gaps };
}
