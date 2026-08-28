// Idempotent one-off: P18–P20 demo data (price revisions, idle enquiry, lost quotes).
// Mirrors prisma/seed.ts so existing dev DBs match fresh seeds without a re-seed.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
const adapter = new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL }));
const prisma = new PrismaClient({ adapter });

// P19 — price revisions (skip if any exist)
if ((await prisma.priceRevision.count()) === 0) {
  const product = await prisma.product.findFirst({ orderBy: { sku: "asc" } });
  if (product) {
    const base = product.sellingPricePerUnit ?? 100;
    const eff335 = new Date(Date.now() - 335 * 24 * 60 * 60 * 1000);
    await prisma.priceRevision.createMany({
      data: [
        {
          revisionNumber: "PR-2025-101",
          productId: product.id,
          oldPrice: Math.round((base / 1.07) * 100) / 100,
          newPrice: base,
          increasePct: 7,
          effectiveDate: eff335,
          reason: "Annual contractual increase 7%",
          status: "APPROVED",
          approvedByName: "System Admin",
          approvedAt: eff335,
          createdByName: "System Admin",
        },
        {
          revisionNumber: "PR-2026-201",
          productId: product.id,
          oldPrice: base,
          newPrice: Math.round(base * 1.08 * 100) / 100,
          increasePct: 8,
          effectiveDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
          reason: "Proposed 8% increase for next contract year",
          status: "DRAFT",
          createdByName: "System Admin",
        },
      ],
    });
    console.log("Price revisions seeded.");
  }
} else {
  console.log("Price revisions already present — skip.");
}

// P20 — idle enquiry + lost quotes
const qt1 = await prisma.quotation.findUnique({ where: { quoteNumber: "QT-2026-001" } });
if (qt1 && !qt1.lastFollowUpAt) {
  await prisma.quotation.update({
    where: { id: qt1.id },
    data: {
      createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
      followUps: [
        { at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(), by: "System Admin", note: "RFQ received — awaiting tolerance sign-off" },
      ],
    },
  });
  console.log("QT-2026-001 marked idle (9 days).");
}

if ((await prisma.quotation.count({ where: { status: "LOST" } })) === 0) {
  const product = await prisma.product.findFirst({ orderBy: { sku: "asc" } });
  if (product) {
    await prisma.quotation.createMany({
      data: [
        {
          quoteNumber: "QT-2026-004",
          customerName: "Bharat Forge Ltd",
          customerContact: "rfq@bharatforge.in",
          status: "LOST",
          lostReason: "PRICE",
          validUntil: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          estimatedCost: 95000.0,
          quotedPrice: 132000.0,
          marginPct: 28.0,
          notes: "Customer went with a competitor 6% lower — price cap exceeded.",
          followUps: [
            { at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(), by: "System Admin", note: "Quoted ₹132k — no movement" },
            { at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(), by: "System Admin", note: "Lost on price — competitor ₹124k" },
          ],
        },
        {
          quoteNumber: "QT-2026-005",
          customerName: "Tata Advanced Systems",
          customerContact: "procure@tatasystems.com",
          status: "LOST",
          lostReason: "DELIVERY",
          validUntil: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          estimatedCost: 145000.0,
          quotedPrice: 198000.0,
          marginPct: 26.8,
          notes: "Customer needed 2-week lead time; we could only commit 4.",
          followUps: [
            { at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), by: "System Admin", note: "Lead time objection raised" },
          ],
        },
      ],
    });
    console.log("Lost enquiries seeded (PRICE + DELIVERY).");
  }
}

await prisma.$disconnect();
console.log("P18–P20 demo data sync done.");
