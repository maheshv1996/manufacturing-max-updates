/**
 * Fixed-point money (paise) regression tests — the guarantee behind the GL
 * ledger: amounts are stored and summed as integer paise so journal balance
 * checks and trial-balance totals are exact (no float dust). These tests pin
 * the conversions every money flow relies on.
 *
 * Runs on Node's built-in runner: node --test tests/money.test.ts
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  toPaise,
  fromPaise,
  roundRupees,
  formatRupees,
  isIntegralPaise,
  PAISE_PER_RUPEE,
} from "../src/lib/money.ts";

describe("toPaise", () => {
  test("exact rupees map exactly", () => {
    assert.equal(toPaise(0), 0);
    assert.equal(toPaise(12), 1200);
    assert.equal(toPaise(12.34), 1234);
    assert.equal(toPaise(100000.99), 10000099);
  });

  test("rounds to the nearest paise (half away from zero)", () => {
    assert.equal(toPaise(12.345), 1235); // half rounds up
    assert.equal(toPaise(12.344), 1234);
    assert.equal(toPaise(12.999), 1300);
    assert.equal(toPaise(-12.345), -1235); // symmetric for negatives
    assert.equal(toPaise(0.004), 0);
    assert.equal(toPaise(0.005), 1);
  });

  test("non-finite / garbage input degrades to 0, never NaN", () => {
    assert.equal(toPaise(Number.NaN), 0);
    assert.equal(toPaise(Number.POSITIVE_INFINITY), 0);
    assert.equal(toPaise("12.50" as unknown as number), 1250);
  });
});

describe("fromPaise", () => {
  test("returns the exact 2dp rupee value", () => {
    assert.equal(fromPaise(1234), 12.34);
    assert.equal(fromPaise(0), 0);
    assert.equal(fromPaise(-500), -5);
    assert.equal(fromPaise(1234567), 12345.67);
  });

  test("round-trips with toPaise for 2dp values", () => {
    for (const r of [0.01, 0.1, 1.1, 12.34, 999.99, 123456.78]) {
      assert.equal(fromPaise(toPaise(r)), r);
    }
  });
});

describe("roundRupees / isIntegralPaise / formatRupees", () => {
  test("roundRupees cleans display-side floats", () => {
    assert.equal(roundRupees(0.1 + 0.2), 0.3);
    assert.equal(roundRupees(12.345), 12.35);
  });

  test("isIntegralPaise accepts integers only", () => {
    assert.equal(isIntegralPaise(1234), true);
    assert.equal(isIntegralPaise(1234.5), false);
  });

  test("formatRupees prints Indian-locale 2dp", () => {
    assert.equal(formatRupees(1234567), "12,345.67");
    assert.equal(formatRupees(0), "0.00");
  });

  test("scale constant is 100 paise per rupee", () => {
    assert.equal(PAISE_PER_RUPEE, 100);
  });
});
