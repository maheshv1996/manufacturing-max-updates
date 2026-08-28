// Idempotent one-off: P21–P23 demo data (budget overrun, collections, payroll run).
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
const adapter = new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL }));
const prisma = new PrismaClient({ adapter });

// P21 — one budget overrun so the bell + digest + burn card demo works (Maintenance)
const maint = await prisma.budgetLine.findFirst({ where: { department: "Maintenance" } });
if (maint && Number(maint.spent) <= Number(maint.allocated)) {
  await prisma.budgetLine.update({
    where: { id: maint.id },
    data: { spent: Number(maint.allocated) * 1.09, notes: "Overrun demo — unplanned compressor overhaul." },
  });
  console.log("Maintenance budget marked overrun (109%).");
} else if (maint) {
  console.log("Maintenance budget already over allocated — skip.");
}

// P22 — collections demo: PARTIAL invoice (61-90d) assigned + L1 dunning; UNPAID unassigned
const inv3 = await prisma.invoice.findUnique({ where: { invoiceNumber: "INV-2026-003" } });
const inv1 = await prisma.invoice.findUnique({ where: { invoiceNumber: "INV-2026-001" } });
if (inv3 && (await prisma.collectionAccount.count()) === 0) {
  const alex = await prisma.user.findFirst({ where: { name: { contains: "Alex" } } });
  const collectorId = alex?.id || undefined;
  await prisma.collectionAccount.create({
    data: {
      invoiceId: inv3.id,
      collectorId,
      dunningLevel: 1,
      lastDunningAt: new Date(Date.now() - 3 * 86400000),
      notes: collectorId ? "Assigned to Alex — overdue 60+ days." : "Assigned to collections.",
      followUps: [
        { at: new Date(Date.now() - 21 * 86400000).toISOString(), by: "System Admin", note: "Called accounts dept — payment promised 2 weeks ago." },
        { at: new Date(Date.now() - 3 * 86400000).toISOString(), by: "Alex Vance", note: "L1 reminder sent by mail." },
      ],
    },
  });
  console.log("Collection account created for INV-2026-003 (collector + L1).");
}
if (inv1 && !(await prisma.collectionAccount.findUnique({ where: { invoiceId: inv1.id } }))) {
  await prisma.collectionAccount.create({ data: { invoiceId: inv1.id, followUps: [] } });
  console.log("Collection account created for INV-2026-001 (unassigned).");
}

// P23 — payroll draft run for the existing payslip month
const months = await prisma.payslip.findMany({ select: { month: true }, distinct: ["month"] });
const m = months[0]?.month;
if (m && !(await prisma.payrollRun.findUnique({ where: { month: m } }))) {
  await prisma.payrollRun.create({ data: { month: m, status: "DRAFT", generatedByName: "System Admin" } });
  console.log(`Payroll run created for ${m} (DRAFT).`);
} else if (m) {
  console.log(`Payroll run for ${m} already exists.`);
}

await prisma.$disconnect();
console.log("P21–P23 demo data sync done.");
