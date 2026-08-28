import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Starting multi-plant migration...");

  // 1. Rename existing plant
  let plantA = await prisma.plant.findFirst({ orderBy: { createdAt: "asc" } });
  if (!plantA) {
    console.log("No Plant A found. Something is wrong.");
    return;
  }

  plantA = await prisma.plant.update({
    where: { id: plantA.id },
    data: {
      name: "Unit 1",
      code: "PL-A",
      city: "Local City",
    },
  });
  console.log("Plant A renamed to Unit 1.");

  // Check if Unit 2 already exists
  let plantB = await prisma.plant.findUnique({ where: { code: "PL-B" } });
  if (plantB) {
    console.log("Plant B already exists. Aborting seed to prevent duplicates.");
    return;
  }

  // 2. Create Plant B
  plantB = await prisma.plant.create({
    data: {
      name: "Unit 2",
      code: "PL-B",
      city: "Other City",
      address: "200 Remote Parkway, Secondary City",
    },
  });
  console.log("Plant B (Unit 2) created.");

  // 3. Create Line for Plant B
  const lineB = await prisma.productionLine.create({
    data: {
      name: "Assembly Line Unit 2",
      plantId: plantB.id,
    },
  });

  // 4. Create Machines for Plant B
  const mac1 = await prisma.machine.create({
    data: {
      name: "CNC Router - U2",
      code: "U2-CNC-01",
      lineId: lineB.id,
      plantId: plantB.id,
      idealCycleTimeSeconds: 40.0,
      status: "RUNNING",
      currentState: "RUNNING",
      iotEnabled: true,
      stationName: "U2 CNC Bay",
    },
  });

  await prisma.machine.create({
    data: {
      name: "Packaging Robot - U2",
      code: "U2-PKG-01",
      lineId: lineB.id,
      plantId: plantB.id,
      idealCycleTimeSeconds: 20.0,
      status: "IDLE",
      currentState: "OFF",
      stationName: "U2 Packing Bay",
    },
  });

  // 5. Create Raw Materials for Plant B
  await prisma.rawMaterial.create({
    data: {
      sku: "RM-U2-STEEL",
      name: "Unit 2 Steel Coil",
      unit: "kg",
      currentStock: 5000,
      minStock: 1000,
      unitCost: 1.5,
      plantId: plantB.id,
    },
  });

  await prisma.rawMaterial.create({
    data: {
      sku: "RM-U2-PLASTIC",
      name: "Unit 2 Plastic Pellets",
      unit: "kg",
      currentStock: 2500,
      minStock: 500,
      unitCost: 2.2,
      plantId: plantB.id,
    },
  });

  // 6. Create Product (shared, products aren't plant scoped in schema currently)
  let p1 = await prisma.product.findFirst();
  if (!p1) {
    p1 = await prisma.product.create({
      data: {
        sku: "PRD-U2-SPECIAL",
        name: "U2 Special Gear",
        targetCycleTimeSeconds: 40.0,
      }
    });
  }

  // 7. Create Work Orders for Plant B
  const now = new Date();
  const daysAgo = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d;
  };
  const daysAhead = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d;
  };

  const wo1 = await prisma.workOrder.create({
    data: {
      woNumber: "WO-U2-001",
      productId: p1.id,
      plantId: plantB.id,
      plannedQuantity: 1000,
      status: "IN_PROGRESS",
      plannedStartDate: daysAgo(2),
      plannedEndDate: daysAhead(1),
    }
  });

  await prisma.workOrder.create({
    data: {
      woNumber: "WO-U2-002",
      productId: p1.id,
      plantId: plantB.id,
      plannedQuantity: 500,
      status: "PLANNED",
      plannedStartDate: daysAhead(1),
      plannedEndDate: daysAhead(3),
    }
  });

  // 8. Generate some historical logs for Plant B (recent 5 days)
  const users = await prisma.user.findMany({ take: 1 });
  const opId = users[0]?.id || "unknown";
  
  let shifts = await prisma.shift.findMany({ take: 1 });
  if (shifts.length === 0) {
    shifts = [await prisma.shift.create({ data: { name: "Morning Shift A", startTime: "06:00", endTime: "14:00" } })];
  }
  const shiftId = shifts[0].id;

  const logs = [];
  for (let i = 4; i >= 0; i--) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() - i);
    
    const startTime = new Date(targetDate);
    startTime.setHours(6, 0, 0, 0); 
    const endTime = new Date(targetDate);
    endTime.setHours(14, 0, 0, 0); 

    logs.push({
      workOrderId: wo1.id,
      machineId: mac1.id,
      operatorId: opId,
      shiftId: shiftId,
      goodQuantity: 300 + Math.floor(Math.random() * 50),
      scrapQuantity: Math.floor(Math.random() * 10),
      reworkQuantity: 2,
      startTime,
      endTime,
    });
  }

  await prisma.productionLog.createMany({ data: logs });
  console.log("Plant B Migration and Seeding complete.");
}

main().catch(console.error);
