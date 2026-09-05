/**
 * C1 — Idempotent v2 seed (DEPTH_02 defaults). Creates the global Level
 * ladder, a root OrgUnit, and default ApprovalChains per entity type. Safe to
 * re-run. Execute: `bun prisma/seed-v2.ts` (needs DATABASE_URL reachable).
 */
import { prisma } from "../src/lib/prisma";

const LEVEL_LADDER = [
  { name: "TRAINEE", rank: 1 },
  { name: "JUNIOR", rank: 2 },
  { name: "SENIOR", rank: 3 },
  { name: "LEAD", rank: 4 },
  { name: "MANAGER", rank: 5 },
  { name: "PLANT_HEAD", rank: 6 },
  { name: "DIRECTOR", rank: 7 },
] as const;

const DEFAULT_CHAINS = [
  {
    entityType: "QUOTATION",
    name: "Quotation default",
    steps: [{ criteria: {}, minApprovals: 1, fallback: { routeTo: "unitHead" } }],
  },
  {
    entityType: "PURCHASE_ORDER",
    name: "PO default",
    steps: [{ criteria: {}, minApprovals: 1, fallback: { routeTo: "unitHead" } }],
  },
  {
    entityType: "WORK_ORDER",
    name: "WO default",
    steps: [{ criteria: {}, minApprovals: 1, fallback: { routeTo: "unitHead" } }],
  },
] as const;

export async function main() {
  let levels = 0;
  for (const l of LEVEL_LADDER) {
    const existing = await prisma.level.findFirst({ where: { name: l.name, family: null } });
    if (existing) {
      if (existing.rank !== l.rank) {
        await prisma.level.update({ where: { id: existing.id }, data: { rank: l.rank } });
      }
    } else {
      await prisma.level.create({ data: { name: l.name, rank: l.rank, family: null } });
    }
    levels++;
  }
  console.log(`[seed-v2] levels ensured: ${levels}`);

  const rootCount = await prisma.orgUnit.count();
  if (rootCount === 0) {
    await prisma.orgUnit.create({
      data: { code: "ROOT", name: "Company", type: "DIVISION" },
    });
    console.log("[seed-v2] root org unit created");
  } else {
    console.log("[seed-v2] org units already present — root skipped");
  }

  let chains = 0;
  for (const c of DEFAULT_CHAINS) {
    const existing = await prisma.approvalChain.findFirst({
      where: { entityType: c.entityType, name: c.name },
    });
    if (existing) continue;
    await prisma.approvalChain.create({
      data: { entityType: c.entityType, name: c.name, steps: c.steps as unknown as object },
    });
    chains++;
  }
  console.log(`[seed-v2] approval chains ensured: ${chains}`);

  console.log("[seed-v2] done");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("[seed-v2] failed:", e?.message ?? e);
    await prisma.$disconnect();
    process.exit(1);
  });
