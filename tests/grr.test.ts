/**
 * Gage R&R (MSA) engine tests — AIAG Average & Range method.
 *
 * Runs on Node's built-in test runner with native TypeScript type stripping:
 *     node --test tests/grr.test.ts
 * No third-party test framework is involved, which keeps the offline/air-gapped
 * build free of extra dependencies.
 *
 * The constant-table tests exist because a real defect shipped in this file: the
 * K3 (part variation) table held values from the wrong column, so PV and TV were
 * understated and %GRR was inflated — measurement systems were failed that
 * should have passed. K2 and K3 are the same function of subgroup size, so the
 * consistency test below is the guard that would have caught it.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeGrr,
  grrVerdictLabel,
  AIAG_K1,
  AIAG_K2_K3,
  D2_STAR_G1,
  type GrrMeasurement,
} from "../src/lib/grr";

/** Asserts `actual` is within `eps` of `expected`. */
function closeTo(actual: number, expected: number, eps = 0.0005): void {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${actual} to be within ${eps} of ${expected}`,
  );
}

/**
 * 2 appraisers x 3 parts x 2 trials. Every within-part range is exactly 0.2 and
 * appraiser B is biased +0.4 against A, so every intermediate quantity is
 * hand-computable. The worked arithmetic is in the assertions below.
 */
function textbookStudy(): GrrMeasurement[] {
  const rows: GrrMeasurement[] = [];
  const base: Record<string, number> = { "1": 10.0, "2": 12.0, "3": 14.0 };
  const bias: Record<string, number> = { A: 0, B: 0.4 };
  for (const appraiser of ["A", "B"]) {
    for (const part of ["1", "2", "3"]) {
      const v = base[part] + bias[appraiser];
      rows.push({ appraiser, part, trial: 1, value: v });
      rows.push({ appraiser, part, trial: 2, value: v + 0.2 });
    }
  }
  return rows;
}

describe("AIAG constant tables", () => {
  test("K1 (equipment variation, by trial count) matches published AIAG values", () => {
    assert.deepEqual(AIAG_K1, { 2: 4.56, 3: 3.05, 4: 2.5, 5: 2.21 });
  });

  test("K2/K3 matches published AIAG values", () => {
    // AIAG publishes this table twice: as K2 indexed by appraiser count and as
    // K3 indexed by part count. Regression guard: K3[10] must be 1.62, not 1.33.
    assert.deepEqual(AIAG_K2_K3, {
      2: 3.65,
      3: 2.7,
      4: 2.3,
      5: 2.08,
      6: 1.93,
      7: 1.82,
      8: 1.74,
      9: 1.67,
      10: 1.62,
      11: 1.58,
      12: 1.55,
    });
  });

  test("the historical K3 defect cannot reappear", () => {
    // Shipped values were K3 = {3:1.91, 4:1.74, 5:1.62, 6:1.53, 7:1.46, 8:1.41,
    // 9:1.37, 10:1.33, 11:1.30, 12:1.28} — the AIAG sequence read off by the
    // wrong offset, with K3[3] taking d2*(3,1) itself. Each understated K3
    // understates PV and TV, which inflates %GRR and fails good gauges.
    const shipped: Record<number, number> = {
      3: 1.91, 4: 1.74, 5: 1.62, 6: 1.53, 7: 1.46,
      8: 1.41, 9: 1.37, 10: 1.33, 11: 1.3, 12: 1.28,
    };
    for (const key of Object.keys(shipped)) {
      const m = Number(key);
      assert.notEqual(
        AIAG_K2_K3[m],
        shipped[m],
        `K3[${m}] regressed to the known-bad value ${shipped[m]}`,
      );
    }
    assert.notEqual(AIAG_K2_K3[3], D2_STAR_G1[3]);
  });

  test("one table serves both appraiser counts and part counts", () => {
    // K2 is indexed by appraisers (realistically 2-5) and K3 by parts (2-10+).
    // A single table must cover the union, or the two uses have diverged again.
    for (const m of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      assert.equal(typeof AIAG_K2_K3[m], "number", `missing constant for m=${m}`);
    }
  });

  test("every K2/K3 constant is 5.15 / d2*(m, 1) within published rounding", () => {
    for (const key of Object.keys(AIAG_K2_K3)) {
      const m = Number(key);
      closeTo(AIAG_K2_K3[m], 5.15 / D2_STAR_G1[m], 0.005);
    }
  });

  test("every K1 constant is 5.15 / d2(r) within published rounding", () => {
    const d2: Record<number, number> = { 2: 1.128, 3: 1.693, 4: 2.059, 5: 2.326 };
    for (const key of Object.keys(AIAG_K1)) {
      const r = Number(key);
      closeTo(AIAG_K1[r], 5.15 / d2[r], 0.01);
    }
  });
});

describe("computeGrr — Average & Range method", () => {
  test("reproduces the full EV/AV/GRR/PV/TV chain by hand", () => {
    const r = computeGrr(textbookStudy());

    assert.deepEqual(r.appraisers, ["A", "B"]);
    assert.equal(r.partCount, 3);
    assert.equal(r.trialCount, 2);

    // Every within-part range is 0.2, so R-bar = 0.2. K1(2 trials) = 4.56.
    // EV = 0.2 * 4.56 = 0.912
    closeTo(r.ev, 0.912);

    // Appraiser means are 12.1 (A) and 12.5 (B), so X-diff = 0.4.
    // K2(2 appraisers) = 3.65, denom = parts * trials = 6.
    // AV = sqrt((0.4 * 3.65)^2 - 0.912^2 / 6) = sqrt(2.1316 - 0.138624) = 1.41174
    closeTo(r.av, 1.412);

    // GRR = sqrt(0.912^2 + 1.41174^2) = sqrt(2.82472) = 1.68069
    closeTo(r.grr, 1.681);

    // Part means are 10.3 / 12.3 / 14.3, so R-part = 4.0. K3(3 parts) = 2.70.
    // PV = 4.0 * 2.70 = 10.8
    closeTo(r.partVar, 10.8);

    // TV = sqrt(1.68069^2 + 10.8^2) = sqrt(119.46472) = 10.92999
    closeTo(r.totalVar, 10.93);

    // %GRR = 1.68069 / 10.92999 * 100 = 15.3769
    closeTo(r.grrPct, 15.377);

    // NDC = round(1.41 * PV / GRR) = round(1.41 * 6.42593) = round(9.0606) = 9
    assert.equal(r.ndc, 9);

    assert.equal(r.verdict, "CONDITIONAL");
  });

  test("the corrected K3 raises PV by 41% on a 3-part study", () => {
    // Guards the fix: PV = R-part * K3. With the shipped K3[3] of 1.91 this was
    // 4.0 * 1.91 = 7.64, which inflated %GRR from 15.4% to 21.5%.
    const r = computeGrr(textbookStudy());
    closeTo(r.partVar, 10.8);
    assert.notEqual(r.partVar, 7.64);
    assert.ok(r.grrPct < 20, `%GRR should be ~15.4, got ${r.grrPct}`);
  });
});

/**
 * The same 2x3x2 shape as textbookStudy() with a tunable part-to-part spread.
 * EV and AV are held fixed (every range is 0.2, appraiser bias is 0.4), so
 * `spread` is the only lever on %GRR: wide parts drive it down, narrow parts up.
 */
function gradedStudy(spread: number): GrrMeasurement[] {
  const rows: GrrMeasurement[] = [];
  for (const [appraiser, bias] of [["A", 0], ["B", 0.4]] as const) {
    for (let p = 1; p <= 3; p++) {
      const v = 10 + (p - 1) * spread + bias;
      rows.push({ appraiser, part: p, trial: 1, value: v });
      rows.push({ appraiser, part: p, trial: 2, value: v + 0.2 });
    }
  }
  return rows;
}

/** 2 appraisers x nParts x 2 trials, no appraiser bias. Drives the clamp tests. */
function wideStudy(nParts: number): GrrMeasurement[] {
  const rows: GrrMeasurement[] = [];
  for (const appraiser of ["A", "B"]) {
    for (let p = 1; p <= nParts; p++) {
      rows.push({ appraiser, part: p, trial: 1, value: 10 + p });
      rows.push({ appraiser, part: p, trial: 2, value: 10 + p + 0.2 });
    }
  }
  return rows;
}

describe("computeGrr — verdict thresholds", () => {
  test("the spread lever reproduces the textbook study at spread = 2", () => {
    assert.deepEqual(computeGrr(gradedStudy(2)), computeGrr(textbookStudy()));
  });

  test("wide part spread is ACCEPTABLE", () => {
    // spread 10 -> R-part 20, PV = 20 * 2.70 = 54. GRR is unchanged at 1.68069.
    // TV = sqrt(2.82472 + 2916) = 54.02615, so %GRR = 3.111.
    const r = computeGrr(gradedStudy(10));
    closeTo(r.partVar, 54);
    closeTo(r.grrPct, 3.111);
    assert.equal(r.verdict, "ACCEPTABLE");
    assert.equal(r.ndc, 45); // round(1.41 * 54 / 1.68069)
    assert.ok(r.messages.some((m) => m.includes("acceptable for production")));
  });

  test("narrow part spread is UNACCEPTABLE", () => {
    // spread 0.5 -> R-part 1.0, PV = 1.0 * 2.70 = 2.70.
    // TV = sqrt(2.82472 + 7.29) = 3.180365, so %GRR = 52.846.
    const r = computeGrr(gradedStudy(0.5));
    closeTo(r.partVar, 2.7);
    closeTo(r.grrPct, 52.846);
    assert.equal(r.verdict, "UNACCEPTABLE");
    assert.equal(r.ndc, 2); // round(1.41 * 2.70 / 1.68069)
    assert.ok(r.messages.some((m) => m.includes("recalibrate")));
  });

  test("the middle band is CONDITIONAL and says so", () => {
    const r = computeGrr(gradedStudy(2));
    assert.equal(r.verdict, "CONDITIONAL");
    assert.ok(r.messages.some((m) => m.includes("conditionally acceptable")));
  });
});

describe("computeGrr — degenerate and out-of-range studies", () => {
  test("a part count past the table is clamped, warned about, and still computes", () => {
    // 13 parts is past AIAG's tabulated range, so K3 falls back to K3[12] = 1.55.
    // Part means are 11.1 .. 23.1 -> R-part 12, PV = 12 * 1.55 = 18.6.
    const r = computeGrr(wideStudy(13));
    assert.equal(r.partCount, 13);
    closeTo(r.partVar, 18.6);
    closeTo(r.grrPct, 4.897);
    assert.ok(
      r.messages.some((m) => m.includes("Part count of 13 is outside the tabulated")),
      `expected a clamp warning, got ${JSON.stringify(r.messages)}`,
    );
    assert.ok(r.messages.some((m) => m.includes("indicative only")));
  });

  test("a single-appraiser study is rejected, and the K2 lookup clamps up to 2", () => {
    const r = computeGrr(textbookStudy().filter((m) => m.appraiser === "A"));
    assert.deepEqual(r.appraisers, ["A"]);
    assert.ok(r.messages[0].startsWith("MSA Study incomplete"));
    assert.ok(r.messages.some((m) => m.includes("Appraiser count of 1")));
    // One appraiser cannot disagree with anyone, so AV collapses and GRR = EV.
    assert.equal(r.av, 0);
    closeTo(r.grr, r.ev);
    // An invalid design must not emit a verdict narrative.
    assert.ok(!r.messages.some((m) => m.startsWith("GRR")));
  });

  test("malformed rows are dropped rather than poisoning the result", () => {
    const clean = textbookStudy();
    const noisy: GrrMeasurement[] = [
      ...clean,
      { appraiser: "C", part: 9, trial: 1, value: Number.NaN },
      { appraiser: "", part: 9, trial: 1, value: 5 },
      { appraiser: "D", part: null, trial: 1, value: 5 } as unknown as GrrMeasurement,
      { appraiser: "E", part: 9, value: 5 } as unknown as GrrMeasurement,
      null as unknown as GrrMeasurement,
    ];
    assert.deepEqual(computeGrr(noisy), computeGrr(clean));
  });

  test("numeric strings are coerced, so CSV imports need no pre-parsing", () => {
    const asStrings = textbookStudy().map((m) => ({
      ...m,
      trial: String(m.trial) as unknown as number,
      value: String(m.value) as unknown as number,
    }));
    assert.deepEqual(computeGrr(asStrings), computeGrr(textbookStudy()));
  });

  test("an empty study reports zeros and explains why", () => {
    const r = computeGrr();
    assert.equal(r.ev, 0);
    assert.equal(r.av, 0);
    assert.equal(r.grr, 0);
    assert.equal(r.partVar, 0);
    assert.equal(r.totalVar, 0);
    assert.equal(r.grrPct, 0);
    assert.equal(r.ndc, 0);
    assert.deepEqual(r.appraisers, []);
    assert.equal(r.partCount, 0);
    assert.equal(r.trialCount, 0);
    assert.ok(r.messages[0].startsWith("MSA Study incomplete"));
    // Callers must gate on `messages`, not on `verdict`: with no data there is no
    // %GRR to fail, so the verdict field falls through to its ACCEPTABLE default.
    assert.equal(r.verdict, "ACCEPTABLE");
  });
});

describe("grrVerdictLabel", () => {
  test("maps each verdict onto its AIAG band", () => {
    assert.equal(grrVerdictLabel("ACCEPTABLE"), "Acceptable (<10%)");
    assert.equal(grrVerdictLabel("CONDITIONAL"), "Conditional (10–30%)");
    assert.equal(grrVerdictLabel("UNACCEPTABLE"), "Unacceptable (>30%)");
  });

  test("passes through anything it does not recognise", () => {
    assert.equal(grrVerdictLabel("PENDING"), "PENDING");
  });
});
