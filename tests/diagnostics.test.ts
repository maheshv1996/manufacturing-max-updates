/**
 * Diagnostics capture tests.
 *
 *     node --test tests/diagnostics.test.ts
 *
 * These are security tests as much as unit tests. The diagnostics bundle is a
 * file an administrator emails to support, so anything the buffer stores can
 * leave a customer's network. The load-bearing assertions are the ones that
 * serialize the whole buffer and grep it for secret literals — a redaction rule
 * that is merely *called* proves nothing; a bundle with no secret in it does.
 */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  recordDiagnostic,
  getDiagnostics,
  clearDiagnostics,
  summarizeDiagnostics,
  redactValue,
  redactConnectionString,
  maskEmails,
  looksSecret,
  LIMITS,
  REDACTED,
} from "../src/lib/diagnostics";

/** Every credential literal used anywhere in this file. */
const SECRETS = [
  "s3cr3t-db-password",
  "ultra-secret-session-key",
  "lic-secret-abcdef",
  "gsk_abcdefghijklmnopqrstuvwx",
  "sk-abcdefghijklmnopqrstuvwx",
  "AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ123",
  "rzp_live_ABCDEFGH1234",
  "re_abcdefghijklmnopqrst",
  "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ12",
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig",
];

/** Fails if any secret literal survives into `value` once serialized. */
function assertNoSecrets(value: unknown, what: string): void {
  const json = JSON.stringify(value) ?? "";
  for (const s of SECRETS) {
    assert.ok(!json.includes(s), `${what} leaked the secret ${JSON.stringify(s)}`);
  }
}

beforeEach(() => clearDiagnostics());

describe("redaction — by key name", () => {
  test("strips any key that reads like a credential, at any nesting depth", () => {
    const out = redactValue({
      userId: "u_42",
      password: "s3cr3t-db-password",
      request: {
        headers: { authorization: "opaque", cookie: "sid=1" },
        body: { apiKey: "sk-abcdefghijklmnopqrstuvwx", partNumber: "AX-100" },
      },
      dbPassword: "s3cr3t-db-password",
      refresh_token: "abc",
      "X-Api-Key": "abc",
      privateKey: "abc",
    }) as Record<string, any>;

    // Non-sensitive fields must survive, or the bundle is useless for support.
    assert.equal(out.userId, "u_42");
    assert.equal(out.request.body.partNumber, "AX-100");

    assert.equal(out.password, REDACTED);
    assert.equal(out.dbPassword, REDACTED);
    assert.equal(out.refresh_token, REDACTED);
    assert.equal(out["X-Api-Key"], REDACTED);
    assert.equal(out.privateKey, REDACTED);
    assert.equal(out.request.headers.authorization, REDACTED);
    assert.equal(out.request.headers.cookie, REDACTED);
    assert.equal(out.request.body.apiKey, REDACTED);
    assertNoSecrets(out, "key-name redaction");
  });

  test("does not redact ordinary field names that merely look similar", () => {
    const out = redactValue({
      component: "SpcChart",
      action: "recompute",
      hashCode: 12345,
      status: "OPEN",
      level: "error",
    }) as Record<string, any>;
    assert.deepEqual(out, {
      component: "SpcChart",
      action: "recompute",
      hashCode: 12345,
      status: "OPEN",
      level: "error",
    });
  });
});

