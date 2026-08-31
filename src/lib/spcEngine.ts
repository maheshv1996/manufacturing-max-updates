/**
 * Statistical Process Control (SPC) & Process Capability (Cp / Cpk) Engine
 * Implements standard AIAG SPC 2nd Edition formulas, X-bar / R charts, and Western Electric anomaly rules.
 */

// Standard SPC Constants for Subgroup Sizes n = 2 to 15 (AIAG SPC 2nd Edition)
export const SPC_CONSTANTS: Record<
  number,
  { A2: number; D3: number; D4: number; d2: number }
> = {
  2: { A2: 1.88, D3: 0, D4: 3.267, d2: 1.128 },
  3: { A2: 1.023, D3: 0, D4: 2.574, d2: 1.693 },
  4: { A2: 0.729, D3: 0, D4: 2.282, d2: 2.059 },
  5: { A2: 0.577, D3: 0, D4: 2.114, d2: 2.326 },
  6: { A2: 0.483, D3: 0, D4: 2.004, d2: 2.534 },
  7: { A2: 0.419, D3: 0.076, D4: 1.924, d2: 2.704 },
  8: { A2: 0.373, D3: 0.136, D4: 1.864, d2: 2.847 },
  9: { A2: 0.337, D3: 0.184, D4: 1.816, d2: 2.97 },
  10: { A2: 0.308, D3: 0.223, D4: 1.777, d2: 3.078 },
  11: { A2: 0.285, D3: 0.256, D4: 1.744, d2: 3.173 },
  12: { A2: 0.266, D3: 0.283, D4: 1.717, d2: 3.258 },
  13: { A2: 0.249, D3: 0.307, D4: 1.693, d2: 3.336 },
  14: { A2: 0.235, D3: 0.328, D4: 1.672, d2: 3.407 },
  15: { A2: 0.223, D3: 0.347, D4: 1.653, d2: 3.472 },
};

export interface SpcSubgroup {
  subgroupId: string;
  timestamp: Date;
  values: number[]; // individual measurements
}

export interface SpcChartResult {
  subgroupCount: number;
  subgroupSize: number;
  grandMeanXbarBar: number;
  averageRangeRbar: number;
  estimatedSigma: number;

  // X-bar Limits
  uclXbar: number;
  clXbar: number;
  lclXbar: number;

  // Range Limits
  uclR: number;
  clR: number;
  lclR: number;

  // Subgroup points
  points: {
    subgroupId: string;
    timestamp: Date;
    mean: number;
    range: number;
    isOutOfControlXbar: boolean;
    isOutOfControlR: boolean;
    violations: string[];
  }[];

  // Capability Metrics (if specification limits provided)
  capability?: {
    usl: number;
    lsl: number;
    cp: number;
    cpu: number;
    cpl: number;
    cpk: number;
    ppmTotal: number;
    isCapable: boolean; // Cpk >= 1.33 standard
  };
}

/**
 * Calculates X-bar and R Chart Control Limits, Subgroup Statistics, and Process Capability
 */
