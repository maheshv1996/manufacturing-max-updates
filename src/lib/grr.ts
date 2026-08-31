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

// d2* constants (AIAG Table 3): K1 for EV by number of trials
const K1: Record<number, number> = {
  2: 4.56,
  3: 3.05,
  4: 2.50,
  5: 2.21,
};

// K2 for AV by number of appraisers
const K2: Record<number, number> = {
  2: 3.65,
  3: 2.70,
  4: 2.30,
  5: 2.08,
};

// K3 for PV by number of parts
const K3: Record<number, number> = {
  2: 3.65,
  3: 1.91,
  4: 1.74,
  5: 1.62,
  6: 1.53,
  7: 1.46,
  8: 1.41,
  9: 1.37,
  10: 1.33,
  11: 1.30,
  12: 1.28,
};

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
  const k1 = K1[nTrials] ?? (nTrials > 5 ? 2.0 : 3.05);
  const ev = rangeBar * k1;

  // 2. AV — Appraiser Variation (Reproducibility)
  const appraiserMeanVals = Object.values(appraiserMeans);
  const xDiff = appraiserMeanVals.length >= 2
    ? Math.max(...appraiserMeanVals) - Math.min(...appraiserMeanVals)
    : 0;
  const k2 = K2[nAppraisers] ?? (nAppraisers > 5 ? 1.8 : 2.70);
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
  const k3 = K3[nParts] ?? (nParts > 12 ? 1.25 : 1.33);
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
