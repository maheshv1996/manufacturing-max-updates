// Idempotent one-off: user levels (MANAGER/WORKER) + dept.approve permission keys.
// Mirrors prisma/seed.ts so existing dev DBs match fresh seeds without a re-seed.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
const adapter = new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL }));
const prisma = new PrismaClient({ adapter });

const APPROVE = [
  "ops.approve", "supply.approve", "commercial.approve", "people.approve",
  "system.approve", "quality.approve", "metrology.approve", "engineering.approve",
  "finance.approve", "ehs.approve", "maintenance.approve", "projects.approve", "exec.approve",
];

const admin = await prisma.role.findUnique({ where: { name: "ADMIN" } });
if (admin) {
  await prisma.role.update({ where: { id: admin.id }, data: { permissions: [...new Set([...(admin.permissions || []), ...APPROVE])] } });
}
const SUPERVISOR_PERMS = [
  "ops.view", "ops.edit", "supply.view", "commercial.view", "people.view",
  "system.view", "quality.view", "metrology.view", "engineering.view",
  "finance.view", "ehs.view", "maintenance.view", "projects.view", "exec.view",
  "reports.print", "terminal.use", "ops.approve", "people.approve",
];
const sup = await prisma.role.findUnique({ where: { name: "SUPERVISOR" } });
if (sup) {
  await prisma.role.update({ where: { id: sup.id }, data: { permissions: SUPERVISOR_PERMS } });
}

// Seeded department heads → MANAGER.
const heads = await prisma.user.findMany({ where: { OR: [{ username: "admin" }, { username: "sjenkins" }] } });
for (const u of heads) {
  await prisma.user.update({ where: { id: u.id }, data: { level: "MANAGER" } });
}

const users = await prisma.user.findMany({ select: { username: true, level: true, role: { select: { name: true } } }, orderBy: { username: "asc" } });
console.log(users.map((u) => `${u.username} | ${u.level} | ${u.role?.name}`).join("\n"));
await prisma.$disconnect();
