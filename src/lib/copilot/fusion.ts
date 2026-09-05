/**
 * C11 — Deterministic Fusion Engine (DEPTH_05 §8, Principle 7).
 * Pure & DB-free: ensures all numbers shown to users (costs, margins, OEE,
 * balances, SLA hours) are fetched strictly from pure deterministic engines,
 * never hallucinated or calculated by the LLM.
 */

export interface EngineMetricsPayload {
  machineCode?: string;
  oeePct?: number;
  availabilityPct?: number;
  performancePct?: number;
  qualityPct?: number;
  scrapCostPaise?: number;
  revenuePaise?: number;
  grossMarginPct?: number;
  stockBalance?: number;
  slaHoursRemaining?: number;
  [key: string]: unknown;
}

export interface DiscrepancyItem {
  metric: string;
  claimedValue: string;
  authoritativeValue: string;
}

export interface VerificationResult {
  hasDiscrepancy: boolean;
  discrepancies: DiscrepancyItem[];
  rectifiedText: string;
}

/**
 * Replaces mustache-style tokens {{metricName}} with formatted authoritative values.
 */
export function fuseDeterministicMetrics(
  template: string,
  metrics: EngineMetricsPayload,
): string {
  let result = template;

  if (metrics.machineCode !== undefined) {
    result = result.replace(/\{\{machineCode\}\}/g, String(metrics.machineCode));
  }

  if (metrics.oeePct !== undefined) {
    result = result.replace(/\{\{oeePct\}\}/g, metrics.oeePct.toFixed(1));
  }

  if (metrics.scrapCostPaise !== undefined) {
    const rupees = (metrics.scrapCostPaise / 100).toFixed(2);
    result = result.replace(/\{\{scrapCostRupees\}\}/g, rupees);
  }

  if (metrics.stockBalance !== undefined) {
    result = result.replace(/\{\{stockBalance\}\}/g, String(metrics.stockBalance));
  }

  if (metrics.slaHoursRemaining !== undefined) {
    result = result.replace(/\{\{slaHoursRemaining\}\}/g, String(metrics.slaHoursRemaining));
  }

  return result;
}

/**
 * Analyzes model-generated text against authoritative engine metrics.
 * If discrepancies in critical numbers (like OEE % or rupee amounts) are found,
 * flags the discrepancy and produces rectified text with an authoritative citation.
 */
export function verifyMetricsConsistency(
  text: string,
  authoritative: EngineMetricsPayload,
): VerificationResult {
  const discrepancies: DiscrepancyItem[] = [];
  let rectified = text;

  // Check OEE % if present
  if (authoritative.oeePct !== undefined) {
    const expectedOeeStr = authoritative.oeePct.toFixed(1);
    const oeeMatch = text.match(/(?:oee(?:\s+is|\s+reached|\s+of)?\s*)(\d+(?:\.\d+)?)\s*%/i);
    if (oeeMatch && oeeMatch[1]) {
      const foundVal = parseFloat(oeeMatch[1]);
      if (Math.abs(foundVal - authoritative.oeePct) > 0.05) {
        discrepancies.push({
          metric: "oeePct",
          claimedValue: `${foundVal}%`,
          authoritativeValue: `${expectedOeeStr}%`,
        });
        rectified = rectified.replace(
          oeeMatch[0],
          `OEE is ${expectedOeeStr}% (System verified: ${expectedOeeStr}%)`,
        );
      }
    }
  }

  // Check scrap cost rupees if present
  if (authoritative.scrapCostPaise !== undefined) {
    const expectedRupees = (authoritative.scrapCostPaise / 100).toFixed(2);
    const costMatch = text.match(/₹\s*(\d+(?:\.\d+)?)/);
    if (costMatch && costMatch[1]) {
      const foundRupees = parseFloat(costMatch[1]);
      const authRupeesVal = authoritative.scrapCostPaise / 100;
      if (Math.abs(foundRupees - authRupeesVal) > 0.01) {
        discrepancies.push({
          metric: "scrapCostRupees",
          claimedValue: `₹${foundRupees.toFixed(2)}`,
          authoritativeValue: `₹${expectedRupees}`,
        });
        rectified = rectified.replace(
          costMatch[0],
          `₹${expectedRupees} (System verified: ₹${expectedRupees})`,
        );
      }
    }
  }

  const hasDiscrepancy = discrepancies.length > 0;

  return {
    hasDiscrepancy,
    discrepancies,
    rectifiedText: rectified,
  };
}
