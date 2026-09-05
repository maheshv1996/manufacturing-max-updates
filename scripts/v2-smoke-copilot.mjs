#!/usr/bin/env node
/**
 * C11-11 — Real-DB smoke test for AI Copilot Framework (C11).
 * Drives the complete AI Copilot lifecycle against mfgmax_v2_test:
 *   - Seat context bundle assembly from live DB relations (DEPTH_02 §10)
 *   - Scope-trimmed task routing & execution (Tier A deterministic mode)
 *   - Work order readiness explanation with multi-gate validation
 *   - 8D CAPA drafting with Guardrail G-3 evidence enforcement
 *   - AI action proposals creation with in-tx audit log (AI-2)
 *   - Guardrail G-6 structural blockage of self-approval (separation of duties)
 *   - Human supervisor approval with in-tx audit payload (AI initiator, human approver)
 *   - Human supervisor rejection with in-tx audit log (AI_PROPOSAL_REJECTED)
 *   - Pending proposals query filtering
 *
 * Usage:
 *   node --import tsx scripts/v2-smoke-copilot.mjs
 */

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:1996@localhost:5432/mfgmax_v2_test";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  getSeatContextBundleTx,
  decideAiProposalTx,
  getPendingProposalsTx,
  executeCopilotTaskTx,
} from "../src/lib/copilot/copilotTx.ts";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString, max: 5 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function log(msg) {
  console.log(`[smoke-copilot] ${msg}`);
}

const results = { pass: 0, fail: 0, tests: [] };
async function smoke(name, fn) {
  try {
    await fn();
    results.pass++;
    results.tests.push({ name, status: "PASS" });
    log(`PASS: ${name}`);
  } catch (e) {
    results.fail++;
    results.tests.push({ name, status: "FAIL", error: e.message });
    log(`FAIL: ${name} — ${e.message}`);
  }
}

