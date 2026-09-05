import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveApproverStep,
  type ChainStep,
  type OrgLookup,
} from "../src/lib/org/approval";

// Org fixture: two units.
// QC unit has engineer "e1" (rank 2) and manager "qm1" (rank 4, head of QC).
// Plant unit has head "ph" (rank 5).
// Reporting: qm1 -> ph; e1 -> qm1.
const org: OrgLookup = {
  seats: [
    { userId: "e1", orgUnitId: "unit-qc", roleId: "QC-QE", levelRank: 2, scope: "UNIT", status: "ACTIVE" },
    { userId: "qm1", orgUnitId: "unit-qc", roleId: "QC-MGR", levelRank: 4, scope: "UNIT", status: "ACTIVE" },
    { userId: "ph", orgUnitId: "unit-plant", roleId: "EXEC-OWNER", levelRank: 5, scope: "PLANT", status: "ACTIVE" },
  ],
  managerOf: (userId) => (userId === "e1" ? "qm1" : userId === "qm1" ? "ph" : undefined),
  unitHeadOf: (unitId) => (unitId === "unit-qc" ? "qm1" : unitId === "unit-plant" ? "ph" : undefined),
  parentUnitOf: (unitId) => (unitId === "unit-qc" ? "unit-plant" : undefined),
};

const qcEngineerStep: ChainStep = {
  criteria: { roleId: "QC-QE", levelMin: 2, scope: "UNIT" },
  minApprovals: 1,
  fallback: { escalateLevels: 0 },
};

const plantHeadStep: ChainStep = {
  criteria: {},
  minApprovals: 1,
  fallback: { routeTo: "unitHead" },
};

test("resolves an in-unit role+level match to the right approver", () => {
  const r = resolveApproverStep(qcEngineerStep, { docUnitId: "unit-qc", requesterUserId: "e1", org });
  assert.equal(r.approvers.length, 1);
  assert.equal(r.approvers[0], "e1");
  assert.equal(r.escalated, false);
});

test("snapshot preserves the exact criteria (immutable for ApprovalTask)", () => {
  const r = resolveApproverStep(qcEngineerStep, { docUnitId: "unit-qc", requesterUserId: "e1", org });
  assert.deepEqual(r.criteriaSnapshot, { roleId: "QC-QE", levelMin: 2, scope: "UNIT" });
});

test("no in-unit match escalates up the manager chain", () => {
  // Nobody in the DOC unit matches; fallback escalateLevels 1 walks requester's manager.
  const r = resolveApproverStep(
    { criteria: { roleId: "NOBODY" }, minApprovals: 1, fallback: { escalateLevels: 1 } },
    { docUnitId: "unit-qc", requesterUserId: "e1", org },
  );
  assert.equal(r.escalated, true);
  assert.deepEqual(r.approvers, ["qm1"]);
});

test("routeTo unitHead resolves the document unit's head, climbing to root when needed", () => {
  const r = resolveApproverStep(plantHeadStep, { docUnitId: "unit-qc", requesterUserId: "e1", org });
  assert.equal(r.escalated, true);
  assert.deepEqual(r.approvers, ["qm1"]); // unit-qc head

  const r2 = resolveApproverStep(plantHeadStep, { docUnitId: "unit-plant", requesterUserId: "ph", org });
  assert.deepEqual(r2.approvers, ["ph"]);
});

test("minApprovals is preserved on the resolution for the task creator", () => {
  const step: ChainStep = { criteria: { roleId: "QC-QE", levelMin: 2, scope: "UNIT" }, minApprovals: 2, fallback: { escalateLevels: 0 } };
  const r = resolveApproverStep(step, { docUnitId: "unit-qc", requesterUserId: "e1", org });
  assert.equal(r.minApprovals, 2);
});

test("unresolvable step reports zero approvers (caller routes to human)", () => {
  const r = resolveApproverStep(
    { criteria: { roleId: "X" }, minApprovals: 1, fallback: { escalateLevels: 0 } },
    { docUnitId: "unit-x", requesterUserId: "ghost", org },
  );
  assert.equal(r.approvers.length, 0);
});
