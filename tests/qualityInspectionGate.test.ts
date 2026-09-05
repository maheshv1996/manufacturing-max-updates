import { test } from "node:test";
import assert from "node:assert/strict";
import { assertInstrumentUsable } from "../src/lib/quality/inspectionGate";
import type { InstrumentInput } from "../src/lib/maintenance/calibration";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-05T06:00:00Z");

const instrument = (over: Partial<InstrumentInput> = {}): InstrumentInput => ({
  id: "inst-1",
  serialNumber: "MIC-001",
  calibratedAt: new Date(NOW.getTime() - 60 * DAY),
  expiresAt: new Date(NOW.getTime() + 120 * DAY),
  location: "SHOPFLOOR",
  lifecycle: "ACTIVE",
  ...over,
});

test("in-calibration ACTIVE instrument may measure (G-4 pass)", () => {
  assert.deepEqual(assertInstrumentUsable(instrument(), NOW), { ok: true });
});

test("EXPIRED instrument refused with clear reason — never measures (G-4)", () => {
  const r = assertInstrumentUsable(instrument({ expiresAt: new Date(NOW.getTime() - DAY) }), NOW);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "EXPIRED");
});

test("RETIRED instrument refused", () => {
  const r = assertInstrumentUsable(instrument({ lifecycle: "RETIRED" }), NOW);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "RETIRED");
});

test("PROCUREMENT instrument refused (NOT_ACTIVE)", () => {
  const r = assertInstrumentUsable(instrument({ lifecycle: "PROCUREMENT" }), NOW);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "NOT_ACTIVE");
});

test("quarantined instrument refused even with valid dates", () => {
  const r = assertInstrumentUsable(instrument({ location: "QUARANTINE" }), NOW);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "QUARANTINED");
});

test("a WITH_OPERATOR instrument is usable for measurement (that's the point of issue)", () => {
  assert.deepEqual(assertInstrumentUsable(instrument({ location: "WITH_OPERATOR" }), NOW), { ok: true });
});