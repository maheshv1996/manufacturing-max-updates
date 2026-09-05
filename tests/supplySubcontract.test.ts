import { test } from "node:test";
import assert from "node:assert/strict";
import { dispatchChallan, receiveBack, signOff } from "../src/lib/supply/subcontract";

test("dispatch with accredited vendor passes (W4)", () => {
  const r = dispatchChallan({ accredited: true, contractRequiresAccreditation: true });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.status, "DISPATCHED");
});

test("dispatch blocked when contract requires accreditation but vendor lacks it", () => {
  const r = dispatchChallan({ accredited: false, contractRequiresAccreditation: true });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "VENDOR_NOT_ACCREDITED");
});

test("dispatch passes without accreditation when contract does not require it", () => {
  const r = dispatchChallan({ accredited: false, contractRequiresAccreditation: false });
  assert.equal(r.ok, true);
});

test("receiveBack missing certs is blocked (CERT_MISSING)", () => {
  const r = receiveBack({ status: "DISPATCHED", certsPresent: 0, specialProcessCertsRequired: 2 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "CERT_MISSING");
});

test("receiveBack with certs -> RECEIVED_BACK", () => {
  const r = receiveBack({ status: "DISPATCHED", certsPresent: 2, specialProcessCertsRequired: 2 });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.status, "RECEIVED_BACK");
});

test("signOff PASS returns material to stock (QC_PASSED)", () => {
  const r = signOff({ status: "RECEIVED_BACK", result: "PASS" });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.status, "QC_PASSED");
  assert.equal(r.routesToNcr, false);
});

test("signOff FAIL routes an NCR", () => {
  const r = signOff({ status: "RECEIVED_BACK", result: "FAIL" });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.status, "QC_FAILED");
  assert.equal(r.routesToNcr, true);
});

test("signOff before material returns is illegal", () => {
  const r = signOff({ status: "DISPATCHED", result: "PASS" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "ILLEGAL_TRANSITION");
});

test("receiveBack twice is illegal", () => {
  const r = receiveBack({ status: "RECEIVED_BACK", certsPresent: 1, specialProcessCertsRequired: 1 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "ILLEGAL_TRANSITION");
});