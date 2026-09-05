#!/usr/bin/env node
/**
 * C9-9 — Real-DB smoke test for EHS, Lean & Continuous Improvement (C9).
 * Drives the full lifecycle through the typed adapters against mfgmax_v2_test:
 *   - Safety incident report → START_INVESTIGATION → F10 closure evidence → CLOSE
 *   - P27 near-miss observation quota projection
 *   - Improvement project (DMAIC) → sequential phase advance → HOLD / RESUME
 *   - RCA record (5-Why / fishbone)
 *   - Action items add → mark DONE
 *   - F11 project completion guard (RCA rootCause + all items DONE) → COMPLETE
 *   - 5S audit scoring & audit score items
 *   - Continuous improvement idea submit → upvote → review → implement
 *   - Audit log trail verification
 *
 * Usage:
 *   node scripts/v2-smoke-ehs-lean.mjs   (DATABASE_URL defaults to mfgmax_v2_test)
 */

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:1996@localhost:5432/mfgmax_v2_test";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { reportIncidentTx, incidentActionTx, nearMissQuotaTx } from "../src/lib/ehs/ehsTx.ts";
import {
  createProjectTx,
  projectActionTx,
  recordRcaTx,
  addActionItemTx,
  markActionItemDoneTx,
  recordFiveSAuditTx,
  submitIdeaTx,
  upvoteIdeaTx,
  transitionIdeaTx,
} from "../src/lib/lean/leanTx.ts";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString, max: 5 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function log(msg) {
  console.log(`[smoke-ehs-lean] ${msg}`);
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

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const created = {};
const actor = { id: "smoke-admin", name: "Smoke Admin" };

async function main() {
  await prisma.$connect();
  log("connected to DB");
  const runTag = `${Date.now()}`;

  let admin = await prisma.user.findFirst({ where: { username: "admin" } });
  if (!admin) {
    admin = await prisma.user.create({
      data: { name: "Smoke Admin", username: `smoke.admin.${runTag}`, level: "MANAGER" },
    });
  }
  actor.id = admin.id;
  actor.name = admin.name;
  log(`acting as user ${admin.id} (${admin.name})`);

  // Ensure a test machine exists
  let machine = await prisma.machine.findFirst();
  if (!machine) {
    machine = await prisma.machine.create({
      data: { name: `CNC-SMOKE-${runTag}`, code: `M-SMOKE-${runTag}` },
    });
  }
  created.machine = machine;

  // ----------------------------------------------------------- EHS Incidents
  await smoke("reportIncidentTx creates SafetyIncident (audited)", async () => {
    const inc = await reportIncidentTx(prisma, actor, {
      type: "NEAR_MISS",
      severity: "MEDIUM",
      location: "Shop Floor Bay 3",
      description: "Oil spill near coolant reservoir",
      machineId: created.machine.id,
    });
    assert(inc.id, "incident id missing");
    assert(inc.status === "OPEN", "initial status must be OPEN");
    created.incidentId = inc.id;

    const row = await prisma.safetyIncident.findUnique({ where: { id: inc.id } });
    assert(row, "safety incident not persisted in DB");
    assert(row.reportedBy === actor.name, "reportedBy mismatch");
  });

  await smoke("reportIncidentTx fails closed on missing location", async () => {
    let threw = false;
    try {
      await reportIncidentTx(prisma, actor, {
        type: "HAZARD",
        severity: "HIGH",
        location: "",
        description: "Exposed wire",
      });
    } catch {
      threw = true;
    }
    assert(threw, "expected validation failure for empty location");
  });

  await smoke("incidentActionTx START_INVESTIGATION demands capaOwner", async () => {
    const res = await incidentActionTx(
      prisma,
      actor,
      created.incidentId,
      "START_INVESTIGATION",
      { capaOwner: "Safety Officer Rajesh", dueDate: new Date(Date.now() + 86400000) },
    );
    assert(res.status === "IN_INVESTIGATION", "status must transition to IN_INVESTIGATION");

    const row = await prisma.safetyIncident.findUnique({ where: { id: created.incidentId } });
    assert(row.capaOwner === "Safety Officer Rajesh", "capaOwner not set");
  });

  await smoke("F10 guardrail: CLOSE refuses without closure evidence", async () => {
    let threw = false;
    try {
      await incidentActionTx(prisma, actor, created.incidentId, "CLOSE", {
        actionTaken: "", // missing action
      });
    } catch {
      threw = true;
    }
    assert(threw, "F10: CLOSE without evidence must be rejected");
  });

  await smoke("incidentActionTx CLOSE with evidence stamps closedAt/closedBy", async () => {
    const res = await incidentActionTx(prisma, actor, created.incidentId, "CLOSE", {
      actionTaken: "Cleaned spill and replaced faulty seal",
      rootCause: "Gasket deterioration from thermal cycling",
    });
    assert(res.status === "CLOSED", "status must be CLOSED");
    assert(res.closedAt instanceof Date, "closedAt must be stamped");

    const row = await prisma.safetyIncident.findUnique({ where: { id: created.incidentId } });
    assert(row.closedBy === actor.name, "closedBy must match actor name");
    assert(row.rootCause === "Gasket deterioration from thermal cycling", "rootCause not persisted");
  });

  // ------------------------------------------------------ P27 Near-Miss Quota
  await smoke("nearMissQuotaTx projects monthly quota rows per manager", async () => {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const result = await nearMissQuotaTx(prisma, {
      monthStart,
      now,
      managers: [actor.name, "Manager Suresh"],
      quota: 4,
    });
    assert(Array.isArray(result.rows), "rows must be an array");
    assert(result.rows.length === 2, "must project 2 manager rows");
    const adminRow = result.rows.find((r) => r.name === actor.name);
    assert(adminRow, "admin row must be present");
    assert(result.quota === 4, "quota must be 4");
    assert(adminRow.count >= 1, "must count reported NEAR_MISS incident");
  });

  // ---------------------------------------------------- Improvement Projects
  await smoke("createProjectTx opens project in DEFINE phase (audited)", async () => {
    const p = await createProjectTx(prisma, actor, {
      title: `Cycle Time Reduction Cell 2 - ${runTag}`,
      type: "DMAIC",
      ownerName: "Black Belt Anita",
      description: "Lean Six Sigma project to eliminate bottleneck in rough milling",
      machineId: created.machine.id,
    });
    assert(p.id, "project id missing");
    assert(p.phase === "DEFINE", "initial phase must be DEFINE");
    assert(p.status === "OPEN", "initial status must be OPEN");
    created.projectId = p.id;
  });

  await smoke("projectActionTx ADVANCE_PHASE advances sequentially (DEFINE → MEASURE)", async () => {
    const p = await projectActionTx(prisma, actor, created.projectId, "ADVANCE_PHASE");
    assert(p.phase === "MEASURE", "phase must advance to MEASURE");
    assert(p.status === "IN_PROGRESS", "status must transition from OPEN to IN_PROGRESS");
  });

  await smoke("projectActionTx HOLD and RESUME reversible moves", async () => {
    const held = await projectActionTx(prisma, actor, created.projectId, "HOLD");
    assert(held.status === "ON_HOLD", "status must be ON_HOLD");

    const resumed = await projectActionTx(prisma, actor, created.projectId, "RESUME");
    assert(resumed.status === "IN_PROGRESS", "status must be IN_PROGRESS");
  });

  // --------------------------------------------------- RCA & Action Items
  await smoke("recordRcaTx upserts 5-Why and rootCause evidence", async () => {
    const rca = await recordRcaTx(prisma, actor, created.projectId, {
      problemStatement: "Milling cycle takes 142s vs 105s target",
      why1: "Feed rate set lower than programmed",
      why2: "Excessive vibration at standard feed",
      why3: "Tool holder runout exceeds 15 microns",
      rootCause: "Worn collet taper causing excessive runout",
      fishboneCategory: "MACHINE",
    });
    assert(rca.projectId === created.projectId, "rca projectId mismatch");
    assert(rca.rootCause === "Worn collet taper causing excessive runout", "rootCause mismatch");
  });

  await smoke("addActionItemTx adds action item to project", async () => {
    const item = await addActionItemTx(prisma, actor, created.projectId, {
      description: "Replace spindle collets and re-verify runout with dial test indicator",
      ownerName: "Toolroom Incharge Vikas",
      dueDate: new Date(Date.now() + 86400000 * 2),
    });
    assert(item.id, "action item id missing");
    assert(item.status === "OPEN", "action item status must be OPEN");
    created.actionItemId = item.id;
  });

  await smoke("F11 guardrail: COMPLETE refuses when action item is open", async () => {
    let threw = false;
    try {
      await projectActionTx(prisma, actor, created.projectId, "COMPLETE");
    } catch {
      threw = true;
    }
    assert(threw, "F11: COMPLETE must be rejected while action items are open");
  });

  await smoke("markActionItemDoneTx marks action item DONE", async () => {
    const item = await markActionItemDoneTx(prisma, actor, created.actionItemId);
    assert(item.status === "DONE", "action item status must be DONE");
  });

  await smoke("projectActionTx COMPLETE succeeds with full evidence (stamps completedAt)", async () => {
    // Advance through ANALYZE, IMPROVE, CONTROL
    await projectActionTx(prisma, actor, created.projectId, "ADVANCE_PHASE"); // ANALYZE
    await projectActionTx(prisma, actor, created.projectId, "ADVANCE_PHASE"); // IMPROVE
    await projectActionTx(prisma, actor, created.projectId, "ADVANCE_PHASE"); // CONTROL

    const p = await projectActionTx(prisma, actor, created.projectId, "COMPLETE");
    assert(p.status === "COMPLETED", "status must be COMPLETED");

    const row = await prisma.improvementProject.findUnique({ where: { id: created.projectId } });
    assert(row.completedAt instanceof Date, "completedAt must be stamped");
  });

  // ------------------------------------------------------------- 5S Audits
  await smoke("recordFiveSAuditTx computes totalPct and stores scores", async () => {
    // Ensure 5S items exist
    let item1 = await prisma.fiveSItem.findFirst({ where: { category: "SORT" } });
    if (!item1) {
      item1 = await prisma.fiveSItem.create({
        data: { category: "SORT", seq: 1, text: "Red tag unneeded tools and fixtures" },
      });
    }
    let item2 = await prisma.fiveSItem.findFirst({ where: { category: "SHINE" } });
    if (!item2) {
      item2 = await prisma.fiveSItem.create({
        data: { category: "SHINE", seq: 1, text: "Clean machine surfaces and chip trays" },
      });
    }

    const audit = await recordFiveSAuditTx(prisma, actor, {
      area: "Assembly Cell 1",
      auditorName: actor.name,
      notes: "Weekly 5S assessment",
      scores: [
        { itemId: item1.id, score: 5 },
        { itemId: item2.id, score: 4 },
      ],
    });
    assert(audit.id, "audit id missing");
    // (5 + 4) / (2 * 5) * 100 = 90.0%
    assert(audit.totalPct === 90, `expected 90% but got ${audit.totalPct}`);
    assert(audit.scoreCount === 2, "score count must be 2");
  });

  await smoke("recordFiveSAuditTx rejects invalid score (>5)", async () => {
    let threw = false;
    try {
      await recordFiveSAuditTx(prisma, actor, {
        area: "Store",
        auditorName: actor.name,
        scores: [{ itemId: "dummy", score: 6 }],
      });
    } catch {
      threw = true;
    }
    assert(threw, "expected error for score > 5");
  });

  // --------------------------------------------------------- Idea Pipeline
  await smoke("submitIdeaTx creates Idea in SUBMITTED", async () => {
    const idea = await submitIdeaTx(prisma, actor, {
      title: `Gravity Feed Rack for Fasteners - ${runTag}`,
      description: "Install inclined roller racks to eliminate reaching fatigue",
      category: "ERGONOMICS",
    });
    assert(idea.id, "idea id missing");
    assert(idea.status === "SUBMITTED", "initial status must be SUBMITTED");
    assert(idea.votes === 0, "initial votes must be 0");
    created.ideaId = idea.id;
  });

  await smoke("upvoteIdeaTx increments votes without status change", async () => {
    const updated = await upvoteIdeaTx(prisma, actor, created.ideaId);
    assert(updated.votes === 1, `votes must be 1, got ${updated.votes}`);

    const row = await prisma.idea.findUnique({ where: { id: created.ideaId } });
    assert(row.status === "SUBMITTED", "upvote must not mutate status");
  });

  await smoke("transitionIdeaTx advances SUBMITTED → IN_REVIEW → IMPLEMENTED", async () => {
    const inReview = await transitionIdeaTx(prisma, actor, created.ideaId, "START_REVIEW");
    assert(inReview.status === "IN_REVIEW", "status must be IN_REVIEW");

    const implemented = await transitionIdeaTx(prisma, actor, created.ideaId, "IMPLEMENT");
    assert(implemented.status === "IMPLEMENTED", "status must be IMPLEMENTED");
  });

  // ------------------------------------------------------------- Audit Log
  await smoke("audit trail covers SafetyIncident, ImprovementProject, FiveSAudit, Idea", async () => {
    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: { in: ["SafetyIncident", "ImprovementProject", "FiveSAudit", "Idea"] },
      },
      select: { entityType: true, action: true },
      take: 50,
      orderBy: { at: "desc" },
    });
    const types = new Set(logs.map((l) => l.entityType));
    assert(types.has("SafetyIncident"), "SafetyIncident audit log missing");
    assert(types.has("ImprovementProject"), "ImprovementProject audit log missing");
    assert(types.has("FiveSAudit"), "FiveSAudit audit log missing");
    assert(types.has("Idea"), "Idea audit log missing");
  });

  // --------------------------------------------------------------- Summary
  log("\n==========================================");
  log(`C9 Real-DB Smoke Summary: ${results.pass} PASSED, ${results.fail} FAILED`);
  log("==========================================");

  if (results.fail > 0) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
