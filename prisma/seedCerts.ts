import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  // Find existing IN transactions
  const inTransactions = await (prisma as any).inventoryTransaction.findMany({
    where: { type: "IN" },
    include: { rawMaterial: true },
    take: 4,
  });

  if (inTransactions.length < 2) {
    console.log("Not enough IN transactions found. Seeding skipped (need at least 2).");
    return;
  }

  const now = new Date();
  const expiringSoon = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000); // +20 days

  // Cert 1: MILL_CERT for tx[0]
  await (prisma as any).materialCert.upsert({
    where: { inventoryTransactionId: inTransactions[0].id },
    update: {},
    create: {
      inventoryTransactionId: inTransactions[0].id,
      rawMaterialId: inTransactions[0].rawMaterialId,
      supplierId: inTransactions[0].rawMaterial?.supplierId || null,
      heatNumber: "HT-2026-0041",
      certNumber: "CERT-AMS-4911-0041",
      certType: "MILL_CERT",
      specGrade: "Ti-6Al-4V AMS 4911",
      expiresAt: null,
      uploadedBy: "Quality Dept",
    },
  });

  // Cert 2: COC for tx[1] — expiring in 20 days
  await (prisma as any).materialCert.upsert({
    where: { inventoryTransactionId: inTransactions[1].id },
    update: {},
    create: {
      inventoryTransactionId: inTransactions[1].id,
      rawMaterialId: inTransactions[1].rawMaterialId,
      supplierId: inTransactions[1].rawMaterial?.supplierId || null,
      heatNumber: "HT-2026-0038",
      certNumber: "COC-7075-0038",
      certType: "COC",
      specGrade: "Al 7075-T6 AMS 2770",
      expiresAt: expiringSoon,
      uploadedBy: "Quality Dept",
    },
  });

  // Cert 3: TEST_REPORT for tx[2] if it exists
  if (inTransactions[2]) {
    await (prisma as any).materialCert.upsert({
      where: { inventoryTransactionId: inTransactions[2].id },
      update: {},
      create: {
        inventoryTransactionId: inTransactions[2].id,
        rawMaterialId: inTransactions[2].rawMaterialId,
        supplierId: inTransactions[2].rawMaterial?.supplierId || null,
        heatNumber: "HT-2026-0035",
        certNumber: "TR-316L-0035",
        certType: "TEST_REPORT",
        specGrade: "SS 316L AMS 5507",
        expiresAt: null,
        uploadedBy: "Quality Dept",
      },
    });
  }

  // tx[3] intentionally left WITHOUT a cert — this is the "no-cert batch" for block demo

  const certCount = await (prisma as any).materialCert.count();
  console.log(`Seeded ${certCount} MaterialCert records. tx[${inTransactions.length > 3 ? 3 : "last"}] has NO cert.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