async function run() {
  const runId = Date.now().toString().slice(-6);
  log(`Starting C11 AI Copilot smoke run [${runId}] on ${process.env.DATABASE_URL}`);

  let plant, orgUnit, roleOp, roleLead, roleMgr, opUser, leadUser, mgrUser;
  let raOp, raLead, raMgr, repLineOpLead, repLineLeadMgr;

  try {
    // 1. Seed test data
    await smoke("Seed test organization, users, levels, and roles", async () => {
      plant = await prisma.plant.create({
        data: {
          code: `COP-PLT-${runId}`,
          name: `Copilot Test Plant ${runId}`,
        },
      });

      orgUnit = await prisma.orgUnit.create({
        data: {
          code: `UNIT-CNC-${runId}`,
          name: `CNC Cell ${runId}`,
          type: "CELL",
        },
      });

      roleOp = await prisma.role.create({
        data: {
          name: `Copilot-Operator-${runId}`,
          permissions: ["terminal.use", "ops.view", "quality.edit"],
        },
      });

      roleLead = await prisma.role.create({
        data: {
          name: `Copilot-Lead-${runId}`,
          permissions: ["terminal.use", "ops.view", "kpi.override", "ops.approve", "quality.edit"],
        },
      });

      roleMgr = await prisma.role.create({
        data: {
          name: `Copilot-Manager-${runId}`,
          permissions: ["terminal.use", "ops.view", "kpi.override", "ops.approve", "quality.approve"],
        },
      });

      await prisma.level.upsert({
        where: { name_family: { name: "WORKER", family: "global" } },
        update: { rank: 2 },
        create: { name: "WORKER", rank: 2, family: "global" },
      });

      await prisma.level.upsert({
        where: { name_family: { name: "LEAD", family: "global" } },
        update: { rank: 4 },
        create: { name: "LEAD", rank: 4, family: "global" },
      });

      await prisma.level.upsert({
        where: { name_family: { name: "MANAGER", family: "global" } },
        update: { rank: 5 },
        create: { name: "MANAGER", rank: 5, family: "global" },
      });

      opUser = await prisma.user.create({
        data: {
          username: `cop_op_${runId}`,
          name: `Operator User ${runId}`,
          employeeNumber: `EMP-OP-${runId}`,
          homePlantId: plant.id,
          level: "WORKER",
          roleId: roleOp.id,
        },
      });

      leadUser = await prisma.user.create({
        data: {
          username: `cop_lead_${runId}`,
          name: `Lead User ${runId}`,
          employeeNumber: `EMP-LEAD-${runId}`,
          homePlantId: plant.id,
          level: "MANAGER",
          roleId: roleLead.id,
        },
      });

      mgrUser = await prisma.user.create({
        data: {
          username: `cop_mgr_${runId}`,
          name: `Manager User ${runId}`,
          employeeNumber: `EMP-MGR-${runId}`,
          homePlantId: plant.id,
          level: "MANAGER",
          roleId: roleMgr.id,
        },
      });

      raOp = await prisma.roleAssignment.create({
        data: {
          userId: opUser.id,
          orgUnitId: orgUnit.id,
          roleId: roleOp.id,
          levelName: "WORKER",
          scope: "TEAM",
          status: "ACTIVE",
        },
      });

      raLead = await prisma.roleAssignment.create({
        data: {
          userId: leadUser.id,
          orgUnitId: orgUnit.id,
          roleId: roleLead.id,
          levelName: "LEAD",
          scope: "UNIT",
          status: "ACTIVE",
        },
      });

      raMgr = await prisma.roleAssignment.create({
        data: {
          userId: mgrUser.id,
          orgUnitId: orgUnit.id,
          roleId: roleMgr.id,
          levelName: "MANAGER",
          scope: "PLANT",
          status: "ACTIVE",
        },
      });

      repLineOpLead = await prisma.reportingLine.create({
        data: {
          reportUserId: opUser.id,
          managerUserId: leadUser.id,
          orgUnitId: orgUnit.id,
        },
      });

      repLineLeadMgr = await prisma.reportingLine.create({
        data: {
          reportUserId: leadUser.id,
          managerUserId: mgrUser.id,
          orgUnitId: orgUnit.id,
        },
      });
    });

    // 2. Test Seat Context Resolution
    await smoke("Resolve live SeatContextBundle from database relations", async () => {
      const bundle = await getSeatContextBundleTx(prisma, opUser.id, orgUnit.id, plant.id);
      if (!bundle) throw new Error("Expected bundle to resolve");
      if (bundle.identity.userId !== opUser.id) throw new Error("User ID mismatch");
      if (bundle.identity.employeeNumber !== `EMP-OP-${runId}`) throw new Error("Employee number mismatch");
      if (bundle.effectiveLevel !== 2) throw new Error(`Expected level rank 2, got ${bundle.effectiveLevel}`);
      if (bundle.reporting.managerUserId !== leadUser.id) throw new Error("Lead reporting line did not resolve");
      if (!bundle.effectivePerms.includes("terminal.use")) throw new Error("Missing terminal.use perm");
      if (!bundle.effectivePerms.includes("quality.edit")) throw new Error("Missing quality.edit perm");
    });

    // 3. Test WO Readiness Explanation
    await smoke("Execute explainReadiness task with all gates cleared", async () => {
      const res = await executeCopilotTaskTx(prisma, {
        toolId: "explainReadiness",
        context: {
          woCode: "WO-TEST-001",
          materialReady: true,
          drawingRevValid: true,
          calibrationValid: true,
          fixtureAvailable: true,
          faiCleared: true,
        },
        actor: { id: opUser.id, name: opUser.name },
      });

      if (!res.content.includes("READY")) {
        throw new Error(`Expected content to indicate READY, got: ${res.content}`);
      }
    });

    await smoke("Execute explainReadiness task with blocked gates", async () => {
      const res = await executeCopilotTaskTx(prisma, {
        toolId: "explainReadiness",
        context: {
          woCode: "WO-TEST-002",
          materialReady: false,
          drawingRevValid: true,
          calibrationValid: false,
          fixtureAvailable: true,
          faiCleared: false,
        },
        actor: { id: opUser.id, name: opUser.name },
      });

      if (!res.content.includes("BLOCKED by 3 gate(s)")) {
        throw new Error(`Expected 3 blocked gates, got: ${res.content}`);
      }
    });

    // 4. Test 8D Drafting with G-3 Guardrail
    await smoke("Draft 8D D1 section successfully", async () => {
      const res = await executeCopilotTaskTx(prisma, {
        toolId: "draft8D",
        context: {
          section: "D1",
          problemStatement: "Surface roughness out of tolerance",
          partNumber: "PART-AERO-01",
        },
        actor: { id: opUser.id, name: opUser.name },
      });

      if (!res.content.includes("D1 - Champion & Team")) {
        throw new Error(`Expected D1 content, got: ${res.content}`);
      }
    });

    await smoke("Refuse 8D D8 closure when D4-D7 evidence is missing (G-3)", async () => {
      const res = await executeCopilotTaskTx(prisma, {
        toolId: "draft8D",
        context: {
          section: "D8",
          problemStatement: "Surface roughness out of tolerance",
          d4RootCause: "Tool wear",
          // d5, d6, d7 missing!
        },
        actor: { id: opUser.id, name: opUser.name },
      });

      if (!res.error || !res.error.includes("Guardrail G-3")) {
        throw new Error(`Expected Guardrail G-3 error, got: ${JSON.stringify(res)}`);
      }
    });

    let proposalId;
    // 5. Submit AI Proposal and verify in-tx AuditLog
    await smoke("Submit AI action proposal and verify in-tx AuditLog persistence", async () => {
      const res = await executeCopilotTaskTx(prisma, {
        toolId: "proposeOverride",
        context: {
          proposalType: "OVERRIDE",
          entityType: "MachineKpi",
          entityId: "CNC-01",
          actionSummary: `Override OEE target from 85% to 75% for run ${runId}`,
          targetValue: 75,
        },
        actor: { id: leadUser.id, name: leadUser.name },
        targetApproverUserId: mgrUser.id,
      });

      if (!res.proposal?.id) throw new Error(`Expected proposal ID, got: ${JSON.stringify(res)}`);
      proposalId = res.proposal.id;

      // Verify AuditLog row
      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          entityId: proposalId,
          action: "AI_PROPOSAL_CREATED",
        },
      });

      if (!auditEntry) {
        throw new Error("AuditLog entry for AI_PROPOSAL_CREATED was not found in DB");
      }
    });

    // 6. Test Guardrail G-6: Self-approval blockage
    await smoke("Enforce G-6: structurally block self-approval of AI proposal", async () => {
      const decisionRes = await decideAiProposalTx(prisma, {
        proposalId,
        decision: "ACCEPT",
        reason: "Self approve attempt",
        actor: { id: leadUser.id, name: leadUser.name },
        actorPermissions: ["kpi.override"],
        actorLevelRank: 4,
      });

      if (decisionRes.success) {
        throw new Error("Self-approval should have been blocked");
      }
      if (!decisionRes.error?.includes("User cannot approve an AI proposal they initiated")) {
        throw new Error(`Unexpected error message: ${decisionRes.error}`);
      }
    });

    // 7. Human Manager Approval with In-tx Audit
    await smoke("Approve AI proposal via authorized manager and verify audit trail", async () => {
      const decisionRes = await decideAiProposalTx(prisma, {
        proposalId,
        decision: "ACCEPT",
        reason: "Approved after tooling review",
        actor: { id: mgrUser.id, name: mgrUser.name },
        actorPermissions: ["kpi.override"],
        actorLevelRank: 5,
        actorSeatId: `seat-${mgrUser.id}`,
      });

      if (!decisionRes.success) {
        throw new Error(`Approval failed: ${decisionRes.error}`);
      }

      // Verify task status
      const updatedTask = await prisma.approvalTask.findUnique({
        where: { id: proposalId },
      });
      if (updatedTask.status !== "APPROVED") {
        throw new Error(`Expected status APPROVED, got ${updatedTask.status}`);
      }

      // Verify AuditLog row
      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          action: "AI_PROPOSAL_ACCEPTED",
          entityType: "MachineKpi",
        },
        orderBy: { at: "desc" },
      });

      if (!auditEntry) {
        throw new Error("AuditLog entry for AI_PROPOSAL_ACCEPTED was not found in DB");
      }
      if (!auditEntry.details.includes("Approved after tooling review")) {
        throw new Error("AuditLog details missing approval reason");
      }
    });

    // 8. Rejection test
    let rejectionProposalId;
    await smoke("Reject AI proposal with reason and verify AI_PROPOSAL_REJECTED audit", async () => {
      const res = await executeCopilotTaskTx(prisma, {
        toolId: "proposeOverride",
        context: {
          proposalType: "OVERRIDE",
          entityType: "MachineKpi",
          entityId: "CNC-02",
          actionSummary: "Unwarranted speed override",
        },
        actor: { id: leadUser.id, name: leadUser.name },
        targetApproverUserId: mgrUser.id,
      });

      rejectionProposalId = res.proposal?.id;
      if (!rejectionProposalId) throw new Error("Expected rejection proposal ID");

      const decisionRes = await decideAiProposalTx(prisma, {
        proposalId: rejectionProposalId,
        decision: "REJECT",
        reason: "Speed override exceeds safe spindle limit",
        actor: { id: mgrUser.id, name: mgrUser.name },
        actorPermissions: ["kpi.override"],
        actorLevelRank: 5,
        actorSeatId: `seat-${mgrUser.id}`,
      });

      if (!decisionRes.success) {
        throw new Error(`Rejection failed: ${decisionRes.error}`);
      }

      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          action: "AI_PROPOSAL_REJECTED",
          entityType: "MachineKpi",
        },
        orderBy: { at: "desc" },
      });

      if (!auditEntry) {
        throw new Error("AuditLog entry for AI_PROPOSAL_REJECTED was not found in DB");
      }
      if (!auditEntry.details.includes("safe spindle limit")) {
        throw new Error("AuditLog details missing rejection reason");
      }
    });

    // 9. Query pending proposals
    await smoke("Query pending proposals with scoping filter", async () => {
      const proposals = await getPendingProposalsTx(prisma);
      if (!Array.isArray(proposals)) {
        throw new Error("Expected array of pending proposals");
      }
    });

  } finally {
    // 10. Clean up
    log("Cleaning up test records...");
    try {
      if (repLineOpLead) await prisma.reportingLine.deleteMany({ where: { orgUnitId: orgUnit?.id } });
      if (repLineLeadMgr) await prisma.reportingLine.deleteMany({ where: { orgUnitId: orgUnit?.id } });
      if (raOp) await prisma.roleAssignment.deleteMany({ where: { userId: opUser?.id } });
      if (raLead) await prisma.roleAssignment.deleteMany({ where: { userId: leadUser?.id } });
      if (raMgr) await prisma.roleAssignment.deleteMany({ where: { userId: mgrUser?.id } });
      await prisma.approvalTask.deleteMany({
        where: {
          entityType: "AI_PROPOSAL",
          assignedToUserId: { in: [opUser?.id, leadUser?.id, mgrUser?.id].filter(Boolean) },
        },
      });
      if (opUser) await prisma.user.delete({ where: { id: opUser.id } }).catch(() => {});
      if (leadUser) await prisma.user.delete({ where: { id: leadUser.id } }).catch(() => {});
      if (mgrUser) await prisma.user.delete({ where: { id: mgrUser.id } }).catch(() => {});
      if (roleOp) await prisma.role.delete({ where: { id: roleOp.id } }).catch(() => {});
      if (roleLead) await prisma.role.delete({ where: { id: roleLead.id } }).catch(() => {});
      if (roleMgr) await prisma.role.delete({ where: { id: roleMgr.id } }).catch(() => {});
      if (orgUnit) await prisma.orgUnit.delete({ where: { id: orgUnit.id } }).catch(() => {});
      if (plant) await prisma.plant.delete({ where: { id: plant.id } }).catch(() => {});
    } catch (cleanupErr) {
      log(`Cleanup warning: ${cleanupErr.message}`);
    }
    await pool.end();
  }

  log(`Smoke complete: ${results.pass} passed, ${results.fail} failed`);
  if (results.fail > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("Fatal smoke run error:", e);
  process.exit(1);
});
