// P29 demo: milestones per project, sales owner, and a slipped WO for HIGH risk
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });

const projects = await prisma.project.findMany({ include: { milestones: true, workOrders: true } });
const now = Date.now();

for (const p of projects) {
  const isAero = p.code === "PRJ-2026-A";
  const isBattery = p.code === "PRJ-2026-T";
  if (p.salesOwner !== "Sarah Jenkins" && p.salesOwner !== "System Admin") {
    await prisma.project.update({ where: { id: p.id }, data: { salesOwner: "Sarah Jenkins" } });
  }

  if (p.milestones.length === 0) {
    const base = new Date(p.targetCompletionDate).getTime();
    const plan = isAero
      ? [
          { name: "Design Freeze", daysBefore: 60 },
          { name: "First Article Approval", daysBefore: 20 },
          { name: "Production Ramp-up", daysBefore: 5 },
        ]
      : isBattery
      ? [
          { name: "Tooling Release", daysBefore: 45 },
          { name: "Pilot Build", daysBefore: 15 },
        ]
      : [
          { name: "Material Receipt", daysBefore: 30 },
          { name: "Customer Trial Run", daysBefore: 10 },
        ];
    for (const m of plan) {
      await prisma.projectMilestone.create({
        data: {
          projectId: p.id,
          name: m.name,
          dueDate: new Date(base - m.daysBefore * 86400000),
          status: m.daysBefore > 30 ? "COMPLETED" : "OPEN",
          completedAt: m.daysBefore > 30 ? new Date(base - (m.daysBefore + 3) * 86400000) : null,
          completedBy: m.daysBefore > 30 ? "System Admin" : null,
        },
      });
    }
    console.log("milestones seeded:", p.code);
  }
}

// Make the aero program HIGH risk: its first-article WO is overdue (plannedEndDate in the past, still IN_PROGRESS)
const aero = projects.find((p) => p.code === "PRJ-2026-AERO");
if (aero) {
  const openWo = aero.workOrders.find((w) => w.status !== "COMPLETED");
  if (openWo && new Date(openWo.plannedEndDate) >= new Date(now)) {
    await prisma.workOrder.update({
      where: { id: openWo.id },
      data: { plannedEndDate: new Date(now - 6 * 86400000), status: "IN_PROGRESS" },
    });
    console.log("aero WO slipped:", openWo.woNumber, "→ plannedEndDate 6 days ago");
  } else {
    console.log("aero WO already overdue — skip");
  }
} else {
  console.log("aero project not found");
}

await prisma.$disconnect();
console.log("done");
