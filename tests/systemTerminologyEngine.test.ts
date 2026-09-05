import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveTerminology,
  validateTerminologyOverrides,
  DEFAULT_TERMINOLOGY,
  type TerminologyMap,
} from "../src/lib/system/terminologyEngine.ts";

describe("System Terminology Engine — Org Label Customization", () => {
  it("resolves default canonical terms when no custom map is provided", () => {
    const term = resolveTerminology(null, "quotation");
    assert.equal(term, "Quotation");

    const woTerm = resolveTerminology({}, "work_order");
    assert.equal(woTerm, "Work Order");

    const ncrTerm = resolveTerminology(undefined, "ncr");
    assert.equal(ncrTerm, "NCR");
  });

  it("applies customized labels over canonical keys", () => {
    const customMap: TerminologyMap = {
      quotation: "Job Estimate",
      work_order: "Production Order",
      ncr: "Defect Ticket",
      customer: "Client Account",
    };

    assert.equal(resolveTerminology(customMap, "quotation"), "Job Estimate");
    assert.equal(resolveTerminology(customMap, "work_order"), "Production Order");
    assert.equal(resolveTerminology(customMap, "ncr"), "Defect Ticket");
    assert.equal(resolveTerminology(customMap, "customer"), "Client Account");

    // Uncustomized key falls back to canonical default
    assert.equal(resolveTerminology(customMap, "purchase_order"), DEFAULT_TERMINOLOGY.purchase_order);
  });

  it("validates compliant terminology override maps", () => {
    const validOverrides = {
      quotation: "Job Estimate",
      work_order: "Work Ticket",
    };

    const res = validateTerminologyOverrides(validOverrides);
    assert.equal(res.valid, true);
    assert.deepEqual(res.sanitized, validOverrides);
  });

  it("rejects non-string or excessively long term overrides", () => {
    const invalidLength = {
      quotation: "A".repeat(101),
    };
    const resLen = validateTerminologyOverrides(invalidLength);
    assert.equal(resLen.valid, false);
    assert.ok(resLen.error?.includes("100 characters"));

    const invalidType = {
      quotation: 12345,
    };
    const resType = validateTerminologyOverrides(invalidType);
    assert.equal(resType.valid, false);
    assert.ok(resType.error?.includes("must be strings"));
  });
});
