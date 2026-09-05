import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assembleSeatContextBundle,
  trimDataByScope,
  canInvokeTool,
  type SeatAssignmentInput,
  type CopilotToolDefinition,
} from "../src/lib/copilot/seatContext.ts";
import type { PermissionKey } from "../src/lib/org/permissions.ts";

describe("Copilot SeatContext — Assembly & Scope", () => {
  const levels = [
    { name: "TRAINEE", rank: 1 },
    { name: "JUNIOR", rank: 2 },
    { name: "SENIOR", rank: 3 },
    { name: "LEAD", rank: 4 },
    { name: "MANAGER", rank: 5 },
  ];

  it("assembles complete SeatContextBundle with active assignments, level rank, and acting coverage", () => {
    const assignments: SeatAssignmentInput[] = [
      {
        id: "sa-1",
        orgUnitId: "unit-machining",
        orgUnitName: "CNC Machining Cell",
        orgUnitCode: "CNC-01",
        roleId: "role-operator",
        roleName: "CNC Operator",
        permissions: ["terminal.use" as PermissionKey, "ops.view" as PermissionKey],
        levelName: "JUNIOR",
        scope: "TEAM",
        status: "ACTIVE",
        validFrom: new Date("2026-01-01"),
        validTo: null,
        actsForUserId: null,
      },
      {
        id: "sa-2",
        orgUnitId: "unit-ehs",
        orgUnitName: "EHS Committee",
        orgUnitCode: "EHS",
        roleId: "role-warden",
        roleName: "Safety Warden",
        permissions: ["ehs.view" as PermissionKey, "ehs.edit" as PermissionKey],
        levelName: "SENIOR",
        scope: "UNIT",
        status: "ACTING",
        validFrom: new Date("2026-01-01"),
        validTo: new Date("2026-12-31"),
        actsForUserId: "user-covered-99",
      },
      {
        id: "sa-expired",
        orgUnitId: "unit-old",
        orgUnitName: "Old Unit",
        orgUnitCode: "OLD",
        roleId: "role-old",
        roleName: "Old Role",
        permissions: ["finance.view" as PermissionKey],
        levelName: "TRAINEE",
        scope: "SELF",
        status: "EXITED",
        validFrom: new Date("2025-01-01"),
        validTo: new Date("2025-06-01"),
        actsForUserId: null,
      },
    ];

    const bundle = assembleSeatContextBundle({
      user: {
        id: "user-101",
        name: "Ravi Kumar",
        employeeNumber: "EMP-101",
        homePlantId: "plant-hyderabad",
        isOwner: false,
        preferredLanguage: "TE",
      },
      plant: {
        id: "plant-hyderabad",
        code: "HYD-01",
        name: "Hyderabad Precision Plant",
        timezone: "Asia/Kolkata",
        activeShifts: ["SHIFT_A", "SHIFT_B"],
      },
      assignments,
      levels,
      reporting: {
        managerUserId: "user-mgr-200",
        directReportUserIds: [],
        deputyUserIds: ["user-deputy-300"],
      },
      workload: {
        pendingApprovalsCount: 2,
        dueDocumentsCount: 1,
        activeTasksCount: 4,
      },
      now: new Date("2026-09-05T12:00:00Z"),
    });

    assert.equal(bundle.identity.userId, "user-101");
    assert.equal(bundle.identity.preferredLanguage, "TE");
    assert.equal(bundle.effectiveLevel, 3); // Max rank between JUNIOR (2) and SENIOR (3)
    assert.equal(bundle.effectiveScope, "UNIT"); // Highest scope between TEAM and UNIT
    assert.equal(bundle.actingForUserId, "user-covered-99");
    assert.deepEqual(bundle.activeRoleCodes, ["CNC Operator", "Safety Warden"]);

    // Permissions union without duplicates and excluding expired assignment
    assert.ok(bundle.effectivePerms.includes("terminal.use" as PermissionKey));
    assert.ok(bundle.effectivePerms.includes("ops.view" as PermissionKey));
    assert.ok(bundle.effectivePerms.includes("ehs.view" as PermissionKey));
    assert.ok(bundle.effectivePerms.includes("ehs.edit" as PermissionKey));
    assert.ok(!bundle.effectivePerms.includes("finance.view" as PermissionKey));

    assert.equal(bundle.workload.pendingApprovalsCount, 2);
  });

  it("trims data collections strictly according to effective scope", () => {
    interface TestRecord {
      id: string;
      createdByUserId: string;
      teamId?: string;
      orgUnitId: string;
      plantId: string;
    }

    const records: TestRecord[] = [
      { id: "rec-1", createdByUserId: "user-1", teamId: "team-a", orgUnitId: "unit-cnc", plantId: "plant-1" },
      { id: "rec-2", createdByUserId: "user-2", teamId: "team-a", orgUnitId: "unit-cnc", plantId: "plant-1" },
      { id: "rec-3", createdByUserId: "user-3", teamId: "team-b", orgUnitId: "unit-cnc", plantId: "plant-1" },
      { id: "rec-4", createdByUserId: "user-4", teamId: "team-c", orgUnitId: "unit-assembly", plantId: "plant-1" },
      { id: "rec-5", createdByUserId: "user-5", teamId: "team-d", orgUnitId: "unit-qc", plantId: "plant-2" },
    ];

    // SELF scope
    const selfTrimmed = trimDataByScope(records, {
      scope: "SELF",
      userId: "user-1",
      teamIds: ["team-a"],
      unitId: "unit-cnc",
      plantId: "plant-1",
    });
    assert.deepEqual(selfTrimmed.map((r) => r.id), ["rec-1"]);

    // TEAM scope
    const teamTrimmed = trimDataByScope(records, {
      scope: "TEAM",
      userId: "user-1",
      teamIds: ["team-a"],
      unitId: "unit-cnc",
      plantId: "plant-1",
    });
    assert.deepEqual(teamTrimmed.map((r) => r.id), ["rec-1", "rec-2"]);

    // UNIT scope
    const unitTrimmed = trimDataByScope(records, {
      scope: "UNIT",
      userId: "user-1",
      teamIds: ["team-a"],
      unitId: "unit-cnc",
      plantId: "plant-1",
    });
    assert.deepEqual(unitTrimmed.map((r) => r.id), ["rec-1", "rec-2", "rec-3"]);

    // PLANT scope
    const plantTrimmed = trimDataByScope(records, {
      scope: "PLANT",
      userId: "user-1",
      teamIds: ["team-a"],
      unitId: "unit-cnc",
      plantId: "plant-1",
    });
    assert.deepEqual(plantTrimmed.map((r) => r.id), ["rec-1", "rec-2", "rec-3", "rec-4"]);

    // ALL scope (owner)
    const allTrimmed = trimDataByScope(records, {
      scope: "ALL",
      userId: "user-1",
      teamIds: ["team-a"],
      unitId: "unit-cnc",
      plantId: "plant-1",
    });
    assert.equal(allTrimmed.length, 5);
  });

  it("checks tool invocation authorization based on permissions and min level rank", () => {
    const mockBundle = {
      identity: { userId: "user-1", name: "Ravi", employeeNumber: "101", isOwner: false, preferredLanguage: "EN" as const },
      effectivePerms: ["ops.view" as PermissionKey, "ops.edit" as PermissionKey, "quality.view" as PermissionKey],
      effectiveLevel: 3, // SENIOR
      effectiveScope: "UNIT" as const,
      actingForUserId: null,
      activeRoleCodes: ["Lead Operator"],
      plant: { id: "p1", code: "P1", name: "Plant 1", timezone: "UTC", activeShifts: [] },
      reporting: { directReportUserIds: [], deputyUserIds: [] },
      workload: { pendingApprovalsCount: 0, dueDocumentsCount: 0, activeTasksCount: 0 },
    };

    const allowedTool: CopilotToolDefinition = {
      name: "summarizeProduction",
      requiredPermission: "ops.view",
      minLevelRank: 2,
    };

    const forbiddenPermTool: CopilotToolDefinition = {
      name: "proposeOverride",
      requiredPermission: "kpi.override",
      minLevelRank: 2,
    };

    const forbiddenLevelTool: CopilotToolDefinition = {
      name: "approveFinancialAdjustment",
      requiredPermission: "ops.edit",
      minLevelRank: 5, // Requires MANAGER (rank 5)
    };

    assert.equal(canInvokeTool(mockBundle, allowedTool).allowed, true);
    assert.equal(canInvokeTool(mockBundle, forbiddenPermTool).allowed, false);
    assert.equal(canInvokeTool(mockBundle, forbiddenLevelTool).allowed, false);
  });
});