export function computeSpcChart(
  subgroups: SpcSubgroup[],
  specs?: { usl: number; lsl: number },
): SpcChartResult | null {
  if (!subgroups || subgroups.length === 0) return null;

  // Filter valid numeric measurements for each subgroup
  const validSubgroups = subgroups
    .map((sg) => ({
      ...sg,
      values: (sg.values || []).map(Number).filter(Number.isFinite),
    }))
    .filter((sg) => sg.values.length >= 2);

  if (validSubgroups.length === 0) return null;

  const rawN = validSubgroups[0].values.length;
  const clampedN = Math.max(2, Math.min(15, rawN));
  const constants = SPC_CONSTANTS[clampedN] || SPC_CONSTANTS[5];

  const pointsData = validSubgroups.map((sg) => {
    const sum = sg.values.reduce((acc, v) => acc + v, 0);
    const mean = sum / sg.values.length;
    const min = Math.min(...sg.values);
    const max = Math.max(...sg.values);
    const range = max - min;
    return {
      subgroupId: sg.subgroupId,
      timestamp: sg.timestamp,
      mean,
      range,
      values: sg.values,
    };
  });

  const grandMeanXbarBar =
    pointsData.reduce((acc, p) => acc + p.mean, 0) / pointsData.length;
  const averageRangeRbar =
    pointsData.reduce((acc, p) => acc + p.range, 0) / pointsData.length;

  const uclXbar = grandMeanXbarBar + constants.A2 * averageRangeRbar;
  const clXbar = grandMeanXbarBar;
  const lclXbar = grandMeanXbarBar - constants.A2 * averageRangeRbar;

  const uclR = constants.D4 * averageRangeRbar;
  const clR = averageRangeRbar;
  const lclR = constants.D3 * averageRangeRbar;

  const estimatedSigma = constants.d2 > 0 ? averageRangeRbar / constants.d2 : 0;

  // Western Electric Rule Checks
  const points = pointsData.map((p, idx) => {
    const violations: string[] = [];
    const isOutOfControlXbar = p.mean > uclXbar || p.mean < lclXbar;
    const isOutOfControlR = p.range > uclR || p.range < lclR;

    if (isOutOfControlXbar) {
      violations.push(
        "Rule 1: Point falls beyond 3-sigma Upper/Lower Control Limits",
      );
    }
    if (isOutOfControlR) {
      violations.push(
        "Rule 1 (Range): Subgroup range exceeds Range Control Limit",
      );
    }

    // Rule 2: 8 consecutive points on one side of center line
    if (idx >= 7) {
      const last8 = pointsData.slice(idx - 7, idx + 1);
      const allAbove = last8.every((pt) => pt.mean > clXbar);
      const allBelow = last8.every((pt) => pt.mean < clXbar);
      if (allAbove || allBelow) {
        violations.push(
          "Rule 2: 8 consecutive points on one side of center line (Shift detected)",
        );
      }
    }

    // Rule 3: 6 consecutive points steadily increasing or decreasing
    if (idx >= 5) {
      const last6 = pointsData.slice(idx - 5, idx + 1);
      let isIncreasing = true;
      let isDecreasing = true;
      for (let i = 1; i < last6.length; i++) {
        if (last6[i].mean <= last6[i - 1].mean) isIncreasing = false;
        if (last6[i].mean >= last6[i - 1].mean) isDecreasing = false;
      }
      if (isIncreasing || isDecreasing) {
        violations.push(
          "Rule 3: 6 consecutive points steadily trending (Trend detected)",
        );
      }
    }

    return {
      subgroupId: p.subgroupId,
      timestamp: p.timestamp,
      mean: Math.round(p.mean * 10000) / 10000,
      range: Math.round(p.range * 10000) / 10000,
      isOutOfControlXbar,
      isOutOfControlR,
      violations,
    };
  });

  let capability: SpcChartResult["capability"];
  if (
    specs &&
    Number.isFinite(specs.usl) &&
    Number.isFinite(specs.lsl) &&
    specs.usl > specs.lsl &&
    estimatedSigma > 0
  ) {
    const cp = (specs.usl - specs.lsl) / (6 * estimatedSigma);
    const cpu = (specs.usl - grandMeanXbarBar) / (3 * estimatedSigma);
    const cpl = (grandMeanXbarBar - specs.lsl) / (3 * estimatedSigma);
    const cpk = Math.min(cpu, cpl);

    // Approximate PPM calculation using normal distribution approximation
    const zU = (specs.usl - grandMeanXbarBar) / estimatedSigma;
    const zL = (grandMeanXbarBar - specs.lsl) / estimatedSigma;
    const ppmUpper = Math.max(0, 1000000 * (1 - normalCdf(zU)));
    const ppmLower = Math.max(0, 1000000 * (1 - normalCdf(zL)));

    capability = {
      usl: specs.usl,
      lsl: specs.lsl,
      cp: Math.round(cp * 100) / 100,
      cpu: Math.round(cpu * 100) / 100,
      cpl: Math.round(cpl * 100) / 100,
      cpk: Math.round(cpk * 100) / 100,
      ppmTotal: Math.round(ppmUpper + ppmLower),
      isCapable: cpk >= 1.33,
    };
  }

  return {
    subgroupCount: validSubgroups.length,
    subgroupSize: rawN,
    grandMeanXbarBar: Math.round(grandMeanXbarBar * 10000) / 10000,
    averageRangeRbar: Math.round(averageRangeRbar * 10000) / 10000,
    estimatedSigma: Math.round(estimatedSigma * 10000) / 10000,
    uclXbar: Math.round(uclXbar * 10000) / 10000,
    clXbar: Math.round(clXbar * 10000) / 10000,
    lclXbar: Math.round(lclXbar * 10000) / 10000,
    uclR: Math.round(uclR * 10000) / 10000,
    clR: Math.round(clR * 10000) / 10000,
    lclR: Math.round(lclR * 10000) / 10000,
    points,
    capability,
  };
}

function normalCdf(z: number): number {
  if (z > 6) return 1;
  if (z < -6) return 0;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
