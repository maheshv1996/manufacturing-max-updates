/**
 * MRB disposition policy regression tests.
 *
 * A real defect shipped here: the disposition-authority field was a schema
 * enum with NO UI control and the RTV option sent RETURN_TO_VENDOR (not a
 * schema value), so the Disposition button 500'd for every MRB user. These
 * tests pin the normalization that now guards the route.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMrbDisposition,
  normalizeMrbAuthority,
} from "../src/lib/mrbPolicy.ts";

describe("normalizeMrbDisposition", () => {
  test("accepts every canonical enum value", () => {
    assert.equal(normalizeMrbDisposition("USE_AS_IS"), "USE_AS_IS");
    assert.equal(normalizeMrbDisposition("REWORK"), "REWORK");
    assert.equal(normalizeMrbDisposition("SCRAP"), "SCRAP");
    assert.equal(normalizeMrbDisposition("RETURN_TO_SUPPLIER"), "RETURN_TO_SUPPLIER");
  });

  test("coerces the legacy RETURN_TO_VENDOR UI label to the schema enum", () => {
    assert.equal(normalizeMrbDisposition("RETURN_TO_VENDOR"), "RETURN_TO_SUPPLIER");
    assert.equal(normalizeMrbDisposition("return_to_vendor"), "RETURN_TO_SUPPLIER");
  });

  test("is case/whitespace tolerant", () => {
    assert.equal(normalizeMrbDisposition(" scrap "), "SCRAP");
    assert.equal(normalizeMrbDisposition("Use-As-Is"), undefined); // labels are not values
  });

  test("returns undefined for anything the schema cannot store (no crash path)", () => {
    assert.equal(normalizeMrbDisposition(undefined), undefined);
    assert.equal(normalizeMrbDisposition(null), undefined);
    assert.equal(normalizeMrbDisposition(""), undefined);
    assert.equal(normalizeMrbDisposition("DISPOSE"), undefined);
    assert.equal(normalizeMrbDisposition(42), undefined);
  });
});

describe("normalizeMrbAuthority", () => {
  test("accepts canonical authorities and tolerates case", () => {
    assert.equal(normalizeMrbAuthority("QUALITY"), "QUALITY");
    assert.equal(normalizeMrbAuthority("engineering"), "ENGINEERING");
    assert.equal(normalizeMrbAuthority(" Customer "), "CUSTOMER");
  });

  test("rejects everything else instead of 500-ing", () => {
    assert.equal(normalizeMrbAuthority(undefined), undefined);
    assert.equal(normalizeMrbAuthority(""), undefined);
    assert.equal(normalizeMrbAuthority("quality-mrb-chair"), undefined);
    assert.equal(normalizeMrbAuthority("CEO"), undefined);
  });
});
