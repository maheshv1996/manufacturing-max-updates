import { test } from "node:test";
import assert from "node:assert/strict";
import { ok, err, isOk, mapErr, type Result } from "../src/lib/core/result";

test("ok wraps a value and isOk is true", () => {
  const r = ok(42);
  assert.equal(isOk(r), true);
  if (r.tag === "ok") assert.equal(r.value, 42);
});

test("err carries an error string and isOk is false", () => {
  const r: Result<number, string> = err("boom");
  assert.equal(isOk(r), false);
  if (r.tag === "err") assert.equal(r.error, "boom");
});

test("mapErr rewrites only the error branch", () => {
  const e: Result<number, string> = err("boom");
  const mapped = mapErr(e, (m) => `wrapped: ${m}`);
  assert.equal(mapped.tag, "err");
  if (mapped.tag === "err") assert.equal(mapped.error, "wrapped: boom");

  const o: Result<number, string> = ok(7);
  const mappedOk = mapErr(o, (m) => `wrapped: ${m}`);
  assert.equal(mappedOk.tag, "ok");
  if (mappedOk.tag === "ok") assert.equal(mappedOk.value, 7);
});

test("Result is a discriminated union on tag", () => {
  const a: Result<number, string> = ok(1);
  const b: Result<number, string> = err("x");
  if (a.tag === "ok") assert.equal(a.value, 1);
  if (b.tag === "err") assert.equal(b.error, "x");
});
