import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ROLE_CATALOG,
  GRADE_LADDER,
  catalogByDepartment,
  departmentLabel,
} from "../src/lib/roleCatalog";
import { ALL_PERMISSIONS, WORKSPACE_PERMISSIONS } from "../src/lib/permissions";

const VALID_PERMS = new Set(ALL_PERMISSIONS);

test("catalog role codes are unique and cover many roles per department", () => {
  const codes = ROLE_CATALOG.map((r) => r.code);
  assert.equal(new Set(codes).size, codes.length, "codes must be unique");
  assert.ok(codes.length >= 35, `expected a full org catalog, got ${codes.length}`);
  // The user's point: a single department carries many distinct roles.
  const perDept = new Map<string, number>();
  for (const r of ROLE_CATALOG)
    perDept.set(r.department, (perDept.get(r.department) || 0) + 1);
  const quality = perDept.get("quality") || 0;
  assert.ok(quality >= 6, `quality should have many roles, got ${quality}`);
  const supply = perDept.get("supply") || 0;
  assert.ok(supply >= 5, `supply should have many roles, got ${supply}`);
});

test("every catalog permission key exists in the system permission space", () => {
  const bad: string[] = [];
  for (const r of ROLE_CATALOG) {
    for (const p of r.perms) {
      if (!VALID_PERMS.has(p)) bad.push(`${r.code}: ${p}`);
    }
  }
  assert.deepEqual(bad, [], "unknown permission keys referenced");
});

test("catalog covers every workspace domain with at least one role", () => {
  const domains = Object.keys(WORKSPACE_PERMISSIONS);
  const covered = new Set(ROLE_CATALOG.map((r) => r.department));
  const missing = domains.filter((d) => !covered.has(d));
  assert.deepEqual(missing, [], "every domain needs at least one catalog role");
});

test("grade ladders are valid subsets of the ladder, ordered", () => {
  for (const r of ROLE_CATALOG) {
    const g = r.grades || [];
    for (const gr of g) {
      assert.ok(
        GRADE_LADDER.includes(gr),
        `${r.code} has unknown grade ${gr}`,
      );
    }
    const idx = g.map((x) => GRADE_LADDER.indexOf(x));
    assert.deepEqual(
      idx,
      [...idx].sort((a, b) => a - b),
      `${r.code} grades must follow the ladder order`,
    );
  }
});

test("catalog groups by department and labels every group", () => {
  const groups = catalogByDepartment();
  const codes = ROLE_CATALOG.map((r) => r.code);
  const groupedCodes = groups.flatMap((g) => g.roles.map((r) => r.code));
  assert.equal(groupedCodes.length, codes.length, "no roles lost in grouping");
  for (const g of groups) {
    assert.ok(g.label.length > 0, `department ${g.department} needs a label`);
  }
  assert.ok(departmentLabel("quality").length > 0);
});

test("grade-gated roles exist (junior/senior pattern) alongside single-grade roles", () => {
  const graded = ROLE_CATALOG.filter((r) => r.grades && r.grades.length > 0);
  const flat = ROLE_CATALOG.filter((r) => !r.grades);
  assert.ok(graded.length > 20, "most working roles should carry a ladder");
  assert.ok(flat.length > 5, "managers/heads/operators are single-grade");
  const opsOperator = ROLE_CATALOG.find((r) => r.code === "OPS-OPERATOR");
  assert.deepEqual(opsOperator?.grades, ["TRAINEE", "JUNIOR", "SENIOR"]);
  const qcSupplier = ROLE_CATALOG.find((r) => r.code === "QC-QE-SUPPLIER");
  assert.deepEqual(qcSupplier?.grades, ["JUNIOR", "SENIOR"]);
});