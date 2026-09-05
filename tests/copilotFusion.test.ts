import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fuseDeterministicMetrics,
  verifyMetricsConsistency,
  type EngineMetricsPayload,
} from "../src/lib/copilot/fusion.ts";

describe("Copilot Fusion — Principle 7 (Deterministic Numbers)", () => {
  it("fuses authoritative numbers into templated slots without LLM drift", () => {
    const template =
      "Machine {{machineCode}} achieved an OEE of {{oeePct}}% with a scrap cost penalty of ₹{{scrapCostRupees}}.";
    const metrics: EngineMetricsPayload = {
      machineCode: "CNC-04",
      oeePct: 84.5,
      scrapCostPaise: 125050, // ₹1,250.50
    };

    const fused = fuseDeterministicMetrics(template, metrics);
    assert.equal(
      fused,
      "Machine CNC-04 achieved an OEE of 84.5% with a scrap cost penalty of ₹1250.50.",
    );
  });

  it("detects and overrides conflicting LLM hallucinated numbers with engine truth", () => {
    // Model generated text claiming OEE is 92% and scrap is ₹500, but engine shows 78.2% and ₹2,100.00
    const llmGeneratedText =
      "System analysis shows OEE is 92% with estimated scrap cost of ₹500.00.";
    const authoritativeMetrics: EngineMetricsPayload = {
      oeePct: 78.2,
      scrapCostPaise: 210000,
    };

    const result = verifyMetricsConsistency(llmGeneratedText, authoritativeMetrics);
    assert.equal(result.hasDiscrepancy, true);
    assert.ok(result.discrepancies.some((d) => d.metric === "oeePct"));
    assert.ok(result.rectifiedText.includes("78.2%"));
    assert.ok(result.rectifiedText.includes("₹2100.00"));
    assert.ok(result.rectifiedText.includes("System verified:"));
  });

  it("passes when LLM text already accurately reflects engine metrics", () => {
    const llmGeneratedText = "Plant OEE reached 85.0% today.";
    const authoritativeMetrics: EngineMetricsPayload = {
      oeePct: 85.0,
    };

    const result = verifyMetricsConsistency(llmGeneratedText, authoritativeMetrics);
    assert.equal(result.hasDiscrepancy, false);
    assert.equal(result.discrepancies.length, 0);
  });
});
