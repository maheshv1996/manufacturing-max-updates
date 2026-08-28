import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
const adapter = new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL }));
const prisma = new PrismaClient({ adapter });

if (!(await prisma.quotation.findUnique({ where: { quoteNumber: "QT-2026-006" } }))) {
  const product = await prisma.product.findFirst({ orderBy: { sku: "asc" } });
  if (product) {
    await prisma.quotation.create({
      data: {
        quoteNumber: "QT-2026-006",
        customerName: "Mahindra Defence Systems",
        customerContact: "sourcing@mahindradefence.com",
        status: "SENT",
        validUntil: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        estimatedCost: 62000.0,
        quotedPrice: 88000.0,
        marginPct: 29.5,
        notes: "Proforma sent 12 days ago — awaiting customer review.",
        createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
        followUps: [
          { at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(), by: "System Admin", note: "Proforma sent via email" },
        ],
        lines: { create: [{ productId: product.id, plannedQty: 800, unitPrice: 110.0, subtotal: 88000.0 }] },
      },
    });
    console.log("Idle demo enquiry QT-2026-006 seeded (12 days idle).");
  }
} else {
  console.log("QT-2026-006 already present.");
}
await prisma.$disconnect();
