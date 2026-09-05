import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AppError,
  notFound,
  forbidden,
  conflict,
  internal,
  validation,
  toApiError,
} from "../src/lib/core/errors";

test("helpers produce AppError with the right code and message", () => {
  assert.equal(notFound("x").code, "NOT_FOUND");
  assert.equal(forbidden("nope").code, "FORBIDDEN");
  assert.equal(conflict("dup").code, "CONFLICT");
  assert.equal(internal("bad").code, "INTERNAL");
  const v = validation("field required");
  assert.equal(v.code, "VALIDATION");
  assert.equal(v.message, "field required");
  assert.ok(notFound("x") instanceof AppError);
});

test("toApiError keeps only code+message and hides internal details", () => {
  const cause = new Error("secret: db password in the message");
  const wrapped = internal("Internal Server Error", { cause });
  const api = toApiError(wrapped);
  assert.equal(api.error, "INTERNAL");
  assert.equal(api.message, "Internal Server Error");
  assert.ok(!JSON.stringify(api).includes("secret"));
});

test("toApiError never leaks the message of an arbitrary thrown value", () => {
  const api = toApiError(new Error("leaky implementation detail"));
  assert.equal(api.error, "INTERNAL");
  assert.ok(!api.message.includes("leaky"));
});

test("toApiError maps NOT_FOUND through unchanged", () => {
  const api = toApiError(notFound("record gone"));
  assert.equal(api.error, "NOT_FOUND");
  assert.equal(api.message, "record gone");
});
