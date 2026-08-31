import { prisma } from "./prisma";

/**
 * Onboarding S4 sample data — a small, safe demo dataset for a brand-new
 * (empty) database. The full 3000-line seed is run by the CLI/desktop
 * first-run; this is the cloud equivalent: load once, only when the DB is
 * empty. Never touches existing data.
 */
export async function loadSampleDataIfEmpty(): Promise<{
  loaded: boolean;
  counts: Record<string, number>;
}> {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return { loaded: false, counts: {} };
  }

  const counts: Record<string, number> = {};

  // 1. Plant (dynamically provisioned with defaultPlantId setting).
    const plant = await prisma.plant.create({
      data: {
      name: "Manufacturing Complex 1",
      address: "100 Industrial Parkway, MIDC Industrial Area",
    },
  });
  counts.plant = 1;
  await prisma.setting.upsert({
    where: { key: "plantId" },
    update: { value: plant.id },
    create: { key: "plantId", value: plant.id },
  });
  await prisma.setting.upsert({
    where: { key: "defaultPlantId" },
    update: { value: plant.id },
    create: { key: "defaultPlantId", value: plant.id },
  });

  const line = await prisma.productionLine.create({
    data: { name: "Machining & Assembly Line A", plantId: plant.id },
  });
  counts.productionLine = 1;

  // 2. Machines.
  const machines = [
    {
      name: "CNC Milling Center 1",
      code: "CNC-01",
      idealCycleTimeSeconds: 30.0,
    },
    { name: "CNC Lathe 1", code: "CNC-L1", idealCycleTimeSeconds: 45.0 },
    { name: "Hydraulic Press 1", code: "PRS-01", idealCycleTimeSeconds: 20.0 },
  ];
  for (const m of machines) {
    await prisma.machine.create({
      data: {
        ...m,
        lineId: line.id,
        plantId: plant.id,
        status: "RUNNING",
        currentState: "RUNNING",
        iotEnabled: true,
      },
    });
  }
  counts.machines = machines.length;

  // 3. Shifts.
  const shifts = [
    { name: "Day Shift A", startTime: "06:00", endTime: "14:00" },
    { name: "Night Shift B", startTime: "14:00", endTime: "22:00" },
  ];
  for (const s of shifts) await prisma.shift.create({ data: s });
  counts.shifts = shifts.length;

  // 4. Downtime reasons (so the operator terminal can log downtime).
  const reasons = [
    {
      code: "DWN-MECH",
      description: "Mechanical Breakdown",
      category: "MECHANICAL",
      isActive: true,
    },
    {
      code: "DWN-MATL",
      description: "Material Shortage",
      category: "MATERIAL",
      isActive: true,
    },
    {
      code: "DWN-SETUP",
      description: "Changeover / Setup",
      category: "OPERATOR",
      isActive: true,
    },
  ] as const;
  for (const r of reasons) {
    await prisma.downtimeReason.create({
      data: {
        code: r.code,
        description: r.description,
        category: r.category,
        isActive: r.isActive,
      },
    });
  }
  counts.downtimeReasons = reasons.length;

  // 5. Raw materials.
  const materials = [
    {
      sku: "RM-AL-6061",
      name: "Aluminium 6061 Bar",
      unit: "kg",
      unitCost: 320,
    },
    { sku: "RM-CI-250", name: "Cast Iron Ingot", unit: "kg", unitCost: 180 },
  ];
  for (const m of materials) {
    await prisma.rawMaterial.create({
      data: { ...m, plantId: plant.id, currentStock: 1000, minStock: 100 },
    });
  }
  counts.rawMaterials = materials.length;

  // 6. Products.
  const products = [
    {
      sku: "PRD-AL-HOUSING",
      name: "Aluminium Housing",
      targetCycleTimeSeconds: 180,
    },
    {
      sku: "PRD-BRACKET",
      name: "Mounting Bracket",
      targetCycleTimeSeconds: 120,
    },
  ];
  for (const p of products) await prisma.product.create({ data: p });
  counts.products = products.length;

  // 7. One BOM line.
  const housing = await prisma.product.findUnique({
    where: { sku: "PRD-AL-HOUSING" },
  });
  const alum = await prisma.rawMaterial.findUnique({
    where: { sku: "RM-AL-6061" },
  });
  if (housing && alum) {
    await prisma.bomLine.create({
      data: { productId: housing.id, rawMaterialId: alum.id, qtyPerUnit: 1.4 },
    });
    counts.bomLines = 1;
  }

  // 8. One planned work order to explore the shop floor.
  if (housing) {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 5);
    await prisma.workOrder.create({
      data: {
        woNumber: "WO-0001",
        productId: housing.id,
        plantId: plant.id,
        plannedQuantity: 500,
        status: "PLANNED",
        plannedStartDate: start,
        plannedEndDate: end,
        customerName: "Sample Customer",
      },
    });
    counts.workOrders = 1;
  }

  return { loaded: true, counts };
}