describe("redaction — by value shape", () => {
  test("recognises vendor token formats even under an innocent key name", () => {
    // The key is `note` every time: only the value shape can save us here.
    for (const secret of [
      "sk-abcdefghijklmnopqrstuvwx",
      "gsk_abcdefghijklmnopqrstuvwx",
      "AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ123",
      "rzp_live_ABCDEFGH1234",
      "re_abcdefghijklmnopqrst",
      "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ12",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig",
      "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig",
      "Basic bWFoZXM6aHVudGVyMg==",
      "-----BEGIN RSA PRIVATE KEY-----\nMIIE\n",
    ]) {
      assert.ok(looksSecret(secret), `not recognised: ${secret.slice(0, 24)}`);
      const wrapped = redactValue({ note: secret }) as Record<string, unknown>;
      assert.equal(wrapped.note, REDACTED, `leaked via note: ${secret.slice(0, 24)}`);
      assertNoSecrets(wrapped, "value-shape redaction");
    }
  });

  test("plain prose is left alone", () => {
    assert.equal(looksSecret("Machine CNC-04 stopped: spindle overload"), false);
    assert.deepEqual(redactValue({ note: "Machine CNC-04 stopped" }), {
      note: "Machine CNC-04 stopped",
    });
  });

  test("connection strings keep the host and database, lose the credentials", () => {
    assert.equal(
      redactConnectionString("postgresql://mfg:s3cr3t-db-password@127.0.0.1:5433/mfgmax"),
      `postgresql://${REDACTED}@127.0.0.1:5433/mfgmax`,
    );
    // Nothing to strip: leave usable diagnostics untouched.
    assert.equal(
      redactConnectionString("http://127.0.0.1:11434/api/generate"),
      "http://127.0.0.1:11434/api/generate",
    );
    assert.equal(redactConnectionString("not a url at all"), "not a url at all");
  });

  test("email addresses are masked down to the domain", () => {
    assert.equal(maskEmails("contact jane.doe@acme.co.in today"), "contact j***@acme.co.in today");
    assert.equal(maskEmails("no address here"), "no address here");
  });
});

describe("redaction — hostile and unbounded input", () => {
  test("a circular object terminates at the depth limit instead of hanging", () => {
    const node: Record<string, unknown> = { name: "root" };
    node.self = node;
    const out = JSON.stringify(redactValue(node));
    assert.ok(out.includes("[depth limit]"), out);
  });

  test("objects, arrays and strings are all capped", () => {
    const wide: Record<string, number> = {};
    for (let i = 0; i < LIMITS.maxMetaKeys + 25; i++) wide[`k${i}`] = i;
    const outWide = redactValue(wide) as Record<string, unknown>;
    assert.equal(Object.keys(outWide).length, LIMITS.maxMetaKeys + 1);
    assert.equal(outWide.__truncated, "[key limit]");

    const long = Array.from({ length: LIMITS.maxMetaKeys + 10 }, (_, i) => i);
    const outLong = redactValue(long) as unknown[];
    assert.equal(outLong.length, LIMITS.maxMetaKeys + 1);
    assert.equal(outLong[LIMITS.maxMetaKeys], "[+10 more]");

    const huge = "x".repeat(LIMITS.maxStringChars + 100);
    const outHuge = redactValue({ note: huge }) as Record<string, string>;
    assert.ok(outHuge.note.endsWith("[+100 chars]"), outHuge.note.slice(-30));
  });

  test("exotic values are described rather than crashing the capture path", () => {
    const out = redactValue({
      fn: () => 1,
      sym: Symbol("x"),
      big: BigInt(10),
      when: new Date("2026-09-02T00:00:00.000Z"),
      broken: new Date("nonsense"),
      nothing: null,
      missing: undefined,
      err: new Error("spindle overload"),
    }) as Record<string, any>;

    assert.equal(out.fn, "[function]");
    assert.equal(out.sym, "[symbol]");
    assert.equal(out.big, "10n");
    assert.equal(out.when, "2026-09-02T00:00:00.000Z");
    assert.equal(out.broken, "[invalid date]");
    assert.equal(out.nothing, null);
    assert.equal(out.missing, undefined);
    assert.equal(out.err.name, "Error");
    assert.equal(out.err.message, "spindle overload");
    assert.ok(typeof out.err.stack === "string");
  });
});

