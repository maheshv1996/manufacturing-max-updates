import { test } from "node:test";
import assert from "node:assert/strict";
import { checkReadiness, type ReadinessSnapshot } from "../src/lib/shopfloor/readiness";

const clear: ReadinessSnapshot = {
  materials: [{ sku: "AL-6061", name: "Aluminium billet", requiredQty: 10, availableQty: 50 }],
  certsRequired: false,
  certsPresent: true,
  drawingRevCurrent: true,
  fixtureAvailable: true,
  assignedInstrumentsCalibrated: true,
  faiRequired: false,
  faiSatisfied: false,
};

test("all-clear snapshot is ready with no gaps", () => {
  const r = checkReadiness(clear);
  assert.equal(r.ready, true);
  assert.deepEqual(r.gaps, []);
});

test("material shortage fires MATERIAL_SHORT and not-ready", () => {
  const r = checkReadiness({
    ...clear,
    materials: [
      { sku: "AL-6061", name: "Aluminium billet", requiredQty: 10, availableQty: 50 },
      { sku: "TI-64", name: "Titanium bar", requiredQty: 4, availableQty: 2 },
    ],
  });
  assert.equal(r.ready, false);
  assert.ok(r.gaps.some((g) => g.code === "MATERIAL_SHORT"));
});

test("missing required certs fires CERT_MISSING", () => {
  const r = checkReadiness({ ...clear, certsRequired: true, certsPresent: false });
  assert.equal(r.ready, false);
  assert.ok(r.gaps.some((g) => g.code === "CERT_MISSING"));
});

test("outdated drawing revision fires DRAWING_REV", () => {
  const r = checkReadiness({ ...clear, drawingRevCurrent: false });
  assert.equal(r.ready, false);
  assert.ok(r.gaps.some((g) => g.code === "DRAWING_REV"));
});

test("unavailable fixture fires FIXTURE_UNAVAILABLE", () => {
  const r = checkReadiness({ ...clear, fixtureAvailable: false });
  assert.equal(r.ready, false);
  assert.ok(r.gaps.some((g) => g.code === "FIXTURE_UNAVAILABLE"));
});

test("expired instrument calibration fires CALIBRATION_EXPIRED", () => {
  const r = checkReadiness({ ...clear, assignedInstrumentsCalibrated: false });
  assert.equal(r.ready, false);
  assert.ok(r.gaps.some((g) => g.code === "CALIBRATION_EXPIRED"));
});

test("pending FAI on an FAI-required part fires FAI_PENDING", () => {
  const r = checkReadiness({ ...clear, faiRequired: true, faiSatisfied: false });
  assert.equal(r.ready, false);
  assert.ok(r.gaps.some((g) => g.code === "FAI_PENDING"));
});

test("FAI_PENDING never fires when the part does not require FAI", () => {
  const r = checkReadiness({ ...clear, faiRequired: false, faiSatisfied: false });
  assert.equal(r.gaps.some((g) => g.code === "FAI_PENDING"), false);
});

test("multiple gaps are reported together", () => {
  const r = checkReadiness({
    ...clear,
    materials: [{ sku: "TI-64", name: "Titanium bar", requiredQty: 4, availableQty: 1 }],
    certsRequired: true,
    certsPresent: false,
    drawingRevCurrent: false,
    fixtureAvailable: false,
    assignedInstrumentsCalibrated: false,
    faiRequired: true,
    faiSatisfied: false,
  });
  assert.equal(r.ready, false);
  const codes = r.gaps.map((g) => g.code).sort();
  assert.deepEqual(
    codes,
    ["CALIBRATION_EXPIRED", "CERT_MISSING", "DRAWING_REV", "FAI_PENDING", "FIXTURE_UNAVAILABLE", "MATERIAL_SHORT"].sort(),
  );
});
