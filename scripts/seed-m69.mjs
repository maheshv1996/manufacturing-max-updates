// M6–M9 demo seed: AQL plans, FQC checklist, SLA-breach complaint, QMS docs
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });

// M6 — AQL sampling plans per material class
const plans = [
  { materialClass: "A", aqlLevel: "I", sampleSize: 5, acceptanceNumber: 0, rejectionNumber: 1, description: "Critical materials — tightened sampling" },
  { materialClass: "B", aqlLevel: "II", sampleSize: 20, acceptanceNumber: 1, rejectionNumber: 2, description: "Standard structural materials" },
  { materialClass: "C", aqlLevel: "III", sampleSize: 50, acceptanceNumber: 2, rejectionNumber: 3, description: "Consumables & bulk" },
];
for (const p of plans) {
  await prisma.aqlPlan.upsert({
    where: { materialClass: p.materialClass },
    update: p,
    create: p,
  });
}
console.log("AQL plans A/B/C seeded");

// Give the first raw materials real classes
const rms = await prisma.rawMaterial.findMany({ orderBy: { sku: "asc" }, take: 3 });
for (let i = 0; i < rms.length; i++) {
  await prisma.rawMaterial.update({ where: { id: rms[i].id }, data: { materialClass: ["A", "B", "C"][i] } });
}
console.log("material classes assigned");

// M7 — a completed WO gets a complete FQC checklist + released data package
const done = await prisma.workOrder.findFirst({ where: { status: "COMPLETED" } });
if (done) {
  await prisma.fqcChecklist.upsert({
    where: { workOrderId: done.id },
    update: { finalInspectionPassed: true, packingDone: true, docPackDone: true, inspector: "Ravi Kumar" },
    create: { workOrderId: done.id, finalInspectionPassed: true, packingDone: true, docPackDone: true, inspector: "Ravi Kumar", checkedAt: new Date() },
  });
  const dp = await prisma.dataPackage.findFirst({ where: { workOrderId: done.id, status: "RELEASED" } });
  if (!dp) {
    const count = await prisma.dataPackage.count({ where: { packageNumber: { startsWith: "DP-" } } });
    await prisma.dataPackage.create({
      data: { packageNumber: `DP-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`, workOrderId: done.id, status: "RELEASED", createdBy: "Seed", releasedBy: "Ravi Kumar", releasedAt: new Date() },
    });
  }
  console.log(`FQC checklist complete + released DP for ${done.woNumber}`);
} else {
  console.log("no COMPLETED WO — FQC demo skipped");
}

// M8 — a complaint whose 24h ack SLA already breached (exec strip + bell)
const slaNow = Date.now();
const slaRaised = new Date(slaNow - 25 * 3600000); // 25h ago
const slaCmp = await prisma.customerComplaint.findUnique({ where: { complaintNumber: "CMP-DEMO-SLA" } });
if (!slaCmp) {
  await prisma.customerComplaint.create({
    data: {
      complaintNumber: "CMP-DEMO-SLA",
      customerName: "Honeywell Aerospace",
      type: "QUALITY",
      severity: "HIGH",
      description: "Surface finish out of spec on received batch — awaiting acknowledgement.",
      status: "OPEN",
      raisedAt: slaRaised,
      ackDeadline: new Date(slaRaised.getTime() + 24 * 3600000),
      eightDDeadline: new Date(slaRaised.getTime() + 10 * 86400000),
    },
  });
  console.log("CMP-DEMO-SLA seeded (ack SLA breached)");
}

// M9 — QMS documents with annual review dates (one overdue, one due soon, one far out)
const docs = [
  { docNumber: "QMS-2025-001", title: "Control of Documents", docType: "PROCEDURE", nextReviewAt: new Date(Date.now() - 10 * 86400000), status: "CURRENT", revision: "C" },
  { docNumber: "QMS-2025-002", title: "Calibration Control Procedure", docType: "PROCEDURE", nextReviewAt: new Date(Date.now() + 15 * 86400000), status: "UNDER_REVIEW", revision: "B" },
  { docNumber: "QMS-2025-003", title: "Training & Competence Matrix", docType: "RECORD", nextReviewAt: new Date(Date.now() + 200 * 86400000), status: "CURRENT", revision: "A" },
];
for (const d of docs) {
  await prisma.qmsDocument.upsert({
    where: { docNumber: d.docNumber },
    update: { ...d, owner: "Quality Manager" },
    create: { ...d, owner: "Quality Manager", approvedAt: new Date(Date.now() - 300 * 86400000) },
  });
}
console.log("QMS documents seeded (1 overdue, 1 due 15d, 1 ok)");

console.log("done");
await prisma.$disconnect();
