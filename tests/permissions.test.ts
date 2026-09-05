import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WORKSPACES,
  SPECIAL_PERMISSIONS,
  ALL_PERMISSIONS,
  isPermissionKey,
} from "../src/lib/org/permissions";

test("every workspace has view, edit and approve keys", () => {
  for (const ws of WORKSPACES) {
    assert.ok(ALL_PERMISSIONS.includes(`${ws}.view` as never), `${ws}.view missing`);
    assert.ok(ALL_PERMISSIONS.includes(`${ws}.edit` as never), `${ws}.edit missing`);
    assert.ok(ALL_PERMISSIONS.includes(`${ws}.approve` as never), `${ws}.approve missing`);
  }
});

test("all special keys are present", () => {
  for (const k of SPECIAL_PERMISSIONS) {
    assert.ok(ALL_PERMISSIONS.includes(k as never), `${k} missing`);
  }
});

test("no duplicate permission keys", () => {
  assert.equal(new Set(ALL_PERMISSIONS).size, ALL_PERMISSIONS.length);
});

test("isPermissionKey narrows valid keys and rejects invalid ones", () => {
  assert.equal(isPermissionKey("ops.view"), true);
  assert.equal(isPermissionKey("quality.approve"), true);
  assert.equal(isPermissionKey("users.manage"), true);
  assert.equal(isPermissionKey("nope.nope"), false);
  assert.equal(isPermissionKey("ops.view.hack"), false);
  assert.equal(isPermissionKey(""), false);
});
