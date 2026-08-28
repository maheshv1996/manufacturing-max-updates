import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  // Find an existing work order
  const wo = await prisma.workOrder.findFirst({
    where: { trackingMode: "BATCH" },
    include: { product: true }
  });

  if (!wo) {
    console.log("No work order found to attach NCRs to.");
    return;
  }

  // Ensure we have a defect code
  let defect = await prisma.defectCode.findFirst();
  if (!defect) {
    defect = await prisma.defectCode.create({
      data: {
        code: "DEF-MRB",
        description: "MRB Defect",
        severity: "HIGH"
      }
    });
  }

  // Create a quarantine record
  const quarantine = await (prisma as any).scrapQuarantine.create({
    data: {
      workOrderId: wo.id,
      quantity: 5,
      defectCode: defect.code,
      loggedBy: "System Seed",
      status: "PENDING"
    }
  });

  // NCR 1: OPEN with containment
  await (prisma as any).ncrReport.create({
    data: {
      ncrNumber: "NCR-2026-001",
      quarantineId: quarantine.id,
      workOrderId: wo.id,
      productId: wo.productId,
      quantity: 5,
      defectCodeId: defect.id,
      severity: "HIGH",
      description: "Parts found out of tolerance during random inspection.",
      containmentAction: "Sorted current batch and isolated suspect parts.",
      status: "OPEN",
      raisedBy: "Quality Inspector",
    }
  });

  // NCR 2: CLOSED with full CAPA
  await (prisma as any).ncrReport.create({
    data: {
      ncrNumber: "NCR-2026-002",
      workOrderId: wo.id,
      productId: wo.productId,
      quantity: 12,
      defectCodeId: defect.id,
      severity: "CRITICAL",
      description: "Surface finish unacceptable on multiple pieces.",
      containmentAction: "Halted production and quarantined all parts from last shift.",
      why1: "Wrong grinding wheel used.",
      why2: "Operator picked standard instead of fine grit.",
      why3: "Wheels were mixed in the storage rack.",
      why4: "No visual identification on wheels.",
      why5: "Lack of 5S standard for grinding tools.",
      correctiveAction: "Replaced grinding wheel. Segregated and color-coded all grinding wheels in storage.",
      preventiveAction: "Updated SOP to include wheel color verification before starting operation.",
      status: "CLOSED",
      disposition: "REWORK",
      dispositionAuthority: "QUALITY",
      raisedBy: "Lead Inspector",
      closedAt: new Date(),
      approvedAt: new Date(),
    }
  });

  console.log("Seeded 2 NCR Reports.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
