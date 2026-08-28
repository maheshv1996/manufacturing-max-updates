/**
 * Aerospace & High-Compliance AS9100 / AS9102 Digital Traveler & FAI Engine
 * Grounded in AS9100D, AS9102B First Article Inspection, and ITAR compliance.
 */

export interface FaiForm1PartAccountability {
  faiReportNumber: string;
  partNumber: string;
  partName: string;
  serialNumber: string;
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
    processName: string; // e.g. Anodize MIL-A-8625, Heat Treat AMS-2759
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
  toolCalibrationExpiry: Date;
  inspectionStatus: "CONFORMING" | "NON_CONFORMING" | "DISPOSITIONED_MRB";
}

export interface DigitalTravelerHoldPoint {
  seqNumber: number;
  operationCode: string;
  stationName: string;
  holdPointType:
    | "CUSTOMER_MANDATORY"
    | "QA_STAMP_REQUIRED"
    | "HEAT_TREAT_VERIFICATION"
    | "FINAL_INSPECTION";
  isCleared: boolean;
  clearedByBadgeNumber?: string;
  clearedAt?: Date;
  stampHash?: string;
  drawingRevVerified: string;
}

/**
 * Validates whether a Work Order traveler can advance to the next operation.
 * Blocks progress if any preceding mandatory hold point is uncleared or if calibrated tools have expired.
 */
export function validateTravelerStepClearance(
  targetSeq: number,
  holdPoints: DigitalTravelerHoldPoint[],
  calibratedTools: { toolId: string; expiresAt: Date }[],
): { canProceed: boolean; blockingReasons: string[] } {
  const blockingReasons: string[] = [];

  // 1. Check all prior hold points
  const priorUncleared = holdPoints.filter(
    (hp) => hp.seqNumber < targetSeq && !hp.isCleared,
  );
  for (const hp of priorUncleared) {
    blockingReasons.push(
      `Operation Seq ${hp.seqNumber} (${hp.operationCode}) has an uncleared ${hp.holdPointType} hold point.`,
    );
  }

  // 2. Check current tool calibration status
  const now = new Date();
  for (const tool of calibratedTools) {
    if (tool.expiresAt < now) {
      blockingReasons.push(
        `Assigned gauge/tool ${tool.toolId} calibration expired on ${tool.expiresAt.toISOString().split("T")[0]}. Re-calibration required before operation execution.`,
      );
    }
  }

  return {
    canProceed: blockingReasons.length === 0,
    blockingReasons,
  };
}

/**
 * Evaluates AS9102 Form 3 Characteristic Conformance
 */
export function evaluateFaiCharacteristics(
  characteristics: FaiForm3Characteristic[],
): {
  isFullyConforming: boolean;
  totalChars: number;
  conformingCount: number;
  nonConformingCount: number;
  failingBalloons: string[];
} {
  let conformingCount = 0;
  let nonConformingCount = 0;
  const failingBalloons: string[] = [];

  for (const char of characteristics) {
    const minVal = char.dimensionNominal + char.toleranceLower;
    const maxVal = char.dimensionNominal + char.toleranceUpper;
    const inSpec =
      char.measuredResult >= minVal && char.measuredResult <= maxVal;

    if (inSpec) {
      conformingCount++;
    } else {
      nonConformingCount++;
      failingBalloons.push(char.balloonNumber);
    }
  }

  return {
    isFullyConforming: nonConformingCount === 0,
    totalChars: characteristics.length,
    conformingCount,
    nonConformingCount,
    failingBalloons,
  };
}
