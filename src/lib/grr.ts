// Gage R&R (Measurement System Analysis) — AIAG average & range method.
// Input: flat measurement records [{ appraiser, part, trial, value }].
// Output: EV, AV, GRR, part variation, total variation, %GRR, NDC, verdict.

export interface GrrMeasurement {
  appraiser: string;
  part: number;
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
const K1: Record<number, number> = { 2: 4.56, 3: 3.05 };
// K2 for AV by number of appraisers
const K2: Record<number, number> = { 2: 3.65, 3: 2.7 };
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
};

export function computeGrr(measurements: GrrMeasurement[]): GrrResult {
  const messages: string[] = [];
  const appraisers = [...new Set(measurements.map((m) => m.appraiser))].sort();
  const partSet = [...new Set(measurements.map((m) => m.part))].sort(
    (a, b) => a - b,
  );
  const trialSet = [...new Set(measurements.map((m) => m.trial))].sort(
    (a, b) => a - b,
  );

  const nAppraisers = appraisers.length;
  const nParts = partSet.length;
  const nTrials = trialSet.length;

  if (nAppraisers < 2 || nParts < 2 || nTrials < 2) {
    messages.push("Need at least 2 appraisers, 2 parts, and 2 trials.");
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

  // Part means across all appraisers/trials
  for (const part of partSet) {
    const vals = measurements
      .filter((m) => m.part === part)
      .map((m) => m.value);
    partMeans[String(part)] = vals.length
      ? vals.reduce((a, b) => a + b, 0) / vals.length
      : 0;
  }

  const rangeBar = rangeCount ? totalRange / rangeCount : 0;

  // EV — Equipment variation
  const k1 = K1[nTrials] ?? 3.05;
  const ev = rangeBar * k1;

  // Appraiser range (Xdiff) — spread of appraiser means
  const appraiserMeanVals = Object.values(appraiserMeans);
  const xDiff = appraiserMeanVals.length
    ? Math.max(...appraiserMeanVals) - Math.min(...appraiserMeanVals)
    : 0;
  const k2 = K2[nAppraisers] ?? 2.7;
  const avRaw = Math.pow(xDiff * k2, 2) - Math.pow(ev, 2) / (nParts * nTrials);
  const av = avRaw > 0 ? Math.sqrt(avRaw) : 0;

  // GRR
  const grr = Math.sqrt(Math.pow(ev, 2) + Math.pow(av, 2));

  // Part variation
  const partMeanVals = Object.values(partMeans);
  const rP = partMeanVals.length
    ? Math.max(...partMeanVals) - Math.min(...partMeanVals)
    : 0;
  const k3 = K3[nParts] ?? 1.33;
  const partVar = rP * k3;

  const totalVar = Math.sqrt(Math.pow(grr, 2) + Math.pow(partVar, 2));
  const grrPct = totalVar ? (grr / totalVar) * 100 : 0;
  const ndc = grr ? Math.round(1.41 * (partVar / grr)) : 0;

  let verdict: GrrResult["verdict"] = "ACCEPTABLE";
  if (grrPct > 30) verdict = "UNACCEPTABLE";
  else if (grrPct > 10) verdict = "CONDITIONAL";

  messages.push(
    grrPct <= 10
      ? "GRR < 10% — measurement system is acceptable."
      : grrPct <= 30
        ? "GRR 10–30% — conditionally acceptable (may be acceptable based on application and cost)."
        : "GRR > 30% — measurement system is unacceptable; must improve before use.",
  );

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

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
