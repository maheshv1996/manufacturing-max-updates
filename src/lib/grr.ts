// Gage R&R (Measurement System Analysis) — AIAG 4th Edition Average & Range Method.
// Input: flat measurement records [{ appraiser, part, trial, value }].
// Output: EV (Repeatability), AV (Reproducibility), GRR, Part Variation (PV), Total Variation (TV), %GRR, NDC, verdict.

export interface GrrMeasurement {
  appraiser: string;
  part: number | string;
  trial: number;
  value: number;
}

export interface GrrResult {
  ev: number;
  av: number;
  grr: number;
  partVar: number;
  totalVar: number;
  grrPct: number;
  ndc: number;
  verdict: "ACCEPTABLE" | "CONDITIONAL" | "UNACCEPTABLE";
  appraisers: string[];
  partCount: number;
  trialCount: number;
  messages: string[];
}

// ---------------------------------------------------------------------------
// AIAG MSA multiplier constants (5.15-sigma convention).
//
// Every constant here is 5.15 / d2, where d2 is the bias-correction factor for
// the range of a subgroup. Values are kept at AIAG's published 2-decimal
// rounding so results reconcile with hand calculations and with an auditor
// spot-checking against the MSA manual tables.
//
//   K1 (Equipment Variation)  indexed by TRIAL count, uses d2 with many
//                             subgroups (g large):  K1 = 5.15 / d2(r)
//   K2 (Appraiser Variation)  indexed by APPRAISER count
//   K3 (Part Variation)       indexed by PART count
//
// K2 and K3 are the SAME FUNCTION of a single-subgroup count — both are
// 5.15 / d2*(m, g=1) — so AIAG publishes one table and uses it twice. They
// therefore share one constant here. K2 and K3 holding different values for
// the same m is always a bug; grr.test.ts asserts they cannot diverge.
// ---------------------------------------------------------------------------

/** d2* for a single subgroup (g = 1) of size m — the divisor behind AIAG_K2_K3. */
export const D2_STAR_G1: Record<number, number> = {
  2: 1.41,
  3: 1.91,
  4: 2.24,
  5: 2.48,
  6: 2.67,
  7: 2.83,
  8: 2.96,
  9: 3.08,
  10: 3.18,
  11: 3.26, // extended past AIAG's published 10-part table
  12: 3.33, // extended past AIAG's published 10-part table
};

/** K1 for EV, by number of trials. 5.15 / d2(r), g large. */
export const AIAG_K1: Record<number, number> = {
  2: 4.56,
  3: 3.05,
  4: 2.50,
  5: 2.21,
};

/**
 * K2 (by appraiser count) and K3 (by part count) — one table, 5.15 / d2*(m, 1).
 * Do not split these apart: see the note above.
 */
export const AIAG_K2_K3: Record<number, number> = {
  2: 3.65,
  3: 2.70,
  4: 2.30,
  5: 2.08,
  6: 1.93,
  7: 1.82,
  8: 1.74,
  9: 1.67,
  10: 1.62,
  11: 1.58, // extended past AIAG's published 10-part table
  12: 1.55, // extended past AIAG's published 10-part table
};

/**
 * Looks up a tabulated constant, clamping to the largest tabulated size and
 * recording a warning rather than silently substituting an arbitrary value.
 */
function lookupConstant(
  table: Record<number, number>,
  size: number,
  label: string,
  messages: string[],
): number {
  const direct = table[size];
  if (direct !== undefined) return direct;

  const sizes = Object.keys(table).map(Number);
  const max = Math.max(...sizes);
  const min = Math.min(...sizes);
  const clamped = size > max ? max : min;
  messages.push(
    `${label} count of ${size} is outside the tabulated AIAG range (${min}-${max}); ` +
      `clamped to ${clamped}. Treat this study as indicative only.`,
  );
  return table[clamped];
}

function round(n: number): number {
  return Math.round((Number(n) || 0) * 1000) / 1000;
}

