// P26–P27 demo seed: permits (pending / approved / expired) + observation quota setting
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
const adapter = new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL }));
const prisma = new PrismaClient({ adapter });

async function main() {
  // Quota setting
  const quota = await prisma.setting.upsert({
    where: { key: "ehsObservationQuota" },
    update: {},
    create: { key: "ehsObservationQuota", value: "4" },
  });
  console.log("quota setting:", quota.value);

  const jobs = await prisma.maintenanceJob.findMany({
    include: { machine: { select: { name: true } } },
    orderBy: { openedAt: "desc" },
  });
  if (jobs.length === 0) {
    console.log("No maintenance jobs — creating one to hang permits on");
    const machine = await prisma.machine.findFirst();
    const job = await prisma.maintenanceJob.create({
      data: {
        machineId: machine.id,
        requestedByName: "Ravi Kumar",
        type: "BREAKDOWN",
        priority: "HIGH",
        description: "Welding of cracked base frame — HOT WORK permit required",
        status: "OPEN",
      },
      include: { machine: true },
    });
    jobs.push(job);
  }

  const openJobs = jobs.filter((j) => j.status === "OPEN" || j.status === "IN_PROGRESS");

  // 1. A PENDING permit (2 of 3 approvals signed) on the newest open job
  const pendingJob = openJobs[0] || jobs[0];
  const pendingCount = await prisma.permitToWork.count({ where: { status: "PENDING" } });
  if (pendingCount === 0) {
    const d = new Date();
    await prisma.permitToWork.create({
      data: {
        permitNo: "PTW-2026-001",
        maintenanceJobId: pendingJob.id,
        type: "HOT_WORK",
        description: "Oxy-acetylene welding on base frame — fire watch posted, extinguisher on site",
        location: "Shopfloor bay 1, welding zone",
        requestedBy: "Ravi Kumar",
        status: "PENDING",
        ehsApprovedBy: "Priya Nair",
        ehsApprovedAt: new Date(d.getTime() - 86400000 * 1),
        ehsApprovedReason: "Hot work assessment done; fire watch assigned; extinguisher verified",
        maintApprovedBy: null,
        prodApprovedBy: null,
        validFrom: d,
        validUntil: new Date(d.getTime() + 86400000 * 2),
      },
    });
    console.log("pending permit PTW-2026-001 created (EHS signed, awaiting Maintenance + Production)");
  } else {
    console.log("pending permit already exists — skip");
  }

  // 2. An APPROVED valid permit on another open job (fully signed)
  const approvedJob = openJobs[1] || openJobs[0] || jobs[0];
  const approvedCount = await prisma.permitToWork.count({ where: { status: "APPROVED" } });
  if (approvedCount === 0) {
    const d = new Date();
    await prisma.permitToWork.create({
      data: {
        permitNo: "PTW-2026-002",
        maintenanceJobId: approvedJob.id,
        type: "HEIGHT_WORK",
        description: "Overhead crane rail inspection at 6m — harness + anchor points verified",
        location: "Crane bay, rail level",
        requestedBy: "Ravi Kumar",
        status: "APPROVED",
        ehsApprovedBy: "Priya Nair",
        ehsApprovedAt: new Date(d.getTime() - 86400000 * 2),
        ehsApprovedReason: "Fall protection plan reviewed",
        maintApprovedBy: "Alex Vance",
        maintApprovedAt: new Date(d.getTime() - 86400000 * 2 + 3600000),
        maintApprovedReason: "Inspection plan and permits in place",
        prodApprovedBy: "Suresh Menon",
        prodApprovedAt: new Date(d.getTime() - 86400000 * 2 + 7200000),
        prodApprovedReason: "Production stoppage scheduled; line cleared",
        validFrom: new Date(d.getTime() - 86400000 * 1),
        validUntil: new Date(d.getTime() + 86400000 * 3),
      },
    });
    console.log("approved permit PTW-2026-002 created (all 3 signed)");
  } else {
    console.log("approved permit already exists — skip");
  }

  // 3. An EXPIRED permit (approval lapsed → auto-void on read)
  const expiredCount = await prisma.permitToWork.count({ where: { status: "EXPIRED" } });
  if (expiredCount === 0) {
    const d = new Date();
    await prisma.permitToWork.create({
      data: {
        permitNo: "PTW-2026-003",
        maintenanceJobId: jobs[jobs.length - 1].id,
        type: "CONFINED_SPACE",
        description: "Paint booth interior cleaning — gas test required",
        location: "Paint booth",
        requestedBy: "Ravi Kumar",
        status: "APPROVED", // validUntil in the past → auto-EXPIRED on next read
        ehsApprovedBy: "Priya Nair",
        ehsApprovedAt: new Date(d.getTime() - 86400000 * 12),
        ehsApprovedReason: "Gas test procedure reviewed",
        maintApprovedBy: "Alex Vance",
        maintApprovedAt: new Date(d.getTime() - 86400000 * 12 + 3600000),
        maintApprovedReason: "Confined space entry plan reviewed",
        prodApprovedBy: "Suresh Menon",
        prodApprovedAt: new Date(d.getTime() - 86400000 * 12 + 7200000),
        prodApprovedReason: "Booth cleared for maintenance window",
        validFrom: new Date(d.getTime() - 86400000 * 10),
        validUntil: new Date(d.getTime() - 86400000 * 3), // lapsed 3 days ago
      },
    });
    console.log("expired permit PTW-2026-003 created (will auto-void on read)");
  } else {
    console.log("expired permit already exists — skip");
  }

  // Audit trail
  await prisma.auditLog.create({
    data: {
      actor: "Seed",
      action: "SEED_P2627",
      entityType: "SYSTEM",
      entityId: "seed-p2627",
      details: "Seeded permit-to-work demo (pending/approved/expired) + observation quota setting",
    },
  });

  const total = await prisma.permitToWork.count();
  console.log(`done — ${total} permits total`);
}

main().finally(() => prisma.$disconnect());
