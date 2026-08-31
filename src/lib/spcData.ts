// Server-side SPC statistical calculations
import { SPC_CONSTANTS } from "./spcEngine";

export interface SpcMeasurement {
  id: string;
  value: number;
  measuredAt: string;
  characteristic: string;
  lsl: number;
  usl: number;
  target: number;
}

export interface Subgroup {
  index: number;
  values: number[];
  xbar: number;
  range: number;
  outOfControl?: boolean;
}

export interface XBarChartData {
  index: number;
  xbar: number;
  ucl: number;
  lcl: number;
  cl: number;
  outOfControl: boolean;
}

export interface RChartData {
  index: number;
  range: number;
  ucl: number;
  lcl: number;
  cl: number;
  outOfControl: boolean;
}

export interface PChartPoint {
  date: string;
  p: number;
  n: number;
  ucl: number;
  lcl: number;
  pBar: number;
  outOfControl: boolean;
}

export interface HistogramBin {
  bin: string;
  count: number;
  midpoint: number;
}

export interface CapabilityStats {
  mean: number;
  sigma: number;
  cp: number;
  cpk: number;
  lsl: number;
  usl: number;
  target: number;
  n: number;
  verdict: "Capable" | "Marginal" | "Not Capable";
}

export interface SpcStats {
  capability: CapabilityStats;
  histogram: HistogramBin[];
  xbarChart: XBarChartData[];
  rChart: RChartData[];
  pChart: PChartPoint[];
  measurements: SpcMeasurement[];
}

function mean(vals: number[]): number {
  if (vals.length === 0) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function sampleStdDev(vals: number[], mu?: number): number {
  if (vals.length <= 1) return 0;
  const m = mu ?? mean(vals);
  const variance =
    vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1);
  return Math.sqrt(variance);
}

export function computeSpcStats(
  measurements: SpcMeasurement[],
  pChartInput: { date: string; good: number; scrap: number }[] = [],
  subgroupSize: number = 5,
): SpcStats {
  if (!measurements || measurements.length === 0) {
    throw new Error("No measurements provided for SPC computation");
  }

  const vals = measurements.map((m) => Number(m.value)).filter(Number.isFinite);
  if (vals.length === 0) {
    throw new Error("No valid numeric measurements for SPC computation");
  }

  const lsl = measurements[0].lsl;
  const usl = measurements[0].usl;
  const target = measurements[0].target;

  // ── Capability ──
  const mu = mean(vals);
  const sigma = sampleStdDev(vals, mu);
  const cp = sigma > 0 && usl > lsl ? (usl - lsl) / (6 * sigma) : 0;
  const cpkUpper = sigma > 0 ? (usl - mu) / (3 * sigma) : 0;
  const cpkLower = sigma > 0 ? (mu - lsl) / (3 * sigma) : 0;
  const cpk = Math.min(cpkUpper, cpkLower);

  let verdict: CapabilityStats["verdict"];
  if (cpk >= 1.33) verdict = "Capable";
  else if (cpk >= 1.0) verdict = "Marginal";
  else verdict = "Not Capable";

  const capability: CapabilityStats = {
    mean: +mu.toFixed(5),
    sigma: +sigma.toFixed(5),
    cp: +cp.toFixed(3),
    cpk: +cpk.toFixed(3),
    lsl,
    usl,
    target,
    n: vals.length,
    verdict,
  };

  // ── Histogram ──
  const BINS = 12;
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const binWidth = (maxVal - minVal) / BINS || 0.001;
  const histCounts = new Array(BINS).fill(0);
  for (const v of vals) {
    const i = Math.min(Math.floor((v - minVal) / binWidth), BINS - 1);
    histCounts[i]++;
  }
  const histogram: HistogramBin[] = histCounts.map((count, i) => ({
    bin: `${(minVal + i * binWidth).toFixed(3)}`,
    midpoint: +(minVal + (i + 0.5) * binWidth).toFixed(4),
    count,
  }));

  // ── X-bar & R Charts with Dynamic Constants ──
  const effectiveSize = Math.max(2, Math.min(15, subgroupSize));
  const constants = SPC_CONSTANTS[effectiveSize] || SPC_CONSTANTS[5];

  const subgroups: Subgroup[] = [];
  for (
    let i = 0;
    i + effectiveSize <= measurements.length;
    i += effectiveSize
  ) {
    const chunk = measurements.slice(i, i + effectiveSize).map((m) => m.value);
    const xbar = mean(chunk);
    const range = Math.max(...chunk) - Math.min(...chunk);
    subgroups.push({ index: subgroups.length + 1, values: chunk, xbar, range });
  }

  const grandMean = mean(subgroups.map((s) => s.xbar));
  const rBar = mean(subgroups.map((s) => s.range));
  const xbarUCL = grandMean + constants.A2 * rBar;
  const xbarLCL = grandMean - constants.A2 * rBar;
  const rUCL = constants.D4 * rBar;
  const rLCL = constants.D3 * rBar;

  const xbarChart: XBarChartData[] = subgroups.map((sg) => ({
    index: sg.index,
    xbar: +sg.xbar.toFixed(5),
    ucl: +xbarUCL.toFixed(5),
    lcl: +xbarLCL.toFixed(5),
    cl: +grandMean.toFixed(5),
    outOfControl: sg.xbar > xbarUCL || sg.xbar < xbarLCL,
  }));

  const rChart: RChartData[] = subgroups.map((sg) => ({
    index: sg.index,
    range: +sg.range.toFixed(5),
    ucl: +rUCL.toFixed(5),
    lcl: +rLCL.toFixed(5),
    cl: +rBar.toFixed(5),
    outOfControl: sg.range > rUCL || sg.range < rLCL,
  }));

  // ── P Chart ──
  const totalScrap = (pChartInput || []).reduce((s, d) => s + (d.scrap || 0), 0);
  const totalParts = (pChartInput || []).reduce((s, d) => s + (d.good || 0) + (d.scrap || 0), 0);
  const pBar = totalParts > 0 ? totalScrap / totalParts : 0;

  const pChart: PChartPoint[] = (pChartInput || []).map((d) => {
    const n = (d.good || 0) + (d.scrap || 0);
    const p = n > 0 ? (d.scrap || 0) / n : 0;
    const sigma3 = n > 0 ? 3 * Math.sqrt((pBar * (1 - pBar)) / n) : 0;
    const ucl = Math.min(1, pBar + sigma3);
    const lcl = Math.max(0, pBar - sigma3);
    return {
      date: d.date,
      p: +p.toFixed(4),
      n,
      ucl: +ucl.toFixed(4),
      lcl: +lcl.toFixed(4),
      pBar: +pBar.toFixed(4),
      outOfControl: p > ucl || p < lcl,
    };
  });

  return {
    capability,
    histogram,
    xbarChart,
    rChart,
    pChart,
    measurements,
  };
}
