import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAuditEvent } from "../src/lib/core/audit";
import { makeIdempotencyKey, normalizeClientId } from "../src/lib/core/idempotency";
import { validateSequenceName } from "../src/lib/core/sequence";
import { parseSettings } from "../src/lib/core/settings";

test("audit: buildAuditEvent returns a complete event", () => {
  const e = buildAuditEvent({
    actor: "u1",
    action: "LOG_GOOD",
    entityType: "ProductionLog",
    entityId: "p1",
    details: "qty 3",
  });
  assert.equal(e.actor, "u1");
  assert.equal(e.action, "LOG_GOOD");
  assert.equal(e.entityId, "p1");
  assert.equal(e.details, "qty 3");
  assert.ok(e.at instanceof Date);
});

test("audit: missing required fields throw a VALIDATION AppError", () => {
  try {
    buildAuditEvent({ actor: "", action: "LOG_GOOD", entityType: "X" });
    assert.fail("should have thrown");
  } catch (e) {
    assert.equal((e as { code: string }).code, "VALIDATION");
  }
});

test("idempotency: same client+scope yields a stable 64-hex key", () => {
  const a = makeIdempotencyKey("tablet-7", "LOG_GOOD");
  const b = makeIdempotencyKey("tablet-7", "LOG_GOOD");
  assert.equal(a, b);
  assert.equal(a.length, 64);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(makeIdempotencyKey("tablet-7", "LOG_SCRAP"), a);
});

test("idempotency: normalizeClientId trims and rejects empty", () => {
  assert.equal(normalizeClientId("  t1  "), "t1");
  try {
    normalizeClientId("   ");
    assert.fail("should have thrown");
  } catch (e) {
    assert.equal((e as { code: string }).code, "VALIDATION");
  }
});

test("sequence: names must be UPPER alphanumeric with separators", () => {
  assert.equal(validateSequenceName("WO"), true);
  assert.equal(validateSequenceName("GRN-2026"), true);
  assert.equal(validateSequenceName("wo"), false);
  assert.equal(validateSequenceName("has space"), false);
  assert.equal(validateSequenceName(""), false);
});

test("settings: typed parse with defaults, tolerant of junk", () => {
  const s = parseSettings(
    new Map<string, string>([
      ["requireMillCerts", "true"],
      ["count_tolerance", "5"],
      ["activeDepartments", '["ops","quality"]'],
      ["onboardingComplete", "true"],
      ["branding", '{"appName":"Apex Mfg"}'],
    ]),
  );
  assert.equal(s.requireMillCerts, true);
  assert.equal(s.countTolerance, 5);
  assert.deepEqual(s.activeDepartments, ["ops", "quality"]);
  assert.equal(s.onboardingComplete, true);
  assert.equal(s.branding?.appName, "Apex Mfg");

  const empty = parseSettings(new Map());
  assert.equal(empty.requireMillCerts, false);
  assert.equal(empty.countTolerance, 0);
  assert.equal(empty.activeDepartments, null);
  assert.equal(empty.branding, null);

  // Junk values fall back to defaults instead of throwing.
  const junk = parseSettings(new Map([["count_tolerance", "abc"], ["requireMillCerts", "yes"], ["activeDepartments", "not-json"]]));
  assert.equal(junk.countTolerance, 0);
  assert.equal(junk.requireMillCerts, false);
  assert.equal(junk.activeDepartments, null);
});
