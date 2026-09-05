/**
 * C3-2 — Pure 8D state machine (DEPTH_04 W5; schema `EightDStatus`).
 * Forward-only, single-step advance. Leaving an evidence-bearing stage
 * requires that stage's evidence (containment, root cause, corrective,
 * preventive, verification). Entering D8_CLOSURE requires ALL of D4–D7
 * evidence — guardrail G-3 ("cannot reach closure without D4–D7 evidence").
 * CLOSED additionally requires the quality-manager review flag.
 */
export type EightDStage =
  | "D1_TEAM"
  | "D2_PROBLEM"
  | "D3_CONTAINMENT"
  | "D4_ROOT_CAUSE"
  | "D5_CORRECTIVE"
  | "D6_PREVENTIVE"
  | "D7_VERIFY"
  | "D8_CLOSURE"
  | "CLOSED";

export interface EightDEvidence {
  containmentRecorded?: boolean;
  d4RootCause?: string;
  d5Corrective?: string;
  d6Preventive?: string;
  d7Verification?: string;
}

export interface AdvanceOptions {
  /** Quality-manager review, required to enter CLOSED (G-3 review). */
  reviewed?: boolean;
  /** Explicit target — only the immediate next stage is legal. */
  to?: EightDStage;
}

export type EightDResult =
  | { ok: true; status: EightDStage }
  | {
      ok: false;
      code: "EVIDENCE_MISSING" | "REVIEW_REQUIRED" | "ILLEGAL_TRANSITION";
      message: string;
      missing?: string[];
    };

const ORDER: EightDStage[] = [
  "D1_TEAM",
  "D2_PROBLEM",
  "D3_CONTAINMENT",
  "D4_ROOT_CAUSE",
  "D5_CORRECTIVE",
  "D6_PREVENTIVE",
  "D7_VERIFY",
  "D8_CLOSURE",
  "CLOSED",
];

const STAGE_EVIDENCE: Record<string, { key: keyof EightDEvidence; label: string }[]> = {
  D3_CONTAINMENT: [{ key: "containmentRecorded", label: "containment" }],
  D4_ROOT_CAUSE: [{ key: "d4RootCause", label: "root cause" }],
  D5_CORRECTIVE: [{ key: "d5Corrective", label: "corrective" }],
  D6_PREVENTIVE: [{ key: "d6Preventive", label: "preventive" }],
  D7_VERIFY: [{ key: "d7Verification", label: "verification" }],
};

function evidenceOk(ev: EightDEvidence, checks: { key: keyof EightDEvidence; label: string }[]): string[] {
  return checks.filter((c) => {
    const v = ev[c.key];
    return v === undefined || v === "" || v === false;
  }).map((c) => c.label);
}

const missingResult = (missing: string[]): EightDResult => ({
  ok: false,
  code: "EVIDENCE_MISSING",
  message: `Evidence required before advancing: ${missing.join(", ")}`,
  missing,
});

export function advanceEightD(current: EightDStage, evidence: EightDEvidence, opts: AdvanceOptions = {}): EightDResult {
  const idx = ORDER.indexOf(current);
  if (current === "CLOSED") {
    return { ok: false, code: "ILLEGAL_TRANSITION", message: "A CLOSED 8D is terminal" };
  }

  if (opts.to && opts.to !== ORDER[idx + 1]) {
    return { ok: false, code: "ILLEGAL_TRANSITION", message: `Only the next stage (${ORDER[idx + 1]}) can follow ${current}` };
  }

  // G-3: entering D8_CLOSURE requires all of D4-D7 evidence.
  if (current === "D7_VERIFY") {
    const all = evidenceOk(evidence, [
      ...STAGE_EVIDENCE.D4_ROOT_CAUSE,
      ...STAGE_EVIDENCE.D5_CORRECTIVE,
      ...STAGE_EVIDENCE.D6_PREVENTIVE,
      ...STAGE_EVIDENCE.D7_VERIFY,
    ]);
    if (all.length > 0) return missingResult(all);
  } else {
    const missing = evidenceOk(evidence, STAGE_EVIDENCE[current] ?? []);
    if (missing.length > 0) return missingResult(missing);
  }

  const next = ORDER[idx + 1];
  if (next === "CLOSED" && opts.reviewed !== true) {
    return { ok: false, code: "REVIEW_REQUIRED", message: "Quality-manager review is required to close an 8D" };
  }
  return { ok: true, status: next };
}