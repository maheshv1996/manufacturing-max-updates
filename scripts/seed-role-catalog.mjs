// Idempotent: seeds the full organizational role catalog (docs/ROLES_RESPONSIBILITIES.md,
// src/lib/roleCatalog.ts) as assignable Role rows. Safe to re-run; system roles untouched.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { ROLE_CATALOG } from "../src/lib/roleCatalog.ts";

const adapter = new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL }));
const prisma = new PrismaClient({ adapter });

let created = 0;
let updated = 0;
for (const r of ROLE_CATALOG) {
  const existing = await prisma.role.findUnique({ where: { name: r.code } });
  const data = {
    description: `${r.title} - ${r.description}`.slice(0, 300),
    permissions: r.perms,
  };
  if (existing) {
    await prisma.role.update({ where: { name: r.code }, data });
    updated += 1;
  } else {
    await prisma.role.create({ data: { name: r.code, ...data, isSystem: false } });
    created += 1;
  }
}
const total = await prisma.role.count();
console.log(`role catalog: ${created} created, ${updated} updated, ${total} roles total`);
await prisma.$disconnect();