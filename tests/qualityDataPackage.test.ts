import { test } from "node:test";
import assert from "node:assert/strict";
import { releasePackage, mutatePackage } from "../src/lib/quality/dataPackage";

test("release passes when all completeness gates are satisfied", () => {
  const r = releasePackage({ faiRequired: true, faiApproved: true, certsPresent: true, itemCount: 3 });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.status, "RELEASED");
});

test("release without required FAI is blocked (FAI_MISSING)", () => {
  const r = releasePackage({ faiRequired: true, faiApproved: false, certsPresent: true, itemCount: 3 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "FAI_MISSING");
});

test("release without certs is blocked (CERT_MISSING)", () => {
  const r = releasePackage({ faiRequired: false, faiApproved: false, certsPresent: false, itemCount: 3 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "CERT_MISSING");
});

test("release of an empty package is blocked (EMPTY_PACKAGE)", () => {
  const r = releasePackage({ faiRequired: false, faiApproved: false, certsPresent: true, itemCount: 0 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "EMPTY_PACKAGE");
});

test("FAI gate takes priority when multiple gates fail", () => {
  const r = releasePackage({ faiRequired: true, faiApproved: false, certsPresent: false, itemCount: 0 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "FAI_MISSING");
});

test("G-6: a RELEASED package rejects mutation without a new revision (FROZEN)", () => {
  const r = mutatePackage("RELEASED", { newRevision: false });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "FROZEN");
});

test("G-6: a RELEASED package may be revised with an explicit newRevision", () => {
  const r = mutatePackage("RELEASED", { newRevision: true });
  assert.equal(r.ok, true);
});

test("DRAFT packages mutate freely", () => {
  const r = mutatePackage("DRAFT");
  assert.equal(r.ok, true);
});