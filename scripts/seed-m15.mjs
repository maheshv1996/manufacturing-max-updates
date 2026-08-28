// M1–M5 demo seed: tool-life variety + lean observations (monthly savings → exec strip)
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });

const machine = await prisma.machine.findFirst();

// M3 — tool life states
const die = await prisma.maintenanceTool.findUnique({ where: { code: "T-DIE-001" } });
if (die && die.lifeStatus !== "SCRAPPED" && !(die.usedUnits >= 50000 && die.regrinds === 0 && die.lifeStatus === "NEEDS_REGRIND")) {
  await prisma.maintenanceTool.update({
    where: { id: die.id },
    data: { usedUnits: 50000, regrinds: 0, maxRegrinds: 3, lifeStatus: "NEEDS_REGRIND", lastChangedAt: new Date() },
  });
  await prisma.toolLifeLog.create({ data: { toolId: die.id, action: "NEEDS_REGRIND", actor: "Seed", note: "Reached rated life 50,000/50,000 — regrind needed" } });
  console.log("T-DIE-001 → NEEDS_REGRIND (life exhausted, regrinds left)");
}

const mould = await prisma.maintenanceTool.findUnique({ where: { code: "T-MOULD-002" } });
if (mould && mould.lifeStatus === "AVAILABLE") {
  const wo = await prisma.workOrder.findFirst({ where: { status: "IN_PROGRESS" }, orderBy: { updatedAt: "desc" } });
  await prisma.maintenanceTool.update({ where: { id: mould.id }, data: { lifeStatus: "IN_USE", lastChangedAt: new Date() } });
  await prisma.toolLifeLog.create({ data: { toolId: mould.id, action: "ISSUE", woNumber: wo?.woNumber || "WO-2026-008", costRupees: 1250, actor: "Ravi Kumar", note: "Issued for production run" } });
  if (wo) {
    await prisma.workOrder.update({ where: { id: wo.id }, data: { toolingCostRupees: { increment: 1250 } } });
  }
  console.log("T-MOULD-002 → IN_USE (₹1250 posted to job costing)");
}

// M4 — lean observations (one implemented THIS month for the exec strip)
if ((await prisma.leanObservation.count()) === 0) {
  const now = Date.now();
  const obs = [
    { title: "Castings staged beside press instead of 40m walk", area: "Stamping Press Shop", category: "MOTION", description: "Move incoming rack to the press line. Operator walked 40m per cycle.", estMinutesSaved: 4, status: "IMPLEMENTED", observedAt: now - 12 * 86400000, implementedAt: now - 6 * 86400000, by: "Sarah Jenkins" },
    { title: "Die warm-up overlaps shift start", area: "Injection Molding", category: "WAIT", description: "Start die heating 15 min before shift so first shot is on time.", estMinutesSaved: 15, status: "IMPLEMENTED", observedAt: now - 5 * 86400000, implementedAt: now - 2 * 86400000, by: "Mike Ross" },
    { title: "Duplicate first-article paperwork", area: "QC Office", category: "OVERPROCESS", description: "Filling the same fields twice across two forms — merge into one.", estMinutesSaved: 3, status: "OPEN", observedAt: now - 1 * 86400000, by: "Priya Nair" },
  ];
  for (const o of obs) {
    await prisma.leanObservation.create({
      data: {
        title: o.title, area: o.area, category: o.category, description: o.description,
        estMinutesSaved: o.estMinutesSaved, status: o.status,
        observedBy: o.by, observedAt: new Date(o.observedAt),
        implementedAt: o.implementedAt ? new Date(o.implementedAt) : null,
        implementedBy: o.status === "IMPLEMENTED" ? o.by : null,
      },
    });
  }
  console.log("3 lean observations seeded (2 implemented this month → exec strip)");
}

await prisma.$disconnect();
console.log("done");
