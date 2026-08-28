import { prisma } from './src/lib/prisma';

async function main() {
  const wo = await prisma.workOrder.findUnique({
    where: { woNumber: 'WO-2026-003' }, // The SERIAL work order
  });

  if (!wo) {
    console.log("SERIAL Work order WO-2026-003 not found.");
    return;
  }
  
  const existing = await prisma.dataPackage.findFirst({
    where: { workOrderId: wo.id }
  });
  
  if (existing) {
    console.log("Data package already exists for this WO.");
    return;
  }

  // Generate package number
  const packageNumber = `DP-2026-0001`;

  console.log("Creating RELEASED Data Package...");
  
  // Create an empty snapshot for now, or just some mock data
  const snapshot = {
    woNumber: "WO-2026-003",
    trackingMode: "SERIAL",
    customerName: "AeroDynamics Inc",
    product: {
      name: "Titanium Control Valve",
      sku: "AE-VALVE-002"
    },
    productionLogs: [
      { goodQuantity: 50, machine: { name: "CNC-01" } }
    ],
    inventoryTransactions: [],
    faiReports: [],
    ncrReports: [],
    holdPointSignoffs: [],
    serialUnits: [
      { serialNo: "SN-001", status: "COMPLETED", events: [] },
      { serialNo: "SN-002", status: "COMPLETED", events: [] }
    ],
    qualityInspections: []
  };

  const dataPackage = await prisma.dataPackage.create({
    data: {
      packageNumber,
      workOrderId: wo.id,
      status: "RELEASED",
      snapshot,
      createdBy: "Seed Script",
      releasedBy: "Seed Script",
      releasedAt: new Date(),
    }
  });

  console.log(`Created Data Package: ${dataPackage.packageNumber}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
