/**
 * SPC engine tests — X-bar/R control charts, Western Electric rules, Cp/Cpk.
 *
 *     node --test tests/spcEngine.test.ts
 *
 * Two kinds of test live here, and the distinction matters:
 *
 *   1. Structural tests on SPC_CONSTANTS. Every published constant is a known
 *      function of the subgroup size, so the table can be checked against its
 *      own definition rather than against a transcription. This is the class of
 *      test that caught the K3 defect in grr.ts, so the same net is cast here.
 *
 *   2. Fixtures whose arithmetic is hand-computable end to end. Subgroups are
 *      built as [m-s, m-s/2, m, m+s/2, m+s], which has mean exactly m and range
 *      exactly 2s, so R-bar and X-bar-bar are known before the engine runs.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeSpcChart,
  SPC_CONSTANTS,
  type SpcSubgroup,
} from "../src/lib/spcEngine";
import { AIAG_K1 } from "../src/lib/grr";

const SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

/** Asserts `actual` is within `eps` of `expected`. */
function closeTo(actual: number, expected: number, eps = 0.0005): void {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${actual} to be within ${eps} of ${expected}`,
  );
}

/**
 * A subgroup of 5 with mean exactly `mean` and range exactly `2 * spread`.
 * Default spread 1 gives range 2, which keeps A2 * R-bar = 1.154 for n = 5.
 */
function sg(index: number, mean: number, spread = 1): SpcSubgroup {
  return {
    subgroupId: `SG-${index}`,
    timestamp: new Date(Date.UTC(2026, 0, 1, index)),
    values: [mean - spread, mean - spread / 2, mean, mean + spread / 2, mean + spread],
  };
}

/** Builds a run of subgroups from a list of means, all with range 2. */
function run(means: number[]): SpcSubgroup[] {
  return means.map((m, i) => sg(i, m));
}

describe("SPC_CONSTANTS", () => {
  test("covers exactly subgroup sizes 2 through 15", () => {
    assert.deepEqual(Object.keys(SPC_CONSTANTS).map(Number), SIZES);
  });

  test("A2 equals 3 / (d2 * sqrt(n)) within published rounding", () => {
    // A2 is defined by the table's own d2 column, so a mis-transcribed A2 or a
    // shifted d2 column cannot both satisfy this.
    for (const n of SIZES) {
      const { A2, d2 } = SPC_CONSTANTS[n];
      closeTo(A2, 3 / (d2 * Math.sqrt(n)), 0.001);
    }
  });

  test("D3 + D4 = 2 wherever D3 is not truncated at zero", () => {
    // D3 = 1 - 3*d3/d2 and D4 = 1 + 3*d3/d2, so they straddle 2. Below n = 7 the
    // lower factor goes negative and AIAG publishes 0 instead. A transposed
    // D3/D4 column would break this.
    for (const n of SIZES) {
      const { D3, D4 } = SPC_CONSTANTS[n];
      if (n >= 7) {
        assert.ok(D3 > 0, `D3 should be positive at n=${n}`);
        closeTo(D3 + D4, 2, 0.0005);
      } else {
        assert.equal(D3, 0, `D3 should be truncated to 0 at n=${n}`);
        assert.ok(D4 > 2, `D4 should exceed 2 at n=${n}`);
      }
    }
  });

  test("A2 and D4 fall, d2 rises, D3 never falls as n grows", () => {
    for (let i = 1; i < SIZES.length; i++) {
      const lo = SPC_CONSTANTS[SIZES[i - 1]];
      const hi = SPC_CONSTANTS[SIZES[i]];
      assert.ok(hi.A2 < lo.A2, `A2 not decreasing at n=${SIZES[i]}`);
      assert.ok(hi.D4 < lo.D4, `D4 not decreasing at n=${SIZES[i]}`);
      assert.ok(hi.d2 > lo.d2, `d2 not increasing at n=${SIZES[i]}`);
      assert.ok(hi.D3 >= lo.D3, `D3 decreased at n=${SIZES[i]}`);
    }
  });

  test("the SPC d2 column agrees with the Gage R&R K1 table", () => {
    // grr.ts's K1 is 5.15 / d2(r) over the same d2. The two engines must not
    // disagree about d2, or an SPC sigma and an MSA EV computed from the same
    // data would tell different stories.
    for (const key of Object.keys(AIAG_K1)) {
      const r = Number(key);
      closeTo(AIAG_K1[r], 5.15 / SPC_CONSTANTS[r].d2, 0.01);
    }
  });
});

describe("computeSpcChart — control limits", () => {
  test("reproduces every X-bar/R limit by hand for n = 5, R-bar = 2", () => {
    const r = computeSpcChart(run([10, 10, 10, 10, 10]));
    assert.ok(r, "expected a result");

    assert.equal(r.subgroupCount, 5);
    assert.equal(r.subgroupSize, 5);
    closeTo(r.grandMeanXbarBar, 10);
    closeTo(r.averageRangeRbar, 2);

    // A2(5) = 0.577, so A2 * R-bar = 1.154
    closeTo(r.uclXbar, 11.154);
    closeTo(r.clXbar, 10);
    closeTo(r.lclXbar, 8.846);

    // D4(5) = 2.114 -> 4.228; D3(5) = 0 -> 0
    closeTo(r.uclR, 4.228);
    closeTo(r.clR, 2);
    closeTo(r.lclR, 0);

    // sigma-hat = R-bar / d2(5) = 2 / 2.326 = 0.8598
    closeTo(r.estimatedSigma, 0.8598);

    // A perfectly stable process must trip nothing at all.
    assert.deepEqual(
      r.points.flatMap((p) => p.violations),
      [],
    );
    assert.ok(r.points.every((p) => !p.isOutOfControlXbar && !p.isOutOfControlR));
    assert.deepEqual(
      r.points.map((p) => p.subgroupId),
      ["SG-0", "SG-1", "SG-2", "SG-3", "SG-4"],
    );
  });

  test("subgroups larger than the table clamp to n = 15 but report their true size", () => {
    const big = [0, 1, 2].map((i) => ({
      subgroupId: `BIG-${i}`,
      timestamp: new Date(Date.UTC(2026, 0, 1, i)),
      // 20 readings: mean 10, range 2.
      values: Array.from({ length: 20 }, (_, j) => (j === 0 ? 9 : j === 1 ? 11 : 10)),
    }));
    const r = computeSpcChart(big);
    assert.ok(r, "expected a result");

    // The caller still sees 20 — only the constant lookup is clamped.
    assert.equal(r.subgroupSize, 20);
    closeTo(r.uclXbar, 10.446); // 10 + A2(15) * 2 = 10 + 0.223 * 2
    closeTo(r.lclXbar, 9.554);
    closeTo(r.uclR, 3.306); // D4(15) * 2 = 1.653 * 2
    closeTo(r.lclR, 0.694); // D3(15) * 2 = 0.347 * 2
    closeTo(r.estimatedSigma, 0.576); // 2 / d2(15) = 2 / 3.472
  });

  test("ragged subgroups are charted against the FIRST subgroup's size", () => {
    // Known limitation, pinned deliberately: rawN comes from validSubgroups[0],
    // so a study with uneven subgroup sizes is charted with one set of constants.
    // Callers that allow ragged data should reject it upstream.
    const r = computeSpcChart([
      { subgroupId: "S1", timestamp: new Date(0), values: [9, 9.5, 10, 10.5, 11] },
      { subgroupId: "S2", timestamp: new Date(1), values: [9, 10, 11] },
    ]);
    assert.ok(r, "expected a result");
    assert.equal(r.subgroupCount, 2);
    assert.equal(r.subgroupSize, 5);
    closeTo(r.uclXbar, 11.154); // n = 5 constants, not n = 3
  });

  test("subgroups with fewer than two readings are dropped", () => {
    const r = computeSpcChart([
      sg(0, 10),
      { subgroupId: "SINGLE", timestamp: new Date(1), values: [500] },
      { subgroupId: "EMPTY", timestamp: new Date(2), values: [] },
      sg(3, 10),
    ]);
    assert.ok(r, "expected a result");
    assert.equal(r.subgroupCount, 2);
    assert.deepEqual(r.points.map((p) => p.subgroupId), ["SG-0", "SG-3"]);
    // The 500 must not have moved the centre line.
    closeTo(r.grandMeanXbarBar, 10);
  });

  test("non-finite readings are stripped before the subgroup is measured", () => {
    const r = computeSpcChart([
      { subgroupId: "S1", timestamp: new Date(0), values: [9, Number.NaN, 11] },
      { subgroupId: "S2", timestamp: new Date(1), values: [9, Infinity, 11] },
    ]);
    assert.ok(r, "expected a result");
    assert.equal(r.subgroupSize, 2);
    closeTo(r.grandMeanXbarBar, 10);
    closeTo(r.averageRangeRbar, 2);
    closeTo(r.uclXbar, 13.76); // A2(2) = 1.88 -> 10 + 3.76
  });
});

describe("computeSpcChart — Western Electric rules", () => {
  /** All violation strings across the chart, in point order. */
  function flags(subgroups: SpcSubgroup[]): string[] {
    const r = computeSpcChart(subgroups);
    assert.ok(r, "expected a result");
    return r.points.flatMap((p) => p.violations);
  }

  test("Rule 1 fires on the point beyond the X-bar limits, and only that point", () => {
    // Means alternate 9.5/10.5 so nothing else can trip, then one point at 14.
    // X-bar-bar = 83.5/8 = 10.4375, UCL = 11.5915 -> only the 14 is outside.
    const chart = run([9.5, 10.5, 9.5, 10.5, 9.5, 10.5, 9.5, 14]);
    const r = computeSpcChart(chart);
    assert.ok(r, "expected a result");
    closeTo(r.grandMeanXbarBar, 10.4375);
    closeTo(r.uclXbar, 11.5915);

    const outliers = r.points.filter((p) => p.isOutOfControlXbar);
    assert.deepEqual(outliers.map((p) => p.subgroupId), ["SG-7"]);
    assert.equal(r.points.filter((p) => p.violations.length > 0).length, 1);
    assert.match(outliers[0].violations[0], /^Rule 1: Point falls beyond/);
  });

  test("Rule 1 also guards the range chart independently of the mean", () => {
    // Every mean is 10, so the X-bar chart is flat; one subgroup has range 12.
    // R-bar = 20/5 = 4, UCL_R = 2.114 * 4 = 8.456.
    const chart = [sg(0, 10), sg(1, 10), sg(2, 10), sg(3, 10), sg(4, 10, 6)];
    const r = computeSpcChart(chart);
    assert.ok(r, "expected a result");
    closeTo(r.averageRangeRbar, 4);
    closeTo(r.uclR, 8.456);

    assert.ok(r.points.every((p) => !p.isOutOfControlXbar), "X-bar should be stable");
    assert.deepEqual(
      r.points.filter((p) => p.isOutOfControlR).map((p) => p.subgroupId),
      ["SG-4"],
    );
    assert.deepEqual(flags(chart), [
      "Rule 1 (Range): Subgroup range exceeds Range Control Limit",
    ]);
  });

  test("Rule 2 fires once eight consecutive points sit on one side of centre", () => {
    // 4 subgroups at 9.5 then 8 at 10.5. X-bar-bar = 122/12 = 10.1667 and the
    // limits are +/-1.154, so the 1.0 shift stays inside them: this is a shift
    // Rule 1 cannot see, which is the whole point of Rule 2.
    const chart = run([9.5, 9.5, 9.5, 9.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5]);
    const r = computeSpcChart(chart);
    assert.ok(r, "expected a result");
    closeTo(r.grandMeanXbarBar, 10.1667);
    assert.ok(
      r.points.every((p) => !p.isOutOfControlXbar && !p.isOutOfControlR),
      "the shift must stay inside the 3-sigma limits",
    );

    const tripped = r.points.filter((p) => p.violations.length > 0);
    assert.deepEqual(tripped.map((p) => p.subgroupId), ["SG-11"]);
    assert.match(tripped[0].violations[0], /^Rule 2: 8 consecutive points/);
  });

  test("Rule 2 does not fire on a run of seven", () => {
    // 5 low then 7 high — the longest same-side run is one short of the rule.
    assert.deepEqual(
      flags(run([9.5, 9.5, 9.5, 9.5, 9.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5])),
      [],
    );
  });

  test("Rule 3 fires on six steadily rising points, and on six falling ones", () => {
    const rising = run([9.0, 9.3, 9.6, 9.9, 10.2, 10.5]);
    const r = computeSpcChart(rising);
    assert.ok(r, "expected a result");
    // Grand mean 9.75, limits +/-1.154, so the whole trend sits in control.
    closeTo(r.grandMeanXbarBar, 9.75);
    assert.ok(r.points.every((p) => !p.isOutOfControlXbar));

    assert.deepEqual(flags(rising), [
      "Rule 3: 6 consecutive points steadily trending (Trend detected)",
    ]);
    assert.deepEqual(flags(run([10.5, 10.2, 9.9, 9.6, 9.3, 9.0])), [
      "Rule 3: 6 consecutive points steadily trending (Trend detected)",
    ]);
  });

  test('Rule 3 requires strict monotonicity — one repeated value breaks the "trend"', () => {
    assert.deepEqual(flags(run([9.0, 9.3, 9.3, 9.6, 9.9, 10.2])), []);
  });
});

describe("computeSpcChart — process capability", () => {
  /**
   * 5 subgroups, mean exactly 10, range exactly d2(5) = 2.326, so sigma-hat is
   * exactly 1.0 and every Cp/Cpk below is readable off the spec limits directly.
   */
  function unitSigmaChart(): SpcSubgroup[] {
    return [0, 1, 2, 3, 4].map((i) => sg(i, 10, 1.163));
  }

  test("the fixture really does have sigma-hat = 1", () => {
    const r = computeSpcChart(unitSigmaChart());
    assert.ok(r, "expected a result");
    closeTo(r.grandMeanXbarBar, 10);
    closeTo(r.averageRangeRbar, 2.326);
    closeTo(r.estimatedSigma, 1);
  });

  test("a centred process at +/-3 sigma is Cp 1.00 and the textbook 2700 ppm", () => {
    const r = computeSpcChart(unitSigmaChart(), { usl: 13, lsl: 7 });
    assert.ok(r, "expected a result");
    assert.ok(r.capability, "expected capability metrics");
    const cap = r.capability;
    assert.equal(cap.usl, 13);
    assert.equal(cap.lsl, 7);
    closeTo(cap.cp, 1, 0.005);
    closeTo(cap.cpu, 1, 0.005);
    closeTo(cap.cpl, 1, 0.005);
    closeTo(cap.cpk, 1, 0.005);
    // Two 3-sigma tails at 1350 ppm each. This is the real test of normalCdf.
    assert.ok(
      Math.abs(cap.ppmTotal - 2700) <= 1,
      `expected ~2700 ppm, got ${cap.ppmTotal}`,
    );
    // Cpk 1.00 is a running process but not a capable one.
    assert.equal(cap.isCapable, false);
  });

  test("Cpk 1.33 is the capability threshold", () => {
    const r = computeSpcChart(unitSigmaChart(), { usl: 14, lsl: 6 });
    assert.ok(r, "expected a result");
    assert.ok(r.capability, "expected capability metrics");
    const cap = r.capability;
    closeTo(cap.cp, 1.33, 0.005);
    closeTo(cap.cpk, 1.33, 0.005);
    assert.equal(cap.isCapable, true);
    // Two 4-sigma tails at ~31.7 ppm each.
    assert.ok(
      Math.abs(cap.ppmTotal - 63) <= 1,
      `expected ~63 ppm, got ${cap.ppmTotal}`,
    );
  });

  test("an off-centre process is penalised by Cpk while Cp stays flattering", () => {
    // USL 14 / LSL 8 around a mean of 10: 4 sigma of headroom above, 2 below.
    const r = computeSpcChart(unitSigmaChart(), { usl: 14, lsl: 8 });
    assert.ok(r, "expected a result");
    assert.ok(r.capability, "expected capability metrics");
    const cap = r.capability;
    closeTo(cap.cp, 1, 0.005); // width alone looks fine
    closeTo(cap.cpu, 1.33, 0.005);
    closeTo(cap.cpl, 0.67, 0.005);
    closeTo(cap.cpk, 0.67, 0.005); // centring is what fails
    assert.equal(cap.isCapable, false);
    // Dominated by the 2-sigma lower tail: ~22750 + ~32 ppm.
    assert.ok(
      Math.abs(cap.ppmTotal - 22782) <= 2,
      `expected ~22782 ppm, got ${cap.ppmTotal}`,
    );
  });

  test("capability is omitted rather than guessed when it cannot be computed", () => {
    const chart = unitSigmaChart();

    // No specification limits supplied.
    assert.equal(computeSpcChart(chart)?.capability, undefined);

    // Inverted or degenerate specification window.
    assert.equal(computeSpcChart(chart, { usl: 7, lsl: 13 })?.capability, undefined);
    assert.equal(computeSpcChart(chart, { usl: 10, lsl: 10 })?.capability, undefined);

    // Non-numeric limits, which is what an empty form field turns into.
    const blank = { usl: Number.NaN, lsl: 7 };
    assert.equal(computeSpcChart(chart, blank)?.capability, undefined);
  });

  test("a zero-variation process yields no sigma, so no capability", () => {
    // Every reading identical: R-bar = 0, so sigma-hat = 0 and Cp would divide
    // by zero. The chart still returns, with all three limits collapsed onto 10.
    const flat = [0, 1, 2].map((i) => ({
      subgroupId: `FLAT-${i}`,
      timestamp: new Date(Date.UTC(2026, 0, 1, i)),
      values: [10, 10, 10, 10, 10],
    }));
    const r = computeSpcChart(flat, { usl: 13, lsl: 7 });
    assert.ok(r, "expected a result");
    assert.equal(r.estimatedSigma, 0);
    assert.equal(r.capability, undefined);
    assert.equal(r.uclXbar, 10);
    assert.equal(r.lclXbar, 10);
    assert.ok(r.points.every((p) => !p.isOutOfControlXbar && !p.isOutOfControlR));
  });
});

describe("computeSpcChart — guards", () => {
  test("returns null rather than throwing on unusable input", () => {
    assert.equal(computeSpcChart([]), null);
    assert.equal(computeSpcChart(null as unknown as SpcSubgroup[]), null);
    assert.equal(computeSpcChart(undefined as unknown as SpcSubgroup[]), null);

    // Present but unusable: nothing survives the >= 2 readings filter.
    assert.equal(
      computeSpcChart([
        { subgroupId: "A", timestamp: new Date(0), values: [1] },
        { subgroupId: "B", timestamp: new Date(1), values: [] },
        {
          subgroupId: "C",
          timestamp: new Date(2),
          values: undefined as unknown as number[],
        },
        { subgroupId: "D", timestamp: new Date(3), values: [Number.NaN, Infinity] },
      ]),
      null,
    );
  });
});

