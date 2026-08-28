// P28 demo: add historical closed breakdowns (with RCA) so MTBF/MTTR compute
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });

const machines = await prisma.machine.findMany();
const now = Date.now();

const plan = [
  // [machineName, daysAgoOpened, hoursDown, description, rootCause, countermeasure]
  ["CNC Milling Center 1", 40, 3, "Spindle bearing noise — abnormal vibration during heavy cut",
    "Bearing preload loss after 8,000h runtime", "Added spindle bearing preload check to quarterly PM"],
  ["CNC Milling Center 1", 18, 5, "Coolant pump failure — thermal overload tripped",
    "Coolant filter clogged, pump ran dry", "Coolant filter replaced monthly; pump amperage logged weekly"],
  ["Robotic Welding Cell 3", 26, 8, "Robot axis 2 servo drive fault — weld program aborted mid-cycle",
    "Servo drive capacitor degradation", "Drive replaced; thermography inspection added to PM"],
  ["Injection Molding Machine 2", 33, 6, "Heater band burnout — barrel zone 4 temp dropped",
    "Heater band aged and shorted", "Heater bands replaced in pairs; resistance check at every mold change"],
];

for (const [name, daysAgo, hours, desc, rc, cm] of plan) {
  const m = machines.find((x) => x.name === name);
  if (!m) { console.log("skip (no machine):", name); continue; }
  const openedAt = new Date(now - daysAgo * 86400000);
  const closedAt = new Date(openedAt.getTime() + hours * 3600000);
  const exists = await prisma.maintenanceJob.findFirst({ where: { machineId: m.id, description: desc } });
  if (exists) { console.log("skip (exists):", name, desc.slice(0, 40)); continue; }
  await prisma.maintenanceJob.create({
    data: {
      machineId: m.id,
      requestedByName: "Ravi Kumar",
      type: "BREAKDOWN",
      priority: daysAgo > 30 ? "MEDIUM" : "HIGH",
      description: desc,
      status: "CLOSED",
      openedAt,
      closedAt,
      closedBy: "Alex Vance",
      rootCause: rc,
      countermeasure: cm,
      partsUsed: "See work order",
      costRupees: 15000 + Math.round(Math.random() * 20000),
      laborHours: Math.round(hours * 2),
    },
  });
  console.log("seeded:", name, desc.slice(0, 40));
}

await prisma.$disconnect();
console.log("done");
