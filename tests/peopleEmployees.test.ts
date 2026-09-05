import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEmployee } from "../src/lib/people/employees";
import { isOk, isErr } from "../src/lib/core/result";

test("validateEmployee accepts valid input", () => {
  const r = validateEmployee({
    employeeNumber: "EMP-001",
    name: "Alice",
    designation: "Operator",
    department: "Production",
    panNumber: "ABCDE1234F",
    aadhaarNumber: "123456789012",
    pfUan: "123456789012",
    esiNumber: "12345678901234567",
  });
  assert.equal(isOk(r), true);
});

test("validateEmployee rejects missing required fields", () => {
  const r = validateEmployee({ employeeNumber: "", name: "Alice" });
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.match(r.error[0].field, /employeeNumber/);
});

test("validateEmployee rejects invalid PAN format", () => {
  const r = validateEmployee({
    employeeNumber: "EMP-001",
    name: "Alice",
    panNumber: "SHORT",
  });
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.match(r.error[0].field, /panNumber/);
});

test("validateEmployee rejects invalid Aadhaar format", () => {
  const r = validateEmployee({
    employeeNumber: "EMP-001",
    name: "Alice",
    aadhaarNumber: "12345",
  });
  assert.equal(isErr(r), true);
  if (isErr(r)) assert.match(r.error[0].field, /aadhaarNumber/);
});
