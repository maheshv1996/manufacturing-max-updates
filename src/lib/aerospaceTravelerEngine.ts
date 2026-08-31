/**
 * Aerospace & High-Compliance AS9100 / AS9102 Digital Traveler & FAI Engine
 * Grounded in AS9100D, AS9102 Rev B/C First Article Inspection, and ITAR/EAR compliance.
 */

export type HoldPointType =
  | "CUSTOMER_MANDATORY"
  | "QA_STAMP_REQUIRED"
  | "HEAT_TREAT_VERIFICATION"
  | "FINAL_INSPECTION"
  | "NDT_STAGE_WITNESS";

export interface FaiForm1PartAccountability {
  faiReportNumber: string;
  partNumber: string;
  partName: string;
  serialNumber: string;
  as9102Revision: "REV_B" | "REV_C";
  faiReason:
    | "FIRST_PRODUCTION_RUN"
    | "DESIGN_CHANGE"
    | "PROCESS_CHANGE"
    | "FACILITY_MOVE"
    | "LAPSE_IN_PRODUCTION";
  organizationName: string;
  poNumber: string;
  drawingNumber: string;
  drawingRevision: string;
  customerApprovalRequired: boolean;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED";
}

export interface FaiForm2MaterialProcess {
  materialCertRef: string;
  rawMaterialAlloy: string;
  heatNumber: string;
  supplierName: string;
  specialProcesses: {
    processName: string; // e.g. Anodize MIL-A-8625, Heat Treat AMS-2759, NDT ASTM E1444
    specificationRef: string;
    subcontractorCode: string;
    certOfConformanceNumber: string;
    approved: boolean;
  }[];
  functionalTestResults?: {
    testName: string;
    specification: string;
    result: "PASS" | "FAIL";
  }[];
}

export interface FaiForm3Characteristic {
  charIndex: number;
  balloonNumber: string;
  characteristicDesignator: string; // e.g. "Outer Diameter 25.00 ± 0.05 mm"
  dimensionNominal: number;
  toleranceUpper: number;
  toleranceLower: number;
  measuredResult: number;
  toolUsedId: string;
  toolCalibrationExpiry?: Date | string | null;
  inspectionStatus: "CONFORMING" | "NON_CONFORMING" | "DISPOSITIONED_MRB";
}

export interface DigitalTravelerHoldPoint {
  seqNumber: number;
  operationCode: string;
  stationName: string;
  holdPointType: HoldPointType;
  isCleared: boolean;
  clearedByBadgeNumber?: string;
  clearedAt?: Date;
  stampHash?: string;
  drawingRevVerified: string;
}

export interface CharacteristicFailureDetail {
  charIndex: number;
  balloonNumber: string;
  designator: string;
  nominal: number;
  measured: number;
  deviation: number;
  minAllowed: number;
  maxAllowed: number;
}

/**
 * Validates whether a Work Order traveler can advance to the next operation.
 * Blocks progress if any preceding mandatory hold point is uncleared or if calibrated tools have expired.
 */
export function validateTravelerStepClearance(
  targetSeq: number,
  holdPoints: DigitalTravelerHoldPoint[] = [],
  calibratedTools: { toolId: string; expiresAt: Date | string }[] = [],
): { canProceed: boolean; blockingReasons: string[]; criticalBlockersCount: number } {
  const blockingReasons: string[] = [];
  const safeSeq = Number.isFinite(targetSeq) ? Math.max(1, targetSeq) : 1;
  const nowMs = Date.now();

  // 1. Tool calibration checks (Highest Severity per ISO 17025 / AS9100)
  const safeTools = Array.isArray(calibratedTools) ? calibratedTools : [];
  for (const tool of safeTools) {
    if (!tool?.expiresAt) continue;
    const expMs = new Date(tool.expiresAt).getTime();
    if (Number.isFinite(expMs) && expMs < nowMs) {
      blockingReasons.push(
        `[CRITICAL: TOOL CALIBRATION EXPIRED] Gauge/tool ${tool.toolId} expired on ${new Date(tool.expiresAt).toISOString().slice(0, 10)}. Recalibration required before operation execution.`,
      );
    }
  }

  // 2. Preceding mandatory hold points checks
  const safeHoldPoints = Array.isArray(holdPoints) ? holdPoints : [];
  const priorUncleared = safeHoldPoints.filter((hp) => hp && hp.seqNumber < safeSeq && !hp.isCleared);

  for (const hp of priorUncleared) {
    blockingReasons.push(
      `[HOLD POINT: UNCLEARED] Operation Seq ${hp.seqNumber} (${hp.operationCode} @ ${hp.stationName || "Station"}) has an uncleared ${hp.holdPointType} hold point.`,
    );
  }

  return {
    canProceed: blockingReasons.length === 0,
    blockingReasons,
    criticalBlockersCount: blockingReasons.length,
  };
}

/**
 * Evaluates AS9102 Form 3 Characteristic Conformance with ASME Y14.5 tolerance conventions.
 */
export function evaluateFaiCharacteristics(
  characteristics: FaiForm3Characteristic[] = [],
): {
  isFullyConforming: boolean;
  totalChars: number;
  conformingCount: number;
  nonConformingCount: number;
  failingBalloons: string[];
  failureDetails: CharacteristicFailureDetail[];
} {
  let conformingCount = 0;
  let nonConformingCount = 0;
  const failingBalloons: string[] = [];
  const failureDetails: CharacteristicFailureDetail[] = [];

  const safeChars = Array.isArray(characteristics) ? characteristics : [];

  for (const char of safeChars) {
    if (!char) continue;

    const nominal = Number(char.dimensionNominal) || 0;
    const rawUpper = Number(char.toleranceUpper) || 0;
    const rawLower = Number(char.toleranceLower) || 0;
    const measured = Number(char.measuredResult) || 0;

    // Standard bilateral / unilateral tolerance limits
    // If lower tolerance is positive (e.g. 0.05 on ±0.05), treat as -0.05
    const lowerDelta = rawLower <= 0 ? rawLower : -rawLower;
    const upperDelta = rawUpper >= 0 ? rawUpper : Math.abs(rawUpper);

    let rawMin = nominal + lowerDelta;
    let rawMax = nominal + upperDelta;

    if (rawMin > rawMax) {
      const temp = rawMin;
      rawMin = rawMax;
      rawMax = temp;
    }

    const minVal = Math.round((rawMin + Number.EPSILON) * 10000) / 10000;
    const maxVal = Math.round((rawMax + Number.EPSILON) * 10000) / 10000;
    const inSpec = measured >= minVal && measured <= maxVal;

    if (inSpec) {
      conformingCount++;
    } else {
      nonConformingCount++;
      failingBalloons.push(char.balloonNumber || `Char-${char.charIndex}`);
      const deviation = Math.round((measured - nominal + Number.EPSILON) * 10000) / 10000;
      failureDetails.push({
        charIndex: char.charIndex,
        balloonNumber: char.balloonNumber,
        designator: char.characteristicDesignator || "Dimension",
        nominal,
        measured,
        deviation,
        minAllowed: minVal,
        maxAllowed: maxVal,
      });
    }
  }

  return {
    isFullyConforming: nonConformingCount === 0,
    totalChars: safeChars.length,
    conformingCount,
    nonConformingCount,
    failingBalloons,
    failureDetails,
  };
}