describe("the ring buffer", () => {
  test("normalises a sparse report into a complete entry", () => {
    const e = recordDiagnostic({ message: "spindle overload" });
    assert.equal(e.level, "error"); // default
    assert.equal(e.source, "server"); // default
    assert.equal(e.component, "App"); // default
    assert.equal(e.message, "spindle overload");
    assert.equal(e.action, undefined);
    assert.equal(e.stack, undefined);
    assert.equal(e.meta, undefined);
    assert.ok(!Number.isNaN(Date.parse(e.at)));
  });

  test("accepts nothing at all without throwing", () => {
    const e = recordDiagnostic();
    assert.equal(e.message, "Unknown error");
    assert.equal(getDiagnostics().length, 1);
  });

  test("coerces an Error, and an unknown level or source, to the safe default", () => {
    const e = recordDiagnostic({
      level: "fatal" as never,
      source: "satellite" as never,
      component: "SpcChart",
      action: "recompute",
      message: new Error("bad subgroup"),
      meta: { subgroupId: "SG-7" },
    });
    assert.equal(e.level, "error");
    assert.equal(e.source, "server");
    assert.equal(e.message, "bad subgroup");
    assert.equal(e.action, "recompute");
    assert.deepEqual(e.meta, { subgroupId: "SG-7" });
  });

  test("evicts oldest-first at capacity and reports the gap", () => {
    const over = 12;
    for (let i = 0; i < LIMITS.maxEntries + over; i++) {
      recordDiagnostic({ message: `event ${i}`, component: "Loop" });
    }
    const entries = getDiagnostics();
    assert.equal(entries.length, LIMITS.maxEntries);
    // The first `over` events are gone; the newest is last.
    assert.equal(entries[0].message, `event ${over}`);
    assert.equal(entries[entries.length - 1].message, `event ${LIMITS.maxEntries + over - 1}`);

    const s = summarizeDiagnostics();
    assert.equal(s.total, LIMITS.maxEntries);
    assert.equal(s.dropped, over, "a truncated buffer must admit it lost entries");
    assert.equal(s.capacity, LIMITS.maxEntries);
  });

  test("the snapshot is a copy, so a caller cannot corrupt the buffer", () => {
    recordDiagnostic({ message: "one" });
    const snapshot = getDiagnostics();
    snapshot.push({ ...snapshot[0], message: "injected" });
    snapshot.length = 0;
    assert.equal(getDiagnostics().length, 1);
    assert.equal(getDiagnostics()[0].message, "one");
  });

  test("clearing resets both the entries and the dropped counter", () => {
    for (let i = 0; i < LIMITS.maxEntries + 5; i++) recordDiagnostic({ message: `e${i}` });
    assert.equal(summarizeDiagnostics().dropped, 5);
    clearDiagnostics();
    assert.deepEqual(getDiagnostics(), []);
    const s = summarizeDiagnostics();
    assert.equal(s.total, 0);
    assert.equal(s.dropped, 0);
    assert.equal(s.oldestAt, null);
    assert.equal(s.newestAt, null);
  });

  test("the summary aggregates by level, source and noisiest component", () => {
    recordDiagnostic({ component: "SpcChart", message: "a" });
    recordDiagnostic({ component: "SpcChart", message: "b", level: "warn" });
    recordDiagnostic({ component: "SpcChart", message: "c", source: "client" });
    recordDiagnostic({ component: "GrrPanel", message: "d", level: "info" });

    const s = summarizeDiagnostics();
    assert.equal(s.total, 4);
    assert.deepEqual(s.byLevel, { error: 2, warn: 1, info: 1 });
    assert.deepEqual(s.bySource, { server: 3, client: 1 });
    assert.deepEqual(s.topComponents, [
      { component: "SpcChart", count: 3 },
      { component: "GrrPanel", count: 1 },
    ]);
    assert.equal(s.oldestAt, getDiagnostics()[0].at);
    assert.equal(s.newestAt, getDiagnostics()[3].at);
  });

  test("secrets are stripped on the way IN, so no export can leak them", () => {
    // This is the assertion the whole module exists to satisfy.
    recordDiagnostic({
      component: "LicenseGate",
      action: "activate",
      message: `POST failed for postgresql://mfg:s3cr3t-db-password@127.0.0.1:5433/mfgmax`,
      stack: "Error: 401\n  at verify (token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig)",
      meta: {
        sessionSecret: "ultra-secret-session-key",
        licenseSecret: "lic-secret-abcdef",
        headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig" },
        groqApiKey: "gsk_abcdefghijklmnopqrstuvwx",
        operator: "jane.doe@acme.co.in",
        machineId: "CNC-04",
      },
    });

    const entries = getDiagnostics();
    assertNoSecrets(entries, "the diagnostics buffer");

    const e = entries[0];
    // Redaction must not be indiscriminate — the diagnosable parts survive.
    assert.ok(e.message.includes("127.0.0.1:5433/mfgmax"), e.message);
    assert.equal((e.meta as any).machineId, "CNC-04");
    assert.equal((e.meta as any).operator, "j***@acme.co.in");
    assert.equal((e.meta as any).sessionSecret, REDACTED);
    assert.equal((e.meta as any).groqApiKey, REDACTED);
    assert.equal((e.meta as any).headers.Authorization, REDACTED);
  });
});

// PLACEHOLDER_DIAG_TESTS
