import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { parseOr400 } from "../src/lib/core/parse";
import { isOk } from "../src/lib/core/result";

const emailSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
});

test("valid input passes through typed and unchanged", () => {
  const r = parseOr400(emailSchema, { email: "a@b.co", name: "Sam" });
  assert.equal(isOk(r), true);
  if (r.tag === "ok") {
    assert.equal(r.value.email, "a@b.co");
    assert.equal(r.value.name, "Sam");
  }
});

test("invalid input yields a VALIDATION AppError with per-field issues", () => {
  const r = parseOr400(emailSchema, { email: "not-an-email", name: "x" });
  assert.equal(r.tag, "err");
  if (r.tag === "err") {
    assert.equal(r.error.code, "VALIDATION");
    const fields = (r.error.details?.fields ?? []) as { path: string }[];
    const paths = fields.map((f) => f.path);
    assert.ok(paths.includes("email"));
    assert.ok(paths.includes("name"));
  }
});

test("unknown keys are stripped by default (zod object behavior)", () => {
  const r = parseOr400(emailSchema, { email: "a@b.co", name: "Sam", hacker: true });
  assert.equal(isOk(r), true);
  if (r.tag === "ok") {
    assert.ok(!("hacker" in r.value));
  }
});

test("non-object garbage is rejected as VALIDATION", () => {
  const r = parseOr400(emailSchema, "just-a-string");
  assert.equal(r.tag, "err");
  if (r.tag === "err") assert.equal(r.error.code, "VALIDATION");
});
