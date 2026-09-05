import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectReportingCycle,
  resolveActiveReportingLines,
  buildOrgHierarchyTree,
  type ReportingLineRecord,
  type OrgUnitRecord,
  type OrgUserRecord,
} from "../src/lib/org/reportingLineEngine.ts";

describe("Org Reporting Line Engine — Hierarchy & Cycle Prevention", () => {
  it("detects direct self-reporting and 2-node cycles", () => {
    // Self-reporting: user-1 reports to user-1
    const selfCheck = detectReportingCycle([], "user-1", "user-1");
    assert.equal(selfCheck.hasCycle, true);
    assert.equal(selfCheck.reason, "User cannot report to themselves.");

    // Direct cycle: user-1 reports to user-2, trying to make user-2 report to user-1
    const lines: ReportingLineRecord[] = [
      { id: "line-1", reportUserId: "user-1", managerUserId: "user-2" },
    ];
    const directCheck = detectReportingCycle(lines, "user-2", "user-1");
    assert.equal(directCheck.hasCycle, true);
    assert.ok(directCheck.cyclePath?.includes("user-2 -> user-1 -> user-2"));
  });

  it("detects multi-hop indirect cycles across organization chains", () => {
    // Chain: user-4 -> user-3 -> user-2 -> user-1
    const lines: ReportingLineRecord[] = [
      { id: "line-1", reportUserId: "user-4", managerUserId: "user-3" },
      { id: "line-2", reportUserId: "user-3", managerUserId: "user-2" },
      { id: "line-3", reportUserId: "user-2", managerUserId: "user-1" },
    ];

    // Attempting to make user-1 report to user-4 completes a 4-hop cycle
    const cycleCheck = detectReportingCycle(lines, "user-1", "user-4");
    assert.equal(cycleCheck.hasCycle, true);
    assert.ok(cycleCheck.cyclePath?.includes("user-1 -> user-4 -> user-3 -> user-2 -> user-1"));

    // Valid addition: user-5 reports to user-2 (branching tree)
    const validCheck = detectReportingCycle(lines, "user-5", "user-2");
    assert.equal(validCheck.hasCycle, false);
  });

  it("resolves active reporting lines ignoring expired entries", () => {
    const now = new Date("2026-09-05T12:00:00Z");
    const lines: ReportingLineRecord[] = [
      {
        id: "active-1",
        reportUserId: "user-1",
        managerUserId: "user-2",
        validFrom: new Date("2026-01-01"),
        validTo: null,
      },
      {
        id: "active-2",
        reportUserId: "user-3",
        managerUserId: "user-2",
        validFrom: new Date("2026-06-01"),
        validTo: new Date("2026-12-31"),
      },
      {
        id: "expired",
        reportUserId: "user-4",
        managerUserId: "user-2",
        validFrom: new Date("2025-01-01"),
        validTo: new Date("2025-12-31"),
      },
    ];

    const active = resolveActiveReportingLines(lines, now);
    assert.equal(active.length, 2);
    assert.deepEqual(active.map((l) => l.id), ["active-1", "active-2"]);
  });

  it("builds a clean nested org hierarchy tree with units, head seats, and members", () => {
    const units: OrgUnitRecord[] = [
      { id: "unit-root", code: "ROOT", name: "Plant Root", parentId: null, headUserId: "user-gm" },
      { id: "unit-ops", code: "OPS", name: "Operations", parentId: "unit-root", headUserId: "user-ops-head" },
      { id: "unit-cell-1", code: "CELL-1", name: "CNC Cell 1", parentId: "unit-ops", headUserId: "user-lead-1" },
    ];

    const users: OrgUserRecord[] = [
      { id: "user-gm", name: "General Manager", employeeNumber: "EMP-001" },
      { id: "user-ops-head", name: "Operations Head", employeeNumber: "EMP-010" },
      { id: "user-lead-1", name: "Cell Lead", employeeNumber: "EMP-050" },
      { id: "user-op-1", name: "Operator 1", employeeNumber: "EMP-101", orgUnitId: "unit-cell-1" },
    ];

    const lines: ReportingLineRecord[] = [
      { id: "l-1", reportUserId: "user-ops-head", managerUserId: "user-gm" },
      { id: "l-2", reportUserId: "user-lead-1", managerUserId: "user-ops-head" },
      { id: "l-3", reportUserId: "user-op-1", managerUserId: "user-lead-1" },
    ];

    const tree = buildOrgHierarchyTree(units, users, lines);
    assert.equal(tree.length, 1); // Single root
    const root = tree[0];
    assert.equal(root.unit.code, "ROOT");
    assert.equal(root.headUser?.name, "General Manager");
    assert.equal(root.children.length, 1);

    const opsNode = root.children[0];
    assert.equal(opsNode.unit.code, "OPS");
    assert.equal(opsNode.children.length, 1);

    const cellNode = opsNode.children[0];
    assert.equal(cellNode.unit.code, "CELL-1");
    assert.equal(cellNode.members.length, 1);
    assert.equal(cellNode.members[0].name, "Operator 1");
  });
});
