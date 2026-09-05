import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calibrationStatus,
  effectiveInstrumentLocation,
  canMeasure,
  canIssue,
  nextCalibrationDue,
  daysUntilExpiry,
  type InstrumentInput,
} from "../src/lib/maintenance/calibration";

const DAY = 24 * 60 * 60 * 1000;

const instrument = (overrides: Partial<InstrumentInput> = {}): InstrumentInput => ({
  id: "i1",
  serialNumber: "MIC-001",
  calibratedAt: new Date("2026-01-01T00:00:00Z"),
  expiresAt: new Date("2026-12-31T00:00:00Z"),
  location: "LAB_CABINET",
  lifecycle: "ACTIVE",
  ...overrides,
});

const now = new Date("2026-09-05T00:00:00Z");

test("status: OK when far from expiry, EXPIRING_SOON within 30 days, EXPIRED past", () => {
  assert.equal(calibrationStatus(instrument({ expiresAt: new Date(now.getTime() + 60 * DAY) }), now), "OK");
  assert.equal(calibrationStatus(instrument({ expiresAt: new Date(now.getTime() + 10 * DAY) }), now), "EXPIRING_SOON");
  assert.equal(calibrationStatus(instrument({ expiresAt: new Date(now.getTime() - 1 * DAY) }), now), "EXPIRED");
});

test("status: missing expiry means EXPIRED (fail-closed)", () => {
  assert.equal(calibrationStatus(instrument({ expiresAt: null }), now), "EXPIRED");
});

test("daysUntilExpiry rounds to whole days", () => {
  assert.equal(daysUntilExpiry(instrument({ expiresAt: new Date(now.getTime() + 2.5 * DAY) }), now), 3);
  assert.equal(daysUntilExpiry(instrument({ expiresAt: new Date(now.getTime() - 0.2 * DAY) }), now), 0);
});

test("effective location: expired ACTIVE instrument is QUARANTINE (the cage)", () => {
  const loc = effectiveInstrumentLocation(instrument({ expiresAt: new Date(now.getTime() - 5 * DAY), location: "SHOPFLOOR" }), now);
  assert.equal(loc, "QUARANTINE");
});

test("effective location: RETIRED wins over everything", () => {
  const loc = effectiveInstrumentLocation(instrument({ lifecycle: "RETIRED", location: "SHOPFLOOR" }), now);
  assert.equal(loc, "RETIRED");
});

test("canMeasure: fresh instrument measures, expired or retired never (G-4)", () => {
  assert.equal(canMeasure(instrument(), now).ok, true);
  assert.equal(canMeasure(instrument({ expiresAt: new Date(now.getTime() - 1 * DAY) }), now).ok, false);
  assert.equal(canMeasure(instrument({ lifecycle: "RETIRED" }), now).ok, false);
  assert.equal(canMeasure(instrument({ lifecycle: "PROCUREMENT" }), now).ok, false);
});

test("canMeasure: quarantined location refuses even if dates look fine", () => {
  const r = canMeasure(instrument({ location: "QUARANTINE" }), now);
  assert.equal(r.ok, false);
});

test("canIssue: requires ACTIVE lifecycle, non-expired, and a future expected return", () => {
  assert.equal(canIssue(instrument(), now, new Date(now.getTime() + 3 * DAY)).ok, true);
  assert.equal(canIssue(instrument(), now, new Date(now.getTime() - 1)).ok, false); // past return
  assert.equal(canIssue(instrument(), now, now).ok, false); // same instant
  assert.equal(canIssue(instrument({ expiresAt: new Date(now.getTime() - DAY) }), now, new Date(now.getTime() + DAY)).ok, false);
  assert.equal(canIssue(instrument({ lifecycle: "RETIRED" }), now, new Date(now.getTime() + DAY)).ok, false);
});

test("canIssue: an instrument already out (WITH_OPERATOR) cannot be issued again", () => {
  const r = canIssue(instrument({ location: "WITH_OPERATOR" }), now, new Date(now.getTime() + DAY));
  assert.equal(r.ok, false);
  assert.equal(r.reason, "ALREADY_ISSUED");
});

test("nextCalibrationDue: O(1) advancement past several missed intervals", () => {
  const calibratedAt = new Date("2025-01-01T00:00:00Z");
  const due = nextCalibrationDue(calibratedAt, 180, now);
  assert.ok(due);
  // 3 full intervals elapsed by now → the 4th is the first strictly-future due
  const expected = new Date(calibratedAt.getTime() + 4 * 180 * DAY);
  assert.equal(due.toISOString(), expected.toISOString());
});

test("nextCalibrationDue: null when no interval configured", () => {
  assert.equal(nextCalibrationDue(new Date(), null, now), null);
});