export function computeGrr(rawMeasurements: GrrMeasurement[] = []): GrrResult {
  const messages: string[] = [];

  // Filter valid numerical records
  const measurements = (rawMeasurements || [])
    .filter(
      (m) =>
        m &&
        m.appraiser &&
        m.part !== undefined &&
        m.part !== null &&
        m.trial !== undefined &&
        !isNaN(Number(m.value)),
    )
    .map((m) => ({
      appraiser: String(m.appraiser).trim(),
      part: String(m.part).trim(),
      trial: Number(m.trial) || 1,
      value: Number(m.value),
    }));

  const appraisers = [...new Set(measurements.map((m) => m.appraiser))].sort();
  const partSet = [...new Set(measurements.map((m) => m.part))].sort((a, b) => {
    const numA = Number(a);
    const numB = Number(b);
    return !isNaN(numA) && !isNaN(numB) ? numA - numB : a.localeCompare(b);
  });
  const trialSet = [...new Set(measurements.map((m) => m.trial))].sort((a, b) => a - b);

  const nAppraisers = appraisers.length;
  const nParts = partSet.length;
  const nTrials = trialSet.length;

  const isValidDesign = nAppraisers >= 2 && nParts >= 2 && nTrials >= 2;
  if (!isValidDesign) {
    messages.push("MSA Study incomplete: requires at least 2 appraisers, 2 parts, and 2 trials.");
  }

  // Per-appraiser, per-part range across trials
  let totalRange = 0;
  let rangeCount = 0;
  const appraiserMeans: Record<string, number> = {};
  const partMeans: Record<string, number> = {};

  for (const appraiser of appraisers) {
    let sum = 0;
    let count = 0;
    for (const part of partSet) {
      const vals = measurements
        .filter((m) => m.appraiser === appraiser && m.part === part)
        .map((m) => m.value);
      if (vals.length >= 2) {
        const r = Math.max(...vals) - Math.min(...vals);
        totalRange += r;
        rangeCount++;
      }
      vals.forEach((v) => {
        sum += v;
        count++;
      });
    }
    appraiserMeans[appraiser] = count ? sum / count : 0;
  }

  // Part means across all appraisers and trials
  for (const part of partSet) {
    const vals = measurements
      .filter((m) => m.part === part)
      .map((m) => m.value);
    partMeans[part] = vals.length
      ? vals.reduce((a, b) => a + b, 0) / vals.length
      : 0;
  }

  const rangeBar = rangeCount ? totalRange / rangeCount : 0;

  // 1. EV — Equipment Variation (Repeatability)
  const k1 = lookupConstant(AIAG_K1, nTrials, "Trial", messages);
  const ev = rangeBar * k1;

  // 2. AV — Appraiser Variation (Reproducibility)
  const appraiserMeanVals = Object.values(appraiserMeans);
  const xDiff = appraiserMeanVals.length >= 2
    ? Math.max(...appraiserMeanVals) - Math.min(...appraiserMeanVals)
    : 0;
  const k2 = lookupConstant(AIAG_K2_K3, nAppraisers, "Appraiser", messages);
  const denom = Math.max(1, nParts * nTrials);
  const avRaw = Math.pow(xDiff * k2, 2) - Math.pow(ev, 2) / denom;
  const av = avRaw > 0 ? Math.sqrt(avRaw) : 0;

  // 3. GRR (Gage R&R)
  const grr = Math.sqrt(Math.pow(ev, 2) + Math.pow(av, 2));

  // 4. PV — Part Variation
  const partMeanVals = Object.values(partMeans);
  const rP = partMeanVals.length >= 2
    ? Math.max(...partMeanVals) - Math.min(...partMeanVals)
    : 0;
  const k3 = lookupConstant(AIAG_K2_K3, nParts, "Part", messages);
  const partVar = rP * k3;

  // 5. TV — Total Variation & %GRR
  const totalVar = Math.sqrt(Math.pow(grr, 2) + Math.pow(partVar, 2));
  let grrPct = totalVar > 0 ? (grr / totalVar) * 100 : 0;
  if (grrPct > 100) grrPct = 100;
  if (grrPct < 0) grrPct = 0;

  // 6. NDC — Number of Distinct Categories
  let ndc = grr > 0 ? Math.round(1.41 * (partVar / grr)) : 0;
  if (ndc > 50) ndc = 50;
  if (ndc < 0) ndc = 0;

  let verdict: GrrResult["verdict"] = "ACCEPTABLE";
  if (grrPct > 30) {
    verdict = "UNACCEPTABLE";
  } else if (grrPct > 10) {
    verdict = "CONDITIONAL";
  }

  if (isValidDesign) {
    if (grrPct <= 10) {
      messages.push("GRR < 10% — measurement system is acceptable for production.");
    } else if (grrPct <= 30) {
      messages.push("GRR 10–30% — conditionally acceptable depending on tolerance and risk criticalities.");
    } else {
      messages.push("GRR > 30% — measurement system is unacceptable; recalibrate instrument or retrain operators.");
    }
  }

  return {
    ev: round(ev),
    av: round(av),
    grr: round(grr),
    partVar: round(partVar),
    totalVar: round(totalVar),
    grrPct: round(grrPct),
    ndc,
    verdict,
    appraisers,
    partCount: nParts,
    trialCount: nTrials,
    messages,
  };
}

export function grrVerdictLabel(v: string): string {
  if (v === "ACCEPTABLE") return "Acceptable (<10%)";
  if (v === "CONDITIONAL") return "Conditional (10–30%)";
  if (v === "UNACCEPTABLE") return "Unacceptable (>30%)";
  return v;
}
