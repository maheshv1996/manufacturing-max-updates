// P30 demo: open Q3 cycle (partial certifications) + restore drills linked to real backups
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });

const now = Date.now();

// 1. Open quarterly cycle if none open
let cycle = await prisma.accessReviewCycle.findFirst({ where: { status: "OPEN" } });
if (!cycle) {
  cycle = await prisma.accessReviewCycle.create({
    data: {
      name: "Q3 2026 Access Review",
      periodStart: new Date(now - 30 * 86400000),
      dueDate: new Date(now + 20 * 86400000),
      status: "OPEN",
      createdBy: "System Admin",
    },
  });
  console.log("cycle opened:", cycle.name, "due", cycle.dueDate.toLocaleDateString());
} else {
  console.log("cycle exists:", cycle.name, "due", cycle.dueDate.toLocaleDateString());
}

// 2. Certify a couple of users (grid shows CERTIFIED + UNCERTIFIED mix)
const sarah = await prisma.user.findUnique({ where: { employeeNumber: "1002" } });
const mike = await prisma.user.findUnique({ where: { employeeNumber: "2001" } });
const sarahPerms = sarah?.role?.permissions;
const supDepts = ["ops", "quality", "supply", "commercial", "people", "ehs", "maintenance", "projects", "finance", "engineering", "metrology", "executive"];
if (sarah && !(await prisma.accessCertification.findUnique({ where: { cycleId_userId: { cycleId: cycle.id, userId: sarah.id } } }))) {
  await prisma.accessCertification.create({
    data: { cycleId: cycle.id, userId: sarah.id, depts: supDepts, certifiedBy: "System Admin", notes: "Supervisor role verified against org chart" },
  });
  console.log("certified Sarah Jenkins");
}
if (mike && !(await prisma.accessCertification.findUnique({ where: { cycleId_userId: { cycleId: cycle.id, userId: mike.id } } }))) {
  await prisma.accessCertification.create({
    data: { cycleId: cycle.id, userId: mike.id, depts: ["ops"], certifiedBy: "System Admin", notes: "Operator access limited to terminal + ops" },
  });
  console.log("certified Mike Ross");
}

// 3. Restore drills (link to real SUCCESS backups when available)
const backups = await prisma.backupJob.findMany({ where: { status: "SUCCESS" }, orderBy: { startedAt: "desc" } });
if ((await prisma.restoreDrill.count()) === 0) {
  const d1 = new Date(now - 40 * 86400000);
  const d2 = new Date(now - 8 * 86400000);
  await prisma.restoreDrill.create({
    data: {
      drillDate: d1,
      performedBy: "System Admin",
      backupJobId: backups[0]?.id || null,
      backupName: backups[0] ? `mfgmax-${new Date(backups[0].startedAt).toISOString().slice(0, 10)}.dump` : "mfgmax-2026-06.dump",
      backupSizeMb: backups[0]?.sizeMb || 48.2,
      result: "PASS",
      durationSec: 94,
      verifiedAt: d1,
      notes: "Full restore to scratch schema — 5 users, 10 WOs, counts matched",
    },
  });
  await prisma.restoreDrill.create({
    data: {
      drillDate: d2,
      performedBy: "Sarah Jenkins",
      backupJobId: backups[1]?.id || null,
      backupName: backups[1] ? `mfgmax-${new Date(backups[1].startedAt).toISOString().slice(0, 10)}.dump` : "mfgmax-2026-07.dump",
      backupSizeMb: backups[1]?.sizeMb || 52.7,
      result: "PASS",
      durationSec: 87,
      verifiedAt: d2,
      notes: "Audit trail spot-check: last 30 audit entries restored and readable",
    },
  });
  console.log("2 restore drills logged");
} else {
  console.log("drills already exist — skip");
}

await prisma.$disconnect();
console.log("done");
