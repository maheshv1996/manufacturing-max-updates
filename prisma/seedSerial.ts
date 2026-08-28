import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Seeding aerospace serial work order...");

  // Get a plant and a product
  const plant = await prisma.plant.findFirst({ where: { isActive: true } });
  const product = await prisma.product.findFirst({ where: { isActive: true } });
  
  if (!plant || !product) {
    console.error("Missing plant or product");
    return;
  }

  // Create Aerospace WO
  const wo = await prisma.workOrder.create({
    data: {
      woNumber: `WO-AERO-${Date.now()}`,
      trackingMode: 'SERIAL',
      productId: product.id,
      plantId: plant.id,
      plannedQuantity: 10,
      status: 'IN_PROGRESS',
      plannedStartDate: new Date(),
      plannedEndDate: new Date(Date.now() + 86400000 * 7),
      customerName: "SpaceX",
    }
  });

  console.log(`Created Serial Work Order: ${wo.woNumber}`);

  const operators = await prisma.user.findMany({ take: 3 });
  const operatorName = operators.length > 0 ? operators[0].name : "System";

  // Create 10 Serials with events
  for (let i = 1; i <= 10; i++) {
    const serialNo = `${wo.woNumber}-S${i.toString().padStart(3, '0')}`;
    const unit = await prisma.serialUnit.create({
      data: {
        serialNo,
        workOrderId: wo.id,
        productId: product.id,
        status: i === 10 ? 'QUARANTINED' : 'WIP',
      }
    });

    // Add Events
    await prisma.serialEvent.create({
      data: {
        serialUnitId: unit.id,
        type: 'OPERATION_COMPLETE',
        description: 'Completed Operation 10: Forging',
        actorName: operatorName,
      }
    });
    
    await prisma.serialEvent.create({
      data: {
        serialUnitId: unit.id,
        type: 'INSPECTION',
        description: 'Passed Visual Inspection',
        actorName: operatorName,
      }
    });

    if (i === 10) {
      // Scrap event for the last one
      await prisma.serialEvent.create({
        data: {
          serialUnitId: unit.id,
          type: 'NCR',
          description: 'Failed Non-Destructive Testing (Micro-crack detected)',
          actorName: operatorName,
        }
      });
    }
  }

  console.log("Seeded 10 serial units with genealogy events.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
