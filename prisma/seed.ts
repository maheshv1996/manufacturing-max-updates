import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { scryptSync, randomBytes } from "crypto";
import { DEFAULT_COA } from "../src/lib/glEngine";
import { toPaiseRow, toPaise } from "../src/lib/money";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

async function main() {
  console.log("Cleaning old database records...");
  await prisma.fiveSAuditScore.deleteMany({});
  await prisma.fiveSAudit.deleteMany({});
  await prisma.fiveSItem.deleteMany({});
  await prisma.routineProgress.deleteMany({});
  await prisma.routineStep.deleteMany({});
  await prisma.attendanceLog.deleteMany({});
  await prisma.assignment.deleteMany({});
  await (prisma as any).safetyIncident.deleteMany({});
  await (prisma as any).idea.deleteMany({});
  await (prisma as any).tool.deleteMany({});
  await (prisma as any).maintenanceJob.deleteMany({});
  await (prisma as any).pMRule.deleteMany({});
  await (prisma as any).maintenanceTool.deleteMany({});
  await (prisma as any).reworkOrder.deleteMany({});
  await (prisma as any).override?.deleteMany({});
  await (prisma as any).shiftCount?.deleteMany({});
  await (prisma as any).invoice?.deleteMany({});
  await (prisma as any).dispatchRecord?.deleteMany({});
  await (prisma as any).quotationLine?.deleteMany({});
  await (prisma as any).quotation?.deleteMany({});
  await prisma.movementLog.deleteMany({});
  await prisma.qualityInspection.deleteMany({});
  await prisma.defectCode.deleteMany({});
  await prisma.downtimeLog.deleteMany({});
  await (prisma as any).goodsReceiptNote.deleteMany({});
  await (prisma as any).supplierInvoice.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.inventoryTransaction.deleteMany({});
  await (prisma as any).document.deleteMany({});
  await prisma.bomLine.deleteMany({});
  await prisma.rawMaterial.deleteMany({});
  await prisma.supplierPayment.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.downtimeReason.deleteMany({});
  await prisma.productionLog.deleteMany({});
  // Child tables that FK-restrict WorkOrder/Product deletion must be wiped first.
  await (prisma as any).dataPackage.deleteMany({});
  await (prisma as any).holdPointSignoff.deleteMany({});
  await (prisma as any).testCampaign.deleteMany({});
  await (prisma as any).customerComplaint.deleteMany({});
  await (prisma as any).capaAction.deleteMany({});
  await (prisma as any).eightDReport.deleteMany({});
  await (prisma as any).ppapElement.deleteMany({});
  await (prisma as any).ppapSubmission.deleteMany({});
  await (prisma as any).controlPlan.deleteMany({});
  await (prisma as any).gageRnrStudy.deleteMany({});
  await (prisma as any).ncrReport.deleteMany({});
  await (prisma as any).scrapQuarantine.deleteMany({});
  await (prisma as any).serialUnit.deleteMany({});
  await (prisma as any).faiReport.deleteMany({});
  await (prisma as any).eco.deleteMany({});
  await (prisma as any).escalation.deleteMany({});
  await prisma.workOrder.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.routingStep.deleteMany({});
  await prisma.operation.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.shiftHandover.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.machine.deleteMany({});
  await prisma.productionLine.deleteMany({});
  await prisma.plant.deleteMany();

  console.log("1. Creating Plant & Production Lines...");
  const plant = await prisma.plant.create({
    data: {
      name: "Apex Manufacturing Complex 1",
      address: "100 Industrial Parkway, Detroit, MI 48201",
    },
  });

  const lineA = await prisma.productionLine.create({
    data: {
      name: "Machining & Assembly Line A",
      plantId: plant.id,
    },
  });

  const lineB = await prisma.productionLine.create({
    data: {
      name: "Plastics & Fabrication Line B",
      plantId: plant.id,
    },
  });

  console.log("2. Creating 5 Machines...");
  const cnc1 = await prisma.machine.create({
    data: {
      name: "CNC Milling Center 1",
      code: "CNC-01",
      lineId: lineA.id, plantId: plant.id, idealCycleTimeSeconds: 30.0,
      status: "RUNNING",
      currentState: "RUNNING",
      iotEnabled: true,
      stationName: "CNC Bay",
    },
  });

  const imm2 = await prisma.machine.create({
    data: {
      name: "Injection Molding Machine 2",
      code: "IMM-02",
      lineId: lineB.id, plantId: plant.id, idealCycleTimeSeconds: 15.0,
      status: "RUNNING",
      currentState: "RUNNING",
      iotEnabled: true,
      stationName: "Milling Bay",
    },
  });

  const rob3 = await prisma.machine.create({
    data: {
      name: "Robotic Welding Cell 3",
      code: "ROB-03",
      lineId: lineA.id, plantId: plant.id, idealCycleTimeSeconds: 45.0,
      status: "RUNNING",
      currentState: "RUNNING",
      iotEnabled: true,
      stationName: "QC Station",
    },
  });

  const lsr4 = await prisma.machine.create({
    data: {
      name: "Laser Cutter System 4",
      code: "LSR-04",
      lineId: lineA.id, plantId: plant.id, idealCycleTimeSeconds: 20.0,
      status: "MAINTENANCE",
      stationName: "Cutting Bay",
    },
  });

  const pkg5 = await prisma.machine.create({
    data: {
      name: "Automated Packaging Cell 5",
      code: "PKG-05",
      lineId: lineB.id, plantId: plant.id, idealCycleTimeSeconds: 10.0,
      status: "IDLE",
      stationName: "Packing Bay",
    },
  });

  console.log("3. Creating 3 Products...");
  const p1 = await prisma.product.create({
    data: {
      sku: "PRD-AL-HOUSING",
      name: "Aluminum Gear Housing",
      description: "Precision CNC milled aerospace grade aluminum housing",
      targetCycleTimeSeconds: 30.0,
      materialCostPerUnit: 120.0,
      sellingPricePerUnit: 450.0,
    },
  });

  const p2 = await prisma.product.create({
    data: {
      sku: "PRD-POLY-CASING",
      name: "Polymer Control Enclosure",
      description: "High-impact injection molded polypropylene casing",
      targetCycleTimeSeconds: 15.0,
      materialCostPerUnit: 45.0,
      sellingPricePerUnit: 180.0,
    },
  });

  const p3 = await prisma.product.create({
    data: {
      sku: "PRD-WELD-FRAME",
      name: "Heavy Steel Chassis Frame",
      description: "Robotic MIG welded structural steel automotive chassis",
      targetCycleTimeSeconds: 45.0,
      materialCostPerUnit: 350.0,
      sellingPricePerUnit: 1100.0,
    },
  });

  console.log("4. Creating 5 Shifts...");
  const shift1 = await prisma.shift.create({
    data: { name: "Morning Shift A", startTime: "06:00", endTime: "14:00" },
  });
  const shift2 = await prisma.shift.create({
    data: { name: "Afternoon Shift B", startTime: "14:00", endTime: "22:00" },
  });
  const shift3 = await prisma.shift.create({
    data: { name: "Night Shift C", startTime: "22:00", endTime: "06:00" },
  });
  await prisma.shift.create({
    data: { name: "Weekend Day Shift", startTime: "07:00", endTime: "19:00" },
  });
  await prisma.shift.create({
    data: { name: "Weekend Night Shift", startTime: "19:00", endTime: "07:00" },
  });

  console.log("5. Creating Roles & Users...");
  const ADMIN_PERMS = ['ops.view', 'ops.edit', 'supply.view', 'supply.edit', 'commercial.view', 'commercial.edit', 'people.view', 'people.edit', 'system.view', 'system.edit', 'quality.view', 'quality.edit', 'metrology.view', 'metrology.edit', 'engineering.view', 'engineering.edit', 'finance.view', 'finance.edit', 'ehs.view', 'ehs.edit', 'maintenance.view', 'maintenance.edit', 'projects.view', 'projects.edit', 'exec.view', 'exec.edit', 'users.manage', 'terminal.use', 'reports.print', 'records.edit', 'kpi.override', 'audit.view', 'ops.approve', 'supply.approve', 'commercial.approve', 'people.approve', 'system.approve', 'quality.approve', 'metrology.approve', 'engineering.approve', 'finance.approve', 'ehs.approve', 'maintenance.approve', 'projects.approve', 'exec.approve'];
  // Supervisors are department heads — they can approve in the departments they operate: shop floor + people.
  const SUPERVISOR_PERMS = ['ops.view', 'ops.edit', 'supply.view', 'commercial.view', 'people.view', 'system.view', 'quality.view', 'metrology.view', 'engineering.view', 'finance.view', 'ehs.view', 'maintenance.view', 'projects.view', 'exec.view', 'reports.print', 'terminal.use', 'ops.approve', 'people.approve'];
  const OPERATOR_PERMS = ['terminal.use'];

  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: { permissions: ADMIN_PERMS },
    create: { name: "ADMIN", description: "Full system access", permissions: ADMIN_PERMS, isSystem: true },
  });
  const supervisorRole = await prisma.role.upsert({
    where: { name: "SUPERVISOR" },
    update: { permissions: SUPERVISOR_PERMS },
    create: { name: "SUPERVISOR", description: "Shift supervisor with operational control", permissions: SUPERVISOR_PERMS, isSystem: true },
  });
  const operatorRole = await prisma.role.upsert({
    where: { name: "OPERATOR" },
    update: { permissions: OPERATOR_PERMS },
    create: { name: "OPERATOR", description: "Shop-floor terminal user", permissions: OPERATOR_PERMS, isSystem: true },
  });

  const adminHash = hashPassword("factory123");
  await prisma.user.create({
    data: {
      name: "System Admin",
      username: "admin",
      employeeNumber: "1001", // badge login
      email: "admin@manufacturingmax.com",
      passwordHash: adminHash,
      lastSetPassword: "factory123",
      passwordChangedAt: new Date(),
      roleId: adminRole.id,
      isOwner: true,
      level: "MANAGER", // department-head level: sees Approvals + Team KPIs + Budget on hubs
    },
  });

  await prisma.user.create({
    data: {
      name: "Sarah Jenkins",
      username: "sjenkins",
      employeeNumber: "1002",
      email: "sjenkins@manufacturingmax.com",
      roleId: supervisorRole.id,
      level: "MANAGER", // seeded department head
    },
  });

  const operatorHash = hashPassword("operator123");
  const op1 = await prisma.user.create({
    data: {
      name: "Mike Ross",
      username: "operator",
      employeeNumber: "2001",
      email: "mross@manufacturingmax.com",
      passwordHash: operatorHash,
      lastSetPassword: "operator123",
      passwordChangedAt: new Date(),
      roleId: operatorRole.id,
    },
  });

  const op2 = await prisma.user.create({
    data: {
      name: "John Doe",
      username: "jdoe",
      employeeNumber: "2002",
      email: "jdoe@manufacturingmax.com",
      roleId: operatorRole.id,
    },
  });

  const op3 = await prisma.user.create({
    data: {
      name: "Alex Vance",
      username: "avance",
      employeeNumber: "2003",
      email: "avance@manufacturingmax.com",
      roleId: operatorRole.id,
    },
  });

  const op4 = await prisma.user.create({
    data: {
      name: "Priya Nair",
      username: "pnair",
      employeeNumber: "2004",
      email: "pnair@manufacturingmax.com",
      roleId: operatorRole.id,
    },
  });

  const op5 = await prisma.user.create({
    data: {
      name: "Arun Kumar",
      username: "akumar",
      employeeNumber: "2005",
      email: "akumar@manufacturingmax.com",
      roleId: operatorRole.id,
    },
  });

  // P8 — skill-based job queue: each operator is certified on their primary
  // machine so the terminal's "My Queue" shows matching planned WOs out of the box.
  const certData = [
    { user: op1, machine: cnc1 },
    { user: op2, machine: imm2 },
    { user: op3, machine: rob3 },
    { user: op4, machine: lsr4 },
    { user: op5, machine: pkg5 },
  ];
  for (const c of certData) {
    await prisma.certification.create({
      data: {
        userId: c.user.id,
        machineId: c.machine.id,
        certifiedBy: "System Admin",
        validFrom: new Date(),
        isActive: true,
        notes: "Initial certification on hire (P8 skill queue)",
      },
    });
  }

  console.log("6. Creating Downtime Reasons & Defect Codes...");
  const r1 = await prisma.downtimeReason.create({
    data: {
      code: "D-MECH-01",
      description: "Spindle / Motor Thermal Overheat",
      category: "MECHANICAL",
    },
  });
  const r2 = await prisma.downtimeReason.create({
    data: {
      code: "D-ELEC-01",
      description: "Sensor Fault / Breaker Trip",
      category: "ELECTRICAL",
    },
  });
  const r3 = await prisma.downtimeReason.create({
    data: {
      code: "D-MAT-01",
      description: "Raw Material Depletion",
      category: "MATERIAL",
    },
  });
  const r4 = await prisma.downtimeReason.create({
    data: {
      code: "D-QUAL-01",
      description: "Quality Tolerance Alert Hold",
      category: "QUALITY",
    },
  });
  const r5 = await prisma.downtimeReason.create({
    data: {
      code: "D-OP-01",
      description: "Shift Handover / Tool Setup",
      category: "OPERATOR",
    },
  });

  await prisma.defectCode.create({
    data: {
      code: "DEF-SURF",
      description: "Surface Scratch / Dent",
      severity: "LOW",
    },
  });
  await prisma.defectCode.create({
    data: {
      code: "DEF-DIM",
      description: "Dimensional Out-of-Spec",
      severity: "HIGH",
    },
  });
  await prisma.defectCode.create({
    data: {
      code: "DEF-POR",
      description: "Weld Seam Porosity",
      severity: "CRITICAL",
    },
  });

  console.log("7. Creating 10 Work Orders...");
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

  const woData = [
    {
      woNumber: "WO-2026-001",
      productId: p1.id,
      plannedQuantity: 1000,
      status: "IN_PROGRESS" as const,
      plannedStartDate: daysAgo(2),
      plannedEndDate: daysAhead(1),
      customerName: "Boeing Defense & Space",
      customerEmail: "procurement@boeing.com",
      promisedDispatchDate: daysAhead(5),
      trackingToken: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      quotedPrice: 480000.0,
    },
    {
      woNumber: "WO-2026-002",
      productId: p2.id,
      plannedQuantity: 2500,
      status: "IN_PROGRESS" as const,
      plannedStartDate: daysAgo(3),
      plannedEndDate: daysAhead(2),
      customerName: "Tesla Gigafactory Texas",
      customerEmail: "supplychain@tesla.com",
      promisedDispatchDate: daysAhead(4),
      trackingToken: "b2c3d4e5-f6a7-8901-bcde-f23456789012",
      quotedPrice: 520000.0,
    },
    {
      woNumber: "WO-2026-003",
      productId: p3.id,
      plannedQuantity: 800,
      status: "IN_PROGRESS" as const,
      plannedStartDate: daysAgo(1),
      plannedEndDate: daysAhead(3),
      customerName: "Caterpillar Machinery",
      customerEmail: "orders@cat.com",
      promisedDispatchDate: daysAhead(8),
      trackingToken: "c3d4e5f6-a7b8-9012-cdef-345678901234",
      quotedPrice: 45000.0, // Intentionally Loss-Making! (Total Cost ~71,125 > Revenue 45,000 -> Loss -26,125)
    },
    {
      woNumber: "WO-2026-004",
      productId: p1.id,
      plannedQuantity: 1500,
      status: "COMPLETED" as const,
      plannedStartDate: daysAgo(7),
      plannedEndDate: daysAgo(3),
      customerName: "Lockheed Martin Corp",
      customerEmail: "logistics@lockheed.com",
      promisedDispatchDate: daysAgo(2),
      trackingToken: "d4e5f6a7-b8c9-0123-def0-456789012345",
      quotedPrice: 720000.0,
    },
    {
      woNumber: "WO-2026-005",
      productId: p2.id,
      plannedQuantity: 3000,
      status: "COMPLETED" as const,
      plannedStartDate: daysAgo(8),
      plannedEndDate: daysAgo(4),
      customerName: "Apple Hardware Operations",
      customerEmail: "ops@apple.com",
      promisedDispatchDate: daysAgo(3),
      trackingToken: "e5f6a7b8-c9d0-1234-ef01-567890123456",
      quotedPrice: 590000.0,
    },
    {
      woNumber: "WO-2026-006",
      productId: p3.id,
      plannedQuantity: 600,
      status: "COMPLETED" as const,
      plannedStartDate: daysAgo(5),
      plannedEndDate: daysAgo(2),
      customerName: "General Electric Aviation",
      customerEmail: "parts@ge.com",
      promisedDispatchDate: daysAgo(1),
      trackingToken: "f6a7b8c9-d0e1-2345-f012-678901234567",
      quotedPrice: 780000.0,
    },
    {
      woNumber: "WO-2026-007",
      productId: p1.id,
      plannedQuantity: 1200,
      status: "PLANNED" as const,
      plannedStartDate: daysAhead(2),
      plannedEndDate: daysAhead(5),
      customerName: "Ford Motor Assembly",
      customerEmail: "supply@ford.com",
      promisedDispatchDate: daysAhead(10),
      trackingToken: "a7b8c9d0-e1f2-3456-0123-789012345678",
      quotedPrice: 580000.0,
    },
    {
      woNumber: "WO-2026-008",
      productId: p2.id,
      plannedQuantity: 2000,
      status: "PLANNED" as const,
      plannedStartDate: daysAhead(3),
      plannedEndDate: daysAhead(6),
      customerName: "Rivian Automotive",
      customerEmail: "purchasing@rivian.com",
      promisedDispatchDate: daysAhead(12),
      trackingToken: "b8c9d0e1-f2a3-4567-1234-890123456789",
      quotedPrice: 420000.0,
    },
    {
      woNumber: "WO-2026-009",
      productId: p3.id,
      plannedQuantity: 900,
      status: "ON_HOLD" as const,
      plannedStartDate: daysAgo(1),
      plannedEndDate: daysAhead(4),
      customerName: "Siemens Energy",
      customerEmail: "tracking@siemens.com",
      promisedDispatchDate: daysAhead(6),
      trackingToken: "c9d0e1f2-a3b4-5678-2345-901234567890",
      quotedPrice: 50000.0, // Intentionally Loss-Making! (Total Cost ~80,014.5 > Revenue 50,000 -> Loss -30,014.5)
    },
    {
      woNumber: "WO-2026-010",
      productId: p1.id,
      plannedQuantity: 1800,
      status: "PLANNED" as const,
      trackingMode: "SERIAL" as const, // Aerospace — every unit serial-tracked; inspections require a calibrated tool
      plannedStartDate: daysAhead(4),
      plannedEndDate: daysAhead(7),
      customerName: "Honeywell Aerospace",
      customerEmail: "orders@honeywell.com",
      promisedDispatchDate: daysAhead(14),
      trackingToken: "d0e1f2a3-b4c5-6789-3456-012345678901",
      quotedPrice: 890000.0,
    },
  ];

  const createdWorkOrders = [];
  for (const item of woData) {
    const wo = await prisma.workOrder.create({ data: item });
    createdWorkOrders.push(wo);
  }

  console.log("7b. Creating Operations...");
  const opCutting = await prisma.operation.create({ data: { code: "OP10", name: "Cutting", defaultCycleTimeSeconds: 45 } });
  const opMilling = await prisma.operation.create({ data: { code: "OP20", name: "Milling", defaultCycleTimeSeconds: 30 } });
  const opQC = await prisma.operation.create({ data: { code: "OP30", name: "QC Inspection", defaultCycleTimeSeconds: 20 } });
  const opPacking = await prisma.operation.create({ data: { code: "OP40", name: "Packing", defaultCycleTimeSeconds: 10 } });

  console.log("7c. Creating Routing Steps for each product...");
  const routingTemplate = [
    {
      seq: 1,
      operationId: opCutting.id,
      machineId: lsr4.id,
      stationName: "Cutting Bay",
      standardCycleTimeSeconds: 45,
      setupTimeMin: 20,
      cycleTimeMin: 0.75,
      instructions: "Op 10: Load raw aluminum/steel stock. Calibrate optical laser alignment lens prior to execution.",
    },
    {
      seq: 2,
      operationId: opMilling.id,
      machineId: cnc1.id,
      stationName: "CNC Bay",
      standardCycleTimeSeconds: 30,
      setupTimeMin: 30,
      cycleTimeMin: 1.5,
      instructions: "Op 20: Clamp blank in Vice 01. Run 3-axis CNC facing routine. Ensure synthetic coolant pressure > 40 PSI.",
    },
    {
      seq: 3,
      operationId: opQC.id,
      machineId: rob3.id,
      stationName: "QC Station",
      standardCycleTimeSeconds: 20,
      setupTimeMin: 10,
      cycleTimeMin: 0.5,
      instructions: "Op 30: Perform 100% CMM dimensional probe verification. Record surface finish Ra < 0.8 µm.",
    },
    {
      seq: 4,
      operationId: opPacking.id,
      machineId: pkg5.id,
      stationName: "Packing Bay",
      standardCycleTimeSeconds: 10,
      setupTimeMin: 10,
      cycleTimeMin: 0.25,
      instructions: "Op 40: Spray anti-corrosion barrier, heat seal in anti-static polybag, affix WO barcode traveler tag.",
    },
  ];

  for (const product of [p1, p2, p3]) {
    for (const step of routingTemplate) {
      await prisma.routingStep.create({ data: { productId: product.id, ...step } });
    }
  }

  console.log("7c-2. Creating Sample Projects and linking Work Orders...");
  const proj1 = await prisma.project.create({
    data: {
      name: "Titan Aerospace Gearbox Assembly",
      code: "PRJ-2026-AERO",
      clientName: "Boeing Defense & Space",
      targetCompletionDate: daysAhead(10),
      status: "IN_PROGRESS",
      completionPercentage: 58.3,
      description: "Multi-component precision aluminum gear housing and internal shaft sub-assemblies.",
    },
  });

  const proj2 = await prisma.project.create({
    data: {
      name: "NexGen Battery Controller Enclosures",
      code: "PRJ-2026-TESLA",
      clientName: "Tesla Gigafactory Texas",
      targetCompletionDate: daysAhead(4),
      status: "IN_PROGRESS",
      completionPercentage: 33.3,
      description: "High-impact polymer enclosures with laser-cut mounting brackets.",
    },
  });

  const proj3 = await prisma.project.create({
    data: {
      name: "Heavy Mining Rig Frame Weldment",
      code: "PRJ-2026-CAT",
      clientName: "Caterpillar Heavy Machinery",
      targetCompletionDate: daysAhead(18),
      status: "OPEN",
      completionPercentage: 0.0,
      description: "Structural MIG welded heavy chassis assemblies with multi-op milling.",
    },
  });

  // Link work orders to projects
  // Proj 1: WO-001, WO-002, WO-003
  await prisma.workOrder.update({ where: { id: createdWorkOrders[0].id }, data: { projectId: proj1.id } });
  await prisma.workOrder.update({ where: { id: createdWorkOrders[1].id }, data: { projectId: proj1.id } });
  await prisma.workOrder.update({ where: { id: createdWorkOrders[2].id }, data: { projectId: proj1.id } });

  // Proj 2: WO-004, WO-005, WO-009 (ON_HOLD bottleneck)
  await prisma.workOrder.update({ where: { id: createdWorkOrders[3].id }, data: { projectId: proj2.id } });
  await prisma.workOrder.update({ where: { id: createdWorkOrders[4].id }, data: { projectId: proj2.id } });
  await prisma.workOrder.update({ where: { id: createdWorkOrders[8].id }, data: { projectId: proj2.id } });

  // Proj 3: WO-006, WO-007, WO-008
  await prisma.workOrder.update({ where: { id: createdWorkOrders[5].id }, data: { projectId: proj3.id } });
  await prisma.workOrder.update({ where: { id: createdWorkOrders[6].id }, data: { projectId: proj3.id } });
  await prisma.workOrder.update({ where: { id: createdWorkOrders[7].id }, data: { projectId: proj3.id } });

  console.log("7d. Setting currentSeq on active Work Orders...");
  // WO-001 at Milling (seq 2), WO-002 at QC (seq 3), WO-003 at Cutting (seq 1)
  await prisma.workOrder.update({ where: { id: createdWorkOrders[0].id }, data: { currentSeq: 2 } });
  await prisma.workOrder.update({ where: { id: createdWorkOrders[1].id }, data: { currentSeq: 3 } });
  await prisma.workOrder.update({ where: { id: createdWorkOrders[2].id }, data: { currentSeq: 1 } });
  // WO-010 (Honeywell Aerospace, SERIAL) parked at Packing (seq 4) so dispatching to
  // seq 5 (NDT Outsourced, EXPIRED vendor) demonstrates the Nadcap vendor block.
  if (createdWorkOrders[9]) {
    await prisma.workOrder.update({ where: { id: createdWorkOrders[9].id }, data: { currentSeq: 4 } });
  }

  console.log("7e. Creating sample Movement Logs...");
  await prisma.movementLog.create({ data: { workOrderId: createdWorkOrders[0].id, fromStation: "Cutting Bay", toStation: "CNC Bay", quantity: 500, movedByName: "Mike Ross" } });
  await prisma.movementLog.create({ data: { workOrderId: createdWorkOrders[1].id, fromStation: "Cutting Bay", toStation: "CNC Bay", quantity: 1200, movedByName: "John Doe" } });
  await prisma.movementLog.create({ data: { workOrderId: createdWorkOrders[1].id, fromStation: "CNC Bay", toStation: "QC Station", quantity: 1000, movedByName: "John Doe" } });
  await prisma.movementLog.create({ data: { workOrderId: createdWorkOrders[0].id, fromStation: "Cutting Bay", toStation: "CNC Bay", quantity: 300, movedByName: "Alex Vance" } });
  await prisma.movementLog.create({ data: { workOrderId: createdWorkOrders[2].id, fromStation: "Receiving", toStation: "Cutting Bay", quantity: 800, movedByName: "Mike Ross" } });

  console.log("7f. Seeding sample revision-controlled Drawings & SOPs...");
  const svg1 = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" style="background:#0f172a">
  <rect width="600" height="400" fill="#0f172a"/>
  <rect x="50" y="50" width="500" height="300" fill="none" stroke="#38bdf8" stroke-width="4" stroke-dasharray="10,5"/>
  <circle cx="200" cy="200" r="50" fill="none" stroke="#f43f5e" stroke-width="4"/>
  <circle cx="400" cy="200" r="50" fill="none" stroke="#f43f5e" stroke-width="4"/>
  <text x="300" y="100" fill="#f8fafc" font-family="monospace" font-size="20" font-weight="bold" text-anchor="middle">ALUMINUM GEAR HOUSING SPEC</text>
  <text x="300" y="205" fill="#38bdf8" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">REV 1 - PRIMARY OPERATIONAL DRAWING</text>
  <text x="300" y="310" fill="#94a3b8" font-family="monospace" font-size="13" text-anchor="middle">TOLERANCE: +/- 0.005mm | MATERIAL: AL-6061-T6</text>
</svg>`;

  const svg2 = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" style="background:#1e1b4b">
  <rect width="600" height="400" fill="#1e1b4b"/>
  <polygon points="300,50 520,330 80,330" fill="none" stroke="#818cf8" stroke-width="4"/>
  <circle cx="300" cy="210" r="55" fill="#312e81" stroke="#a7f3d0" stroke-width="3"/>
  <text x="300" y="110" fill="#f8fafc" font-family="monospace" font-size="18" font-weight="bold" text-anchor="middle">POLYMER CONTROL ENCLOSURE SOP</text>
  <text x="300" y="215" fill="#a7f3d0" font-family="sans-serif" font-size="15" font-weight="bold" text-anchor="middle">REV 1 - MOLDING &amp; ASSEMBLY GUIDE</text>
  <text x="300" y="300" fill="#cbd5e1" font-family="monospace" font-size="12" text-anchor="middle">INJECTION TEMP: 230C | COOLING: 45 SEC</text>
</svg>`;

  const svg3 = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" style="background:#022c22">
  <rect width="600" height="400" fill="#022c22"/>
  <line x1="50" y1="200" x2="550" y2="200" stroke="#34d399" stroke-width="6"/>
  <line x1="300" y1="50" x2="300" y2="350" stroke="#34d399" stroke-width="6"/>
  <rect x="180" y="120" width="240" height="160" rx="12" fill="none" stroke="#fbbf24" stroke-width="4" stroke-dasharray="6,6"/>
  <text x="300" y="90" fill="#f8fafc" font-family="monospace" font-size="18" font-weight="bold" text-anchor="middle">HEAVY STEEL CHASSIS WELDING SOP</text>
  <text x="300" y="205" fill="#fbbf24" font-family="sans-serif" font-size="15" font-weight="bold" text-anchor="middle">REV 1 - MIG WELD JOINT DETAILS</text>
  <text x="300" y="320" fill="#a7f3d0" font-family="monospace" font-size="12" text-anchor="middle">PASSES: 3 | WIRE: ER70S-6 1.2mm</text>
</svg>`;

  if (p1 && p2 && p3) {
    const buf1 = Buffer.from(svg1, "utf-8");
    const buf2 = Buffer.from(svg2, "utf-8");
    const buf3 = Buffer.from(svg3, "utf-8");

    await (prisma as any).document.create({
      data: {
        title: "Gear Housing Milling & Drill Blueprint",
        productId: p1.id,
        operationId: opMilling.id,
        version: 1,
        mimeType: "image/svg+xml",
        fileData: buf1,
        sizeKb: Math.round(buf1.length / 1024) || 1,
        status: "CURRENT",
        uploadedBy: "Engineering Admin",
        notes: "Primary milling drawing for Op 20. Ensure coolant flow is active before machining.",
      },
    });

    await (prisma as any).document.create({
      data: {
        title: "Polymer Enclosure Assembly SOP",
        productId: p2.id,
        operationId: null,
        version: 1,
        mimeType: "image/svg+xml",
        fileData: buf2,
        sizeKb: Math.round(buf2.length / 1024) || 1,
        status: "CURRENT",
        uploadedBy: "Quality Admin",
        notes: "Product-level assembly guide and temperature parameter checklist.",
      },
    });

    await (prisma as any).document.create({
      data: {
        title: "Chassis Welding Joint Blueprint",
        productId: p3.id,
        operationId: opCutting.id,
        version: 1,
        mimeType: "image/svg+xml",
        fileData: buf3,
        sizeKb: Math.round(buf3.length / 1024) || 1,
        status: "CURRENT",
        uploadedBy: "Process Engineer",
        notes: "MIG welding seam specifications and dimensional tolerances.",
      },
    });
  }

  console.log("8. Generating 365 Days of Historical Logs...");
  const machines = [cnc1, imm2, rob3, lsr4, pkg5];
  const operators = [op1, op2, op3];
  const reasons = [r1, r2, r3, r4, r5];
  const activeWO1 = createdWorkOrders[0];

  const historicalProductionLogs = [];
  const historicalDowntimeLogs = [];

  for (let i = 365; i >= 0; i--) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() - i);
    
    // Simulate a "bad week" between 60 and 67 days ago
    const isBadWeek = i >= 60 && i <= 67;

    for (const machine of machines) {
      // Base shift duration (8 hours = 480 mins)
      const shiftDurationMins = 480;
      
      const startTime = new Date(targetDate);
      startTime.setHours(6, 0, 0, 0); // 6 AM
      const endTime = new Date(targetDate);
      endTime.setHours(14, 0, 0, 0); // 2 PM

      // Determine downtime
      let downtimeMins = Math.floor(Math.random() * 30); // 0-30 mins normal
      if (isBadWeek && (machine.id === cnc1.id || machine.id === imm2.id)) {
        downtimeMins += 60 + Math.floor(Math.random() * 120); // bad week = 1-3 hours down
      }
      
      // Calculate production based on uptime
      const uptimeMins = shiftDurationMins - downtimeMins;
      const uptimeSeconds = uptimeMins * 60;
      
      const idealCycle = machine.idealCycleTimeSeconds;
      const theoreticalMaxUnits = uptimeSeconds / idealCycle;
      
      // Performance factor (80-95% usually)
      const performanceFactor = isBadWeek ? 0.7 + (Math.random() * 0.1) : 0.8 + (Math.random() * 0.15);
      const actualTotalUnits = Math.floor(theoreticalMaxUnits * performanceFactor);
      
      // Quality factor (95-99% usually)
      const qualityFactor = isBadWeek ? 0.85 + (Math.random() * 0.1) : 0.95 + (Math.random() * 0.04);
      const goodUnits = Math.floor(actualTotalUnits * qualityFactor);
      const scrap = actualTotalUnits - goodUnits;

      historicalProductionLogs.push({
        workOrderId: activeWO1.id, // Just linking all to one WO for simplicity in seed
        machineId: machine.id,
        operatorId: operators[Math.floor(Math.random() * operators.length)].id,
        shiftId: shift1.id,
        goodQuantity: goodUnits,
        scrapQuantity: scrap,
        reworkQuantity: Math.floor(scrap * 0.2), // 20% of scrap is reworkable
        startTime,
        endTime,
      });

      if (downtimeMins > 0) {
        historicalDowntimeLogs.push({
          machineId: machine.id,
          workOrderId: activeWO1.id,
          reasonId: reasons[Math.floor(Math.random() * reasons.length)].id,
          startTime,
          endTime: new Date(startTime.getTime() + downtimeMins * 60 * 1000),
          durationMinutes: downtimeMins,
          notes: isBadWeek ? "Major failure during bad week" : "Routine stop",
        });
      }
    }
  }

  // Insert in chunks to avoid blowing up the query size
  console.log(`Inserting ${historicalProductionLogs.length} production logs...`);
  const chunkSize = 1000;
  for (let i = 0; i < historicalProductionLogs.length; i += chunkSize) {
    await prisma.productionLog.createMany({
      data: historicalProductionLogs.slice(i, i + chunkSize),
    });
  }

  console.log(`Inserting ${historicalDowntimeLogs.length} downtime logs...`);
  for (let i = 0; i < historicalDowntimeLogs.length; i += chunkSize) {
    await prisma.downtimeLog.createMany({
      data: historicalDowntimeLogs.slice(i, i + chunkSize),
    });
  }

  console.log("8. Creating Shift Handovers...");
  const handovers = [];
  const noteTypes = [
    { prod: "Ran smoothly. Hit targets.", down: "Minor tool change on CNC-01 (15m).", safety: "All clear.", action: "Check coolant levels on CNC-02." },
    { prod: "Struggled with tolerances early on, recovered.", down: "Spindle overheat on CNC-03, lost 45m.", safety: "Spill near assembly line, cleaned up.", action: "Maintenance needs to verify spindle temp sensor." },
    { prod: "Great shift, exceeded target.", down: "No major downtime.", safety: "All clear.", action: "Keep it up." },
    { prod: "Material shortage delayed start by 30m.", down: "Waiting on materials.", safety: "Forklift near miss reported.", action: "Follow up on incident report." },
    { prod: "Steady production, no major issues.", down: "Routine maintenance completed.", safety: "Safety briefing completed.", action: "None." },
    { prod: "Poor quality yields on Assembly.", down: "Frequent jams on Assembly line.", safety: "All clear.", action: "Engineering to review Assembly calibration." }
  ];

  for (let i = 0; i < 6; i++) {
    handovers.push({
      date: daysAgo(i),
      shiftId: [shift1.id, shift2.id, shift3.id][i % 3],
      authorName: operators[i % operators.length].name,
      machineId: i % 2 === 0 ? null : machines[i % machines.length].id, // Mix of plant-wide and machine-specific
      productionNotes: noteTypes[i].prod,
      downtimeNotes: noteTypes[i].down,
      safetyNotes: noteTypes[i].safety,
      nextShiftActions: noteTypes[i].action,
    });
  }

  await prisma.shiftHandover.createMany({
    data: handovers,
  });

  console.log("9. Creating Machine Operator Assignments...");
  // Create assignments across machines and shifts
  // Machines: cnc1, imm2, rob3, lsr4, pkg5
  // Operators: op1 (Mike Ross), op2 (John Doe), op3 (Alex Vance)
  // Shifts: shift1 (Morning A), shift2 (Afternoon B), shift3 (Night C)
  const assignmentsData = [
    // CNC Milling Center 1
    { machineId: cnc1.id, operatorId: op1.id, shiftId: shift1.id, status: "ACTIVE" as const },
    { machineId: cnc1.id, operatorId: op2.id, shiftId: shift2.id, status: "ACTIVE" as const },
    { machineId: cnc1.id, operatorId: op3.id, shiftId: shift3.id, status: "ACTIVE" as const },

    // Injection Molding Machine 2
    { machineId: imm2.id, operatorId: op2.id, shiftId: shift1.id, status: "ACTIVE" as const },
    { machineId: imm2.id, operatorId: op3.id, shiftId: shift2.id, status: "ACTIVE" as const },
    { machineId: imm2.id, operatorId: op1.id, shiftId: shift3.id, status: "ACTIVE" as const },

    // Robotic Welding Cell 3
    { machineId: rob3.id, operatorId: op3.id, shiftId: shift1.id, status: "ACTIVE" as const },
    { machineId: rob3.id, operatorId: op1.id, shiftId: shift2.id, status: "ACTIVE" as const },

    // Laser Cutter System 4
    { machineId: lsr4.id, operatorId: op1.id, shiftId: shift1.id, status: "ACTIVE" as const },
    { machineId: lsr4.id, operatorId: op2.id, shiftId: shift3.id, status: "ACTIVE" as const },

    // Automated Packaging Cell 5
    { machineId: pkg5.id, operatorId: op2.id, shiftId: shift1.id, status: "ACTIVE" as const },
    { machineId: pkg5.id, operatorId: op3.id, shiftId: shift2.id, status: "ACTIVE" as const },
  ];

  for (const a of assignmentsData) {
    await prisma.assignment.create({ data: a });
  }

  console.log("10. Setting Grace Minutes & Creating 30 Days of Attendance Logs...");
  await prisma.setting.upsert({
    where: { key: "attendance_grace_minutes" },
    update: { value: "10" },
    create: { key: "attendance_grace_minutes", value: "10" },
  });

  const attendanceEntries: any[] = [];
  const operatorsList = [op1, op2, op3];
  const shiftList = [shift1, shift2, shift3];

  for (let d = 0; d < 30; d++) {
    const dayDate = daysAgo(d);
    
    operatorsList.forEach((op, opIdx) => {
      // Simulate absent day (approx 1 in 10 days)
      if ((d + opIdx) % 10 === 0 && d !== 0) return;

      const shift = shiftList[(d + opIdx) % shiftList.length];
      const [startH, startM] = shift.startTime.split(":").map(Number);
      const [endH, endM] = shift.endTime.split(":").map(Number);

      const clockInDate = new Date(dayDate);
      
      // Simulate late day (approx 1 in 6 days)
      const isLate = (d + opIdx) % 6 === 2;
      const lateMins = isLate ? 15 + (d % 20) : Math.floor(Math.random() * 8) - 5; // if not late, -5 to +3 mins

      clockInDate.setHours(startH, startM + lateMins, 0, 0);

      const clockOutDate = new Date(dayDate);
      if (endH < startH) {
        clockOutDate.setDate(clockOutDate.getDate() + 1);
      }

      // OT seed: op1 (Mike Ross) works 10-12h on ~20/30 days = ~60h OT to trigger >50h warning
      // op2 (John Doe) works 9.5-10.5h on ~8 days = ~10h OT, stays within limit
      let otExtraMinutes = 0;
      if (opIdx === 0 && d !== 0 && d % 3 !== 0) {
        // op1: 2-4 extra hours on most days (every day except every 3rd day)
        otExtraMinutes = 120 + (d % 5) * 30; // 120, 150, 180, 210, 240 mins rotation
      } else if (opIdx === 1 && d !== 0 && d % 4 === 1) {
        // op2: 1-2 extra hours on every 4th day
        otExtraMinutes = 60 + (d % 3) * 30; // 60, 90, 120 mins rotation
      }

      clockOutDate.setHours(endH, endM + Math.floor(Math.random() * 10) + otExtraMinutes, 0, 0);

      attendanceEntries.push({
        userId: op.id,
        shiftId: shift.id,
        clockIn: clockInDate,
        clockOut: d === 0 ? null : clockOutDate, // Leave open clockOut for today
        status: isLate ? ("LATE" as const) : ("PRESENT" as const),
      });
    });
  }

  for (const att of attendanceEntries) {
    await prisma.attendanceLog.create({ data: att });
  }

  console.log("10b. Creating Shift Handover Logs with Miss Reasons...");
  const shiftsList = await prisma.shift.findMany();
  const sampleHandovers = [
    {
      shiftId: shiftsList[0]?.id || "",
      authorName: "Sarah Jenkins",
      productionNotes: "Shift A achieved 92% of target. CNC Bay ran smoothly.",
      downtimeNotes: "30 min chip conveyor jam on Machine 1.",
      safetyNotes: "All 5S standards maintained. Zero safety incidents.",
      nextShiftActions: "Prepare fixture setup for WO-1002 on Machine 2.",
      missReason: "Material delayed by 2 hours at CNC Bay loading area.",
      date: daysAgo(1),
    },
    {
      shiftId: shiftsList[1]?.id || shiftsList[0]?.id || "",
      authorName: "Mike Ross",
      productionNotes: "Shift B completed 88% of planned target.",
      downtimeNotes: "45 min electrical sensor fault on CNC Machine 3.",
      safetyNotes: "PPE audit conducted — 100% compliance.",
      nextShiftActions: "Perform routine coolant refilling on Milling bay.",
      missReason: "Tool wear & sensor recalibration caused 45 min unplanned stoppage.",
      date: daysAgo(2),
    },
  ];

  for (const h of sampleHandovers) {
    if (h.shiftId) {
      await prisma.shiftHandover.create({ data: h });
    }
  }

  console.log("10c. Seeding Shift WIP Handoff Counts & Tolerance Setting...");
  const machinesList = await prisma.machine.findMany();
  const shiftOperators = await prisma.user.findMany({ where: {  } });
  
  if (machinesList.length > 0 && shiftsList.length > 1 && shiftOperators.length > 1) {
    const m1 = machinesList[0];
    const m2 = machinesList[1] || machinesList[0];
    const m3 = machinesList[2] || machinesList[0];
    const s1 = shiftsList[0];
    const s2 = shiftsList[1];
    const op1 = shiftOperators[0];
    const op2 = shiftOperators[1];

    // AGREED 1
    await (prisma as any).shiftCount.create({
      data: {
        machineId: m1.id,
        fromShiftId: s1.id,
        toShiftId: s2.id,
        outgoingUserId: op1.id,
        incomingUserId: op2.id,
        outCount: 450,
        inCount: 450,
        finalCount: 450,
        status: "AGREED",
        at: daysAgo(1),
      },
    });

    // AGREED 2
    await (prisma as any).shiftCount.create({
      data: {
        machineId: m2.id,
        fromShiftId: s1.id,
        toShiftId: s2.id,
        outgoingUserId: op2.id,
        incomingUserId: op1.id,
        outCount: 300,
        inCount: 300,
        finalCount: 300,
        status: "AGREED",
        at: daysAgo(2),
      },
    });

    // DISPUTED 1
    await (prisma as any).shiftCount.create({
      data: {
        machineId: m1.id,
        fromShiftId: s2.id,
        toShiftId: s1.id,
        outgoingUserId: op1.id,
        incomingUserId: op2.id,
        outCount: 450,
        inCount: 430,
        finalCount: null,
        status: "DISPUTED",
        note: "Outgoing operator counted 450; incoming operator verified 430 units at bay.",
        at: daysAgo(0),
      },
    });

    // RESOLVED 1
    await (prisma as any).shiftCount.create({
      data: {
        machineId: m3.id,
        fromShiftId: s1.id,
        toShiftId: s2.id,
        outgoingUserId: op2.id,
        incomingUserId: op1.id,
        outCount: 480,
        inCount: 460,
        finalCount: 465,
        status: "RESOLVED",
        note: "Supervisor reconciled count: 15 units scrapped at end of shift without log.",
        at: daysAgo(3),
      },
    });
  }

  console.log("11. Creating Default Role Routine Steps...");
  const defaultRoutines = [
    // OPERATOR ROUTINE
    { role: "OPERATOR", seq: 1, title: "Clock in", target: "/operator", timeLabel: "Start of shift" },
    { role: "OPERATOR", seq: 2, title: "5S & machine check", target: "/operator", timeLabel: "+5 min" },
    { role: "OPERATOR", seq: 3, title: "Confirm today's job & operation", target: "/operator", timeLabel: "+10 min" },
    { role: "OPERATOR", seq: 4, title: "First-piece check", target: "/operator", timeLabel: "+15 min" },
    { role: "OPERATOR", seq: 5, title: "Start job", target: "/operator", timeLabel: "+20 min" },
    { role: "OPERATOR", seq: 6, title: "Log output through shift", target: "/operator", timeLabel: "During shift" },
    { role: "OPERATOR", seq: 7, title: "Clock out", target: "/operator", timeLabel: "End of shift" },

    // SUPERVISOR ROUTINE
    { role: "SUPERVISOR", seq: 1, title: "Review attendance & absences", target: "/attendance", timeLabel: "Start of shift" },
    { role: "SUPERVISOR", seq: 2, title: "Check Andon & walk floor", target: "/andon", timeLabel: "+15 min" },
    { role: "SUPERVISOR", seq: 3, title: "Review draft logs", target: "/reconcile", timeLabel: "Mid-shift" },
    { role: "SUPERVISOR", seq: 4, title: "Reconcile & close shift", target: "/reconcile", timeLabel: "-30 min end" },
    { role: "SUPERVISOR", seq: 5, title: "Write handover", target: "/handover", timeLabel: "End of shift" },

    // ADMIN ROUTINE
    { role: "ADMIN", seq: 1, title: "Read digest", target: "/digest", timeLabel: "08:00 AM" },
    { role: "ADMIN", seq: 2, title: "Check Andon", target: "/andon", timeLabel: "08:15 AM" },
    { role: "ADMIN", seq: 3, title: "Review schedule & WIP", target: "/schedule", timeLabel: "09:00 AM" },
    { role: "ADMIN", seq: 4, title: "Leaderboard & efficiency", target: "/leaderboard", timeLabel: "10:00 AM" },
    { role: "ADMIN", seq: 5, title: "Print morning pack", target: "print-pack", timeLabel: "11:00 AM" },
  ];

  for (const step of defaultRoutines) {
    await prisma.routineStep.create({ data: step });
  }

  console.log("12. Creating 5S Checklist Items & Historical Audits...");
  const fiveSItemsData = [
    // SORT
    { category: "SORT" as const, seq: 1, text: "Only necessary tools, jigs, and fixtures are present at the workstation." },
    { category: "SORT" as const, seq: 2, text: "Unused raw materials, scrap, and personal items are cleared away." },
    { category: "SORT" as const, seq: 3, text: "Red tag items are properly identified, tagged, and relocated." },

    // SET IN ORDER
    { category: "SET_IN_ORDER" as const, seq: 1, text: "All tools, gauges, and parts have clearly designated and labeled locations." },
    { category: "SET_IN_ORDER" as const, seq: 2, text: "Floor markings, shadow boards, and bin labels are clear and visible." },
    { category: "SET_IN_ORDER" as const, seq: 3, text: "Frequently used items are arranged within easy ergonomic reach." },

    // SHINE
    { category: "SHINE" as const, seq: 1, text: "Machine surfaces, guards, and touchpoints are clean and oil-free." },
    { category: "SHINE" as const, seq: 2, text: "Floors are clean, dry, and clear of chips, oil leaks, or coolant spills." },
    { category: "SHINE" as const, seq: 3, text: "Cleaning tools, trash bins, and rag containers are available and emptied." },

    // STANDARDIZE
    { category: "STANDARDIZE" as const, seq: 1, text: "Standard Operating Procedures (SOPs) & 5S standards are visually displayed." },
    { category: "STANDARDIZE" as const, seq: 2, text: "Color coding and visual controls are consistent across the bay." },
    { category: "STANDARDIZE" as const, seq: 3, text: "Routine cleaning and maintenance checklists are followed consistently." },

    // SUSTAIN
    { category: "SUSTAIN" as const, seq: 1, text: "Daily 5S audits/checks are conducted and tracked on time." },
    { category: "SUSTAIN" as const, seq: 2, text: "5S audit scores and continuous improvement corrective actions are posted." },
    { category: "SUSTAIN" as const, seq: 3, text: "Team members demonstrate active ownership and adherence to 5S habits." },
  ];

  const createdItems = [];
  for (const item of fiveSItemsData) {
    const created = await prisma.fiveSItem.create({ data: item });
    createdItems.push(created);
  }

  // Create historical audits across CNC Bay, Assembly, Stores over past 4 weeks
  const areas = ["CNC Bay", "Assembly", "Stores"];
  const auditors = ["Sarah Jenkins", "System Admin", "Mike Ross"];

  for (let w = 0; w < 4; w++) {
    for (let aIdx = 0; aIdx < areas.length; aIdx++) {
      const area = areas[aIdx];
      const auditor = auditors[aIdx % auditors.length];
      const auditDate = daysAgo(w * 7 + aIdx * 2);

      // Base score factor per area: CNC Bay (~92%), Assembly (~85%), Stores (~72%)
      const baseScore = area === "CNC Bay" ? 4.6 : area === "Assembly" ? 4.2 : 3.6;

      let totalPoints = 0;
      const scoresData = createdItems.map((item) => {
        const itemScore = Math.min(5, Math.max(1, Math.round(baseScore + (Math.random() * 0.8 - 0.4))));
        totalPoints += itemScore;
        return { itemId: item.id, score: itemScore };
      });

      const totalPct = Number(((totalPoints / (createdItems.length * 5)) * 100).toFixed(1));

      await prisma.fiveSAudit.create({
        data: {
          area,
          auditorName: auditor,
          date: auditDate,
          totalPct,
          notes: `Routine ${area} 5S audit. Score: ${totalPct}%.`,
          scores: {
            createMany: {
              data: scoresData,
            },
          },
        },
      });
    }
  }

  console.log("13. Seeding Scrap Quarantine and Rework Orders...");
  const firstWO = await prisma.workOrder.findFirst({ where: { status: "IN_PROGRESS" } });
  const firstMachine = await prisma.machine.findFirst();

  if (firstWO && firstMachine) {
    const q1 = await (prisma as any).scrapQuarantine.create({
      data: {
        workOrderId: firstWO.id,
        quantity: 12,
        defectCode: "BURR_EXCESSIVE",
        loggedBy: "Ravi Kumar",
        status: "PENDING",
        costEstimate: 180.0,
        dispositionNotes: "Parts held for MRB review. Excessive burr detected post-milling.",
      },
    });

    const q2 = await (prisma as any).scrapQuarantine.create({
      data: {
        workOrderId: firstWO.id,
        quantity: 8,
        defectCode: "DIMENSIONAL_OUT",
        loggedBy: "Suresh Patel",
        status: "REWORK",
        costEstimate: 120.0,
        dispositionNotes: "Approved for surface regrinding and recalibration on CNC Lathe 01.",
      },
    });

    await (prisma as any).reworkOrder.create({
      data: {
        quarantineId: q2.id,
        targetMachineId: firstMachine.id,
        routingSteps: "Surface Regrinding -> QC Re-inspection -> De-burring Pass",
        extraLaborHours: 1.5,
        status: "IN_PROGRESS",
      },
    });

    await (prisma as any).scrapQuarantine.create({
      data: {
        workOrderId: firstWO.id,
        quantity: 5,
        defectCode: "SURFACE_SCRATCH",
        loggedBy: "Anil Sharma",
        status: "SCRAPPED",
        costEstimate: 75.0,
        dispositionNotes: "Irrecoverable deep gouges. Sent to metal recycling scrap bin.",
      },
    });

    // NCRs — linked to the quarantine lots above so the MRB register, compliance
    // digest (open NCR count), QMS finding links and escalation candidates populate.
    if ((await prisma.ncrReport.count()) === 0) {
      const defectBurr = await prisma.defectCode.findFirst({ where: { code: "BURR_EXCESSIVE" } });
      const defectDim = await prisma.defectCode.findFirst({ where: { code: "DIMENSIONAL_OUT" } });
      await prisma.ncrReport.create({
        data: {
          ncrNumber: "NCR-2026-001",
          quarantineId: q1.id,
          workOrderId: firstWO.id,
          productId: firstWO.productId,
          defectCodeId: defectBurr?.id || null,
          quantity: 12,
          description: "Excessive burr on 12 pcs post-milling — held for MRB disposition.",
          severity: "HIGH",
          status: "OPEN",
          raisedBy: "Suresh Patel",
          raisedAt: new Date(Date.now() - 3 * 86400000),
        },
      });
      await prisma.ncrReport.create({
        data: {
          ncrNumber: "NCR-2026-002",
          quarantineId: q2.id,
          workOrderId: firstWO.id,
          productId: firstWO.productId,
          defectCodeId: defectDim?.id || null,
          quantity: 8,
          description: "8 pcs dimensional deviation on flange bore — rework approved.",
          severity: "MEDIUM",
          status: "DISPOSITIONED",
          disposition: "REWORK",
          dispositionAuthority: "QUALITY",
          raisedBy: "Ravi Kumar",
          raisedAt: new Date(Date.now() - 5 * 86400000),
        },
      });
      await prisma.ncrReport.create({
        data: {
          ncrNumber: "NCR-2026-003",
          workOrderId: firstWO.id,
          productId: firstWO.productId,
          quantity: 5,
          description: "Customer-returned lot with surface marks — accepted use-as-is after review.",
          severity: "LOW",
          status: "CLOSED",
          disposition: "USE_AS_IS",
          dispositionAuthority: "CUSTOMER",
          customerNotification: true,
          raisedBy: "Anil Sharma",
          raisedAt: new Date(Date.now() - 12 * 86400000),
          closedAt: new Date(Date.now() - 8 * 86400000),
        },
      });
      console.log("NCRs seeded (1 OPEN, 1 DISPOSITIONED, 1 CLOSED) linked to quarantine lots.");
    }
  }

  console.log("14. Seeding Tooling Inventory & Preventive Maintenance...");
  const toolMachinesList = await prisma.machine.findMany();
  if (toolMachinesList.length > 0) {
    // Tool 1: Active
    await (prisma as any).tool.create({
      data: {
        toolCode: "TL-CNC-001",
        name: "Carbide Endmill 12mm 4-Flute",
        maxLifeCycles: 5000,
        currentCycles: 1250,
        warningThreshold: 85.0,
        status: "ACTIVE",
        assignedMachineId: toolMachinesList[0].id,
      },
    });

    // Tool 2: Warning (88% life used)
    await (prisma as any).tool.create({
      data: {
        toolCode: "TL-DIE-A01",
        name: "Precision Stamping Die A-01",
        maxLifeCycles: 10000,
        currentCycles: 8800,
        warningThreshold: 85.0,
        status: "WARNING",
        assignedMachineId: toolMachinesList[1] ? toolMachinesList[1].id : toolMachinesList[0].id,
      },
    });

    // Tool 3: Maintenance Required (100% life used)
    await (prisma as any).tool.create({
      data: {
        toolCode: "TL-DRL-008",
        name: "High-Speed CNC Drill Bit 8mm",
        maxLifeCycles: 3000,
        currentCycles: 3000,
        warningThreshold: 85.0,
        status: "MAINTENANCE",
        assignedMachineId: toolMachinesList[2] ? toolMachinesList[2].id : toolMachinesList[0].id,
      },
    });

    // Tool 4: Active
    await (prisma as any).tool.create({
      data: {
        toolCode: "TL-INS-C04",
        name: "Carbide Indexable Milling Insert",
        maxLifeCycles: 2000,
        currentCycles: 600,
        warningThreshold: 85.0,
        status: "ACTIVE",
        assignedMachineId: toolMachinesList[3] ? toolMachinesList[3].id : toolMachinesList[0].id,
      },
    });

    // Tool 5: Retired
    await (prisma as any).tool.create({
      data: {
        toolCode: "TL-GRN-W02",
        name: "Diamond Surface Grinding Wheel",
        maxLifeCycles: 4000,
        currentCycles: 4000,
        warningThreshold: 85.0,
        status: "RETIRED",
        assignedMachineId: null,
      },
    });
  }

  console.log("15. Seeding Shopfloor Continuous Improvement Ideas...");
  await (prisma as any).idea.createMany({
    data: [
      {
        title: "Anti-fatigue matting at CNC Milling Bay 01",
        description: "Operators spend 8+ hours standing on concrete. Ergonomic matting will reduce fatigue and lower error rates during late shift.",
        category: "ERGONOMICS",
        submittedBy: "Ravi Kumar",
        upvotes: 14,
        status: "IMPLEMENTED",
      },
      {
        title: "Shadow board for hex keys and torque wrenches",
        description: "Reduce changeover search time by mounting a color-coded magnetic shadow board directly on Machine CNC-01.",
        category: "FIVES",
        submittedBy: "Suresh Patel",
        upvotes: 19,
        status: "IMPLEMENTED",
      },
      {
        title: "Pneumatic quick-clamp fixture on Assembly Line 2",
        description: "Replace manual screw clamps with pneumatic toggle clamps to cut part loading cycle time by 4.5 seconds per piece.",
        category: "CYCLE_TIME",
        submittedBy: "Anil Sharma",
        upvotes: 22,
        status: "APPROVED",
      },
      {
        title: "LED chip clearance spotlight on Lathe 03",
        description: "Add an extra 24V LED spotlight inside the machine enclosure for safer chip removal during maintenance.",
        category: "SAFETY",
        submittedBy: "Vikram Singh",
        upvotes: 8,
        status: "UNDER_REVIEW",
      },
      {
        title: "Recycling bin split for coolant-soaked rags vs metal chips",
        description: "Improve 5S standardization by placing separate hazardous waste containers at each station.",
        category: "FIVES",
        submittedBy: "Priya Nair",
        upvotes: 6,
        status: "SUBMITTED",
      },
    ],
  });

  console.log("16. Seeding Zero-Harm Safety & Near-Miss Incidents...");
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

  await (prisma as any).safetyIncident.createMany({
    data: [
      {
        type: "HAZARD",
        severity: "HIGH",
        description: "Hydraulic oil slick spilled near CNC Milling Bay 01 walkway. High slip risk for operators during chip disposal.",
        location: "CNC Milling Bay",
        reportedBy: "Ravi Kumar",
        status: "CAPA_ASSIGNED",
        capaOwner: "Amit Verma (EHS Officer)",
        capaDueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        fiveWhyReason: "Why 1: Oil leak on floor. Why 2: Hydraulic line seal degraded. Why 3: Exceeded recommended replacement hours. Why 4: PM schedule missed. Why 5: Lack of automated tool life alert.",
        createdAt: twoDaysAgo,
      },
      {
        type: "NEAR_MISS",
        severity: "MEDIUM",
        description: "Forklift driver turned corner into Assembly Line 02 aisle without sounding horn. Operator stepped back just in time.",
        location: "Assembly Line 02",
        reportedBy: "Suresh Patel",
        status: "OPEN",
        createdAt: fiveDaysAgo,
      },
      {
        type: "PPE_VIOLATION",
        severity: "LOW",
        description: "Contractor entering Press Shop without mandatory safety glasses and steel-toe boots.",
        location: "Stamping Press Shop",
        reportedBy: "Anil Sharma",
        status: "CLOSED",
        capaOwner: "Deepak Joshi",
        capaDueDate: fiveDaysAgo,
        fiveWhyReason: "Contractor not briefed at gate security. Corrective action: mandatory EHS gate badge checklist.",
        createdAt: tenDaysAgo,
      },
      {
        type: "INCIDENT",
        severity: "CRITICAL",
        description: "Safety interlock door on Robotic Welding Cell 03 bypassed during manual alignment.",
        location: "Robotic Welding Bay",
        reportedBy: "Vikram Singh",
        status: "CAPA_ASSIGNED",
        capaOwner: "Rajesh Gupta (Plant Safety Lead)",
        capaDueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        fiveWhyReason: "Why 1: Interlock key left in override switch. Why 2: Operator trying to clear arc fault quickly. Why 3: Interlock key not key-locked to supervisor.",
        createdAt: twoDaysAgo,
      },
    ],
  });

  console.log("17. Seeding Default Costing Rates...");
  await prisma.setting.upsert({
    where: { key: "laborRatePerHour" },
    update: { value: "150" },
    create: { key: "laborRatePerHour", value: "150" },
  });
  await prisma.setting.upsert({
    where: { key: "machineRatePerHour" },
    update: { value: "300" },
    create: { key: "machineRatePerHour", value: "300" },
  });
  await prisma.setting.upsert({
    where: { key: "otDailyThresholdHours" },
    update: { value: "9" },
    create: { key: "otDailyThresholdHours", value: "9" },
  });
  await prisma.setting.upsert({
    where: { key: "otMultiplier" },
    update: { value: "2" },
    create: { key: "otMultiplier", value: "2" },
  });

  console.log("18. Seeding Raw Materials and Inventory Transactions...");
  const rm1 = await prisma.rawMaterial.create({
    data: {
      sku: "RM-ALU-SHEET",
      name: "Aerospace Aluminum Sheet 6061-T6",
      unit: "sq_ft",
      unitCost: 120.0,
      minStock: 500.0,
      currentStock: 1250.0,
    },
  });

  const rm2 = await prisma.rawMaterial.create({
    data: {
      sku: "RM-STL-ROD",
      name: "Stainless Steel Shafting Rod 316L",
      unit: "kg",
      unitCost: 45.0,
      minStock: 800.0,
      currentStock: 2200.0,
    },
  });

  const rm3 = await prisma.rawMaterial.create({
    data: {
      sku: "RM-BRS-INGOT",
      name: "High Purity Brass Alloy Ingot C360",
      unit: "kg",
      unitCost: 250.0,
      minStock: 400.0,
      currentStock: 650.0,
    },
  });

  const rm4 = await prisma.rawMaterial.create({
    data: {
      sku: "RM-CUT-OIL",
      name: "Synthetic CNC Coolant & Cutting Fluid",
      unit: "liters",
      unitCost: 380.0,
      minStock: 200.0,
      currentStock: 45.0, // INTENTIONALLY LOW STOCK ALERT! currentStock 45 <= minStock 200
    },
  });

  const rm5 = await prisma.rawMaterial.create({
    data: {
      sku: "RM-WELD-WIRE",
      name: "ER70S-6 Robotic MIG Welding Wire Spool",
      unit: "spools",
      unitCost: 1450.0,
      minStock: 50.0,
      currentStock: 120.0,
    },
  });

  // Fetch WO-2026-001 for linking material issuance
  const wo1 = createdWorkOrders[0];

  // Seed Transactions
  await prisma.inventoryTransaction.createMany({
    data: [
      {
        rawMaterialId: rm1.id,
        type: "IN",
        qty: 1500,
        unitCost: 120.0,
        batchNo: "BATCH-AL-2026-08A",
        reference: "PO-4091",
        actorName: "Storekeeper Ram",
        at: daysAgo(5),
      },
      {
        rawMaterialId: rm1.id,
        type: "OUT",
        qty: 250,
        unitCost: 120.0,
        batchNo: "BATCH-AL-2026-08A",
        reference: wo1 ? wo1.woNumber : "WO-2026-001",
        workOrderId: wo1 ? wo1.id : null,
        actorName: "Mike Ross (Operator)",
        at: daysAgo(2),
      },
      {
        rawMaterialId: rm2.id,
        type: "IN",
        qty: 2500,
        unitCost: 45.0,
        batchNo: "BATCH-ST-2026-04B",
        reference: "PO-4092",
        actorName: "Storekeeper Ram",
        at: daysAgo(6),
      },
      {
        rawMaterialId: rm2.id,
        type: "OUT",
        qty: 300,
        unitCost: 45.0,
        batchNo: "BATCH-ST-2026-04B",
        reference: "WO-2026-002",
        workOrderId: createdWorkOrders[1] ? createdWorkOrders[1].id : null,
        actorName: "Storekeeper Ram",
        at: daysAgo(3),
      },
      {
        rawMaterialId: rm4.id,
        type: "IN",
        qty: 50,
        unitCost: 380.0,
        batchNo: "BATCH-OIL-2026-01",
        reference: "PO-4088",
        actorName: "Storekeeper Ram",
        at: daysAgo(10),
      },
      {
        rawMaterialId: rm4.id,
        type: "OUT",
        qty: 5,
        unitCost: 380.0,
        batchNo: "BATCH-OIL-2026-01",
        reference: wo1 ? wo1.woNumber : "WO-2026-001",
        workOrderId: wo1 ? wo1.id : null,
        actorName: "Mike Ross (Operator)",
        at: daysAgo(1),
      },
    ],
  });

  console.log("15. Creating Suppliers and Purchase Orders...");
  const s1 = await prisma.supplier.create({
    data: {
      name: "Hindalco Aluminium Solutions",
      contactPhone: "+91-9812345678",
      email: "supply@hindalco.com",
      defaultLeadDays: 7,
    },
  });

  const s2 = await prisma.supplier.create({
    data: {
      name: "Apex Steel Corp",
      contactPhone: "+91-9876543210",
      email: "orders@apexsteel.com",
      defaultLeadDays: 5,
    },
  });

  const s3 = await prisma.supplier.create({
    data: {
      name: "PetroLube Industrial Oils",
      contactPhone: "+91-9898989898",
      email: "orders@petrolube.in",
      defaultLeadDays: 3,
    },
  });

  // Link raw materials to suppliers
  await prisma.rawMaterial.update({ where: { id: rm1.id }, data: { supplierId: s1.id } });
  await prisma.rawMaterial.update({ where: { id: rm2.id }, data: { supplierId: s2.id } });
  await prisma.rawMaterial.update({ where: { id: rm4.id }, data: { supplierId: s3.id } });

  // Seed 4 Purchase Orders
  await prisma.purchaseOrder.createMany({
    data: [
      {
        poNumber: "PO-2026-001",
        supplierId: s1.id,
        rawMaterialId: rm1.id,
        qty: 500,
        unitCost: 120.0,
        status: "ORDERED",
        expectedDate: daysAgo(-5), // in 5 days
        receivedQty: 0,
        createdBy: "System Admin",
        createdAt: daysAgo(2),
      },
      {
        poNumber: "PO-2026-002",
        supplierId: s2.id,
        rawMaterialId: rm2.id,
        qty: 1000,
        unitCost: 45.0,
        status: "PARTIAL",
        expectedDate: daysAgo(-3), // in 3 days
        receivedQty: 400,
        createdBy: "System Admin",
        createdAt: daysAgo(4),
      },
      {
        poNumber: "PO-2026-003",
        supplierId: s3.id,
        rawMaterialId: rm4.id,
        qty: 300,
        unitCost: 380.0,
        status: "RECEIVED",
        expectedDate: daysAgo(2),
        receivedQty: 300,
        receivedAt: daysAgo(3), // ON TIME (received 3 days ago <= expected 2 days ago)
        createdBy: "System Admin",
        createdAt: daysAgo(8),
      },
      {
        poNumber: "PO-2026-004",
        supplierId: s2.id,
        rawMaterialId: rm2.id,
        qty: 800,
        unitCost: 45.0,
        status: "RECEIVED",
        expectedDate: daysAgo(10),
        receivedQty: 800,
        receivedAt: daysAgo(4), // LATE (received 4 days ago > expected 10 days ago)
        createdBy: "System Admin",
        createdAt: daysAgo(18),
      },
    ],
  });

  console.log("15.5. Creating Supplier Payments...");
  await prisma.supplierPayment.createMany({
    data: [
      { supplierId: s1.id, amount: 250000, method: 'BANK_TRANSFER', reference: 'NEFT-123', actorName: 'System', paymentDate: daysAgo(5) },
      { supplierId: s2.id, amount: 50000, method: 'UPI', reference: 'UPI-999', actorName: 'System', paymentDate: daysAgo(2) }
    ]
  });

  console.log("19. Seeding BOM Lines for Products...");
  await prisma.bomLine.createMany({
    data: [
      // Product 1: Aluminum Gear Housing (p1)
      { productId: p1.id, rawMaterialId: rm1.id, qtyPerUnit: 0.8 },
      { productId: p1.id, rawMaterialId: rm4.id, qtyPerUnit: 0.05 },

      // Product 2: Polymer Control Enclosure (p2)
      { productId: p2.id, rawMaterialId: rm2.id, qtyPerUnit: 0.6 },
      { productId: p2.id, rawMaterialId: rm3.id, qtyPerUnit: 0.08 },

      // Product 3: Heavy Steel Chassis Frame (p3)
      { productId: p3.id, rawMaterialId: rm2.id, qtyPerUnit: 5.0 },
      { productId: p3.id, rawMaterialId: rm5.id, qtyPerUnit: 0.1 },
    ],
  });

  console.log("20. Seeding Maintenance Jobs, PM Rules, and Tools...");

  // 2 open maintenance jobs
  await (prisma as any).maintenanceJob.createMany({
    data: [
      {
        machineId: cnc1.id,
        requestedByName: "Rajan Kumar",
        type: "BREAKDOWN",
        priority: "HIGH",
        description: "Spindle vibration noise above 85dB — intermittent stops every 30 min. Machine needs immediate inspection.",
        status: "OPEN",
        openedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3h ago
      },
      {
        machineId: imm2.id,
        requestedByName: "Sarah Jenkins",
        type: "PM",
        priority: "MEDIUM",
        description: "Scheduled 500-hour preventive maintenance — lubrication, filter replacement, and conveyor belt inspection.",
        status: "IN_PROGRESS",
        openedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
      },
      {
        machineId: rob3.id,
        requestedByName: "David Patel",
        type: "BREAKDOWN",
        priority: "CRITICAL",
        description: "Weld gun electrode tip worn out — poor weld penetration causing rejects. Electrode changed + recalibrated.",
        status: "CLOSED",
        openedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        closedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
        closedBy: "System Admin",
        rootCause: "Electrode tip erosion after 1200 weld cycles — replacement interval reduced from 1500 to 1000 cycles.",
        partsUsed: "Weld gun electrode tip x2, contact tip M6 x4",
        costRupees: 2800.0,
        laborHours: 4.0,
      },
    ],
  });

  // 2 PM rules — one overdue, one in window
  await (prisma as any).pMRule.createMany({
    data: [
      {
        machineId: lsr4.id,
        title: "Laser Optics Cleaning & Alignment Check",
        intervalDays: 7,
        lastDoneAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // 12 days ago → overdue (7-day interval)
        isActive: true,
      },
      {
        machineId: cnc1.id,
        title: "CNC Spindle Oil & Filter Change",
        intervalDays: 30,
        lastDoneAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago → 20 days remaining
        isActive: true,
      },
    ],
  });

  // 2 maintenance tools — one at 92% (WARN), one at 40% (OK)
  await (prisma as any).maintenanceTool.createMany({
    data: [
      {
        code: "T-DIE-001",
        name: "Progressive Stamping Die #1",
        machineId: cnc1.id,
        kind: "DIE",
        ratedLifeUnits: 50000.0,
        usedUnits: 46000.0, // 92% → WARN
        lastChangedAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months ago
      },
      {
        code: "T-MOULD-002",
        name: "PP Injection Mould — Control Panel Base",
        machineId: rob3.id,
        kind: "MOULD",
        ratedLifeUnits: 100000.0,
        usedUnits: 40000.0, // 40% → OK
        lastChangedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 3 months ago
      },
    ],
  });

  // 17. Seed 3 Quotations (DRAFT, SENT, WON)
  const allProds = await prisma.product.findMany();
  if (allProds.length >= 2) {
    const pA = allProds[0];
    const pB = allProds[1];

    await (prisma as any).quotation.create({
      data: {
        quoteNumber: "QT-2026-001",
        customerName: "Titan Automotive Pvt Ltd",
        customerContact: "procurement@titanauto.com",
        status: "DRAFT",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        estimatedCost: 125000.0,
        quotedPrice: 165000.0,
        marginPct: 24.2,
        notes: "Draft RFQ for Q3 bracket supply. Awaiting final tolerance sign-off.",
        lines: {
          create: [
            {
              productId: pA.id,
              plannedQty: 1000,
              unitPrice: 110.0,
              subtotal: 110000.0,
            },
            {
              productId: pB.id,
              plannedQty: 500,
              unitPrice: 110.0,
              subtotal: 55000.0,
            },
          ],
        },
      },
    });

    await (prisma as any).quotation.create({
      data: {
        quoteNumber: "QT-2026-002",
        customerName: "L&T Defense Systems",
        customerContact: "purchase@lntdefense.in",
        status: "SENT",
        validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        estimatedCost: 280000.0,
        quotedPrice: 380000.0,
        marginPct: 26.3,
        notes: "Official proforma submitted via email. Payment terms NET-30 agreed.",
        lines: {
          create: [
            {
              productId: pA.id,
              plannedQty: 2500,
              unitPrice: 152.0,
              subtotal: 380000.0,
            },
          ],
        },
      },
    });

    await (prisma as any).quotation.create({
      data: {
        quoteNumber: "QT-2026-003",
        customerName: "Godrej Aerospace Ltd",
        customerContact: "vendor.management@godrej.com",
        status: "WON",
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        estimatedCost: 85000.0,
        quotedPrice: 120000.0,
        marginPct: 29.2,
        notes: "Bid won! Ready for 1-click conversion to shopfloor Work Orders.",
        lines: {
          create: [
            {
              productId: pB.id,
              plannedQty: 1200,
              unitPrice: 100.0,
              subtotal: 120000.0,
            },
          ],
        },
      },
    });
  }

  // 17b. P18–P20 — S&OP / Price revisions / Follow-up cadence demo data
  // P19 — price revisions: one APPROVED ~335 days ago (annual review due ~30d) + one DRAFT
  const prExisting = await (prisma as any).priceRevision.count();
  if (prExisting === 0 && allProds.length >= 1) {
    const base = allProds[0].sellingPricePerUnit ?? 100;
    const eff335 = new Date(Date.now() - 335 * 24 * 60 * 60 * 1000);
    await (prisma as any).priceRevision.createMany({
      data: [
        {
          revisionNumber: "PR-2025-101",
          productId: allProds[0].id,
          oldPrice: Math.round(base / 1.07 * 100) / 100,
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
          productId: allProds[0].id,
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
  }

  // P20 — follow-up cadence: mark QT-2026-001 idle (no touch in 9 days) + two LOST enquiries with reasons
  const qt1 = await (prisma as any).quotation.findUnique({ where: { quoteNumber: "QT-2026-001" } });
  if (qt1 && !qt1.lastFollowUpAt) {
    await (prisma as any).quotation.update({
      where: { id: qt1.id },
      data: {
        createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
        followUps: [
          { at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(), by: "System Admin", note: "RFQ received — awaiting tolerance sign-off" },
        ],
      },
    });
  }
  // P20 — one more SENT enquiry left untouched 12 days (idle bell demo on fresh installs)
  if (!(await (prisma as any).quotation.findUnique({ where: { quoteNumber: "QT-2026-006" } })) && allProds.length >= 1) {
    await (prisma as any).quotation.create({
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
        lines: {
          create: [{ productId: allProds[0].id, plannedQty: 800, unitPrice: 110.0, subtotal: 88000.0 }],
        },
      },
    });
  }

  const lostExists = await (prisma as any).quotation.count({ where: { status: "LOST" } });
  if (lostExists === 0 && allProds.length >= 1) {
    await (prisma as any).quotation.createMany({
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
  }

  // 18. Seed Dispatches & GST Tax Invoices (one UNPAID, one PAID)
  const allWorkOrders = await prisma.workOrder.findMany({ take: 2 });
  if (allWorkOrders.length >= 2) {
    const wo1 = allWorkOrders[0];
    const wo2 = allWorkOrders[1];

    const disp1 = await (prisma as any).dispatchRecord.create({
      data: {
        challanNumber: "DC-2026-001",
        workOrderId: wo1.id,
        dispatchedQty: 500,
        carrierName: "Blue Dart Logistics",
        vehicleNumber: "MH-12-AB-1234",
        dispatchedByName: "Store Manager - Rajesh Sharma",
        dispatchedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        notes: `Part batch shipment under WO ${wo1.woNumber}`,
      },
    });

    const disp2 = await (prisma as any).dispatchRecord.create({
      data: {
        challanNumber: "DC-2026-002",
        workOrderId: wo2.id,
        dispatchedQty: 1000,
        carrierName: "VRL Logistics",
        vehicleNumber: "MH-14-XY-5678",
        dispatchedByName: "Store Manager - Rajesh Sharma",
        dispatchedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        notes: `Full batch shipment under WO ${wo2.woNumber}`,
      },
    });

    // Seed Invoices (UNPAID INTRA, PAID INTER, PARTIAL INTRA)
  // Invoice 1: INTRA, UNPAID (No payments)
  await (prisma as any).invoice.create({
    data: toPaiseRow("Invoice", {
      invoiceNumber: "INV-2026-001",
      dispatchRecordId: disp1.id,
      workOrderId: wo1.id,
      customerName: "Acme Corp Ltd",
      customerAddress: "MIDC Bhosari, Pune",
      customerGstin: "27AACCA1234A1Z1",
      taxableValue: 75000,
      taxType: "INTRA",
      taxRatePct: 18,
      cgstAmt: 6750,
      sgstAmt: 6750,
      igstAmt: 0,
      totalValue: 88500,
      paidAmount: 0,
      dueDate: new Date(Date.now() + 30 * 86400000), // Net 30
      status: "UNPAID",
      notes: "First batch delivery",
    }),
  });

  // Invoice 2: INTER, PAID (Fully paid)
  const invoice2 = await (prisma as any).invoice.create({
    data: toPaiseRow("Invoice", {
      invoiceNumber: "INV-2026-002",
      dispatchRecordId: disp2.id,
      workOrderId: wo1.id,
      customerName: "Global Tech Inc.",
      customerAddress: "Tech Park, Bengaluru",
      customerGstin: "29AABCD1234E1Z1",
      taxableValue: 150000,
      taxType: "INTER",
      taxRatePct: 18,
      cgstAmt: 0,
      sgstAmt: 0,
      igstAmt: 27000,
      totalValue: 177000,
      paidAmount: 177000,
      dueDate: new Date(Date.now() - 5 * 86400000), // Overdue by 5 days
      status: "PAID",
    }),
  });

  await (prisma as any).payment.create({
    data: {
      invoiceId: invoice2.id,
      amount: toPaise(177000),
      method: "BANK_TRANSFER",
      reference: "UTR-HDFC-991823",
      receivedBy: "Admin",
      paymentDate: new Date(),
    }
  });

  // Invoice 3: INTRA, PARTIAL (Partially paid)
  const dispatch3 = await (prisma as any).dispatchRecord.create({
    data: {
      challanNumber: "DC-2026-003",
      workOrderId: wo2.id,
      dispatchedQty: 50,
      carrierName: "Delhivery",
      dispatchedByName: "Admin",
    },
  });

  const invoice3 = await (prisma as any).invoice.create({
    data: toPaiseRow("Invoice", {
      invoiceNumber: "INV-2026-003",
      dispatchRecordId: dispatch3.id,
      workOrderId: wo2.id,
      customerName: "MegaBuild Projects",
      customerAddress: "Bandra, Mumbai",
      customerGstin: "27AABBM1234P1Z2",
      taxableValue: 50000,
      taxType: "INTRA",
      taxRatePct: 18,
      cgstAmt: 4500,
      sgstAmt: 4500,
      igstAmt: 0,
      totalValue: 59000,
      paidAmount: 20000,
      dueDate: new Date(Date.now() - 65 * 86400000), // Overdue by 65 days
      status: "PARTIAL",
    }),
  });

  await (prisma as any).payment.create({
    data: {
      invoiceId: invoice3.id,
      amount: toPaise(20000),
      method: "UPI",
      reference: "UPI-TID-12345",
      receivedBy: "Admin",
      paymentDate: new Date(Date.now() - 10 * 86400000),
    }
  });

  console.log("Created 3 Dispatches, 3 Invoices (UNPAID, PAID, PARTIAL), and 2 Payments.");
  }

  console.log("31. Creating Customer Complaints...");
  await prisma.customerComplaint.create({
    data: {
      complaintNumber: "CMP-2026-001",
      customerName: "Acme Corp",
      workOrderId: wo1.id,
      batchNo: "B-2026-01",
      type: "QUALITY",
      severity: "CRITICAL",
      description: "Critical tolerance mismatch on flange diameter.",
      status: "OPEN",
      returnedQty: 50,
      raisedAt: new Date(Date.now() - 2 * 86400000),
    }
  });

  await prisma.customerComplaint.create({
    data: {
      complaintNumber: "CMP-2026-002",
      customerName: "Global Industries",
      type: "DELIVERY",
      severity: "MEDIUM",
      description: "Delivery delayed by 3 days.",
      status: "CLOSED",
      rootCause: "Logistics partner strike.",
      capaAction: "Onboarded secondary logistics partner for backup.",
      disposition: "NO_ACTION",
      raisedAt: new Date(Date.now() - 15 * 86400000),
      closedAt: new Date(Date.now() - 10 * 86400000),
    }
  });

  console.log("32. Creating Calibrated Tools & Special Process Vendors (Nadcap)...");
  const seedNow = new Date();

  await prisma.calibratedTool.upsert({
    where: { serialNumber: "CAL-MIC-001" },
    update: {
      calibratedAt: new Date(seedNow.getTime() - 90 * 86400000),
      expiresAt: new Date(seedNow.getTime() + 180 * 86400000),
      calibrationIntervalDays: 365,
      costRupees: 4200,
    },
    create: {
      toolType: "MICROMETER",
      name: "Digital Micrometer 0-25mm",
      serialNumber: "CAL-MIC-001",
      calibratedAt: new Date(seedNow.getTime() - 90 * 86400000),
      expiresAt: new Date(seedNow.getTime() + 180 * 86400000),
      certNumber: "NPL-CAL-2210-01",
      status: "OK",
      calibrationIntervalDays: 365,
      costRupees: 4200,
    },
  });

  await prisma.calibratedTool.upsert({
    where: { serialNumber: "CAL-TW-014" },
    update: {
      calibratedAt: new Date(seedNow.getTime() - 350 * 86400000),
      expiresAt: new Date(seedNow.getTime() + 10 * 86400000),
      calibrationIntervalDays: 180,
      costRupees: 3500,
    },
    create: {
      toolType: "TORQUE_WRENCH",
      name: "Torque Wrench 20-100 Nm",
      serialNumber: "CAL-TW-014",
      calibratedAt: new Date(seedNow.getTime() - 350 * 86400000),
      expiresAt: new Date(seedNow.getTime() + 10 * 86400000),
      certNumber: "NPL-CAL-2311-02",
      status: "EXPIRING_SOON",
      calibrationIntervalDays: 180,
      costRupees: 3500,
    },
  });

  await prisma.calibratedTool.upsert({
    where: { serialNumber: "CAL-BG-007" },
    update: {
      calibratedAt: new Date(seedNow.getTime() - 400 * 86400000),
      expiresAt: new Date(seedNow.getTime() - 5 * 86400000),
      calibrationIntervalDays: 90,
      costRupees: 2800,
    },
    create: {
      toolType: "GAUGE",
      name: "Bore Gauge 50mm",
      serialNumber: "CAL-BG-007",
      calibratedAt: new Date(seedNow.getTime() - 400 * 86400000),
      expiresAt: new Date(seedNow.getTime() - 5 * 86400000),
      certNumber: "NPL-CAL-2205-03",
      status: "EXPIRED",
      calibrationIntervalDays: 90,
      costRupees: 2800,
    },
  });

  await prisma.specialProcessVendor.upsert({
    where: { name: "AeroHeat Treat Ltd" },
    update: {},
    create: {
      name: "AeroHeat Treat Ltd",
      processType: "HEAT_TREAT",
      nadcapCertNumber: "Nadcap-AC-4412",
      expiresAt: new Date(seedNow.getTime() + 200 * 86400000),
      status: "APPROVED",
    },
  });

  await prisma.specialProcessVendor.upsert({
    where: { name: "Precision NDT Services" },
    update: {},
    create: {
      name: "Precision NDT Services",
      processType: "NDT",
      nadcapCertNumber: "Nadcap-NDT-8831",
      expiresAt: new Date(seedNow.getTime() - 30 * 86400000),
      status: "EXPIRED",
    },
  });

  console.log("Created 3 Calibrated Tools (OK, EXPIRING_SOON, EXPIRED) and 2 Special Process Vendors (APPROVED, EXPIRED).");

  // Link the EXPIRED NDT vendor to an outsourced step on the aerospace product (p1)
  // so the Nadcap dispatch block is demonstrable: dispatching into seq 5 is hard-blocked.
  const expiredNdtVendor = await prisma.specialProcessVendor.findUnique({
    where: { name: "Precision NDT Services" },
  });
  if (expiredNdtVendor && p1) {
    const ndtOp = await prisma.operation.findUnique({ where: { code: "OP30" } });
    const existingNdtStep = await prisma.routingStep.findFirst({
      where: { productId: p1.id, stationName: "NDT (Outsourced)" },
    });
    if (!existingNdtStep && ndtOp) {
      await prisma.routingStep.create({
        data: {
          productId: p1.id,
          operationId: ndtOp.id,
          seq: 5,
          stationName: "NDT (Outsourced)",
          standardCycleTimeSeconds: 30,
          setupTimeMin: 10,
          cycleTimeMin: 0.5,
          instructions: "Outsourced NDT per Nadcap. Vendor cert must be APPROVED before dispatch.",
          specialProcessVendorId: expiredNdtVendor.id,
        },
      });
      console.log("Linked EXPIRED NDT vendor to p1 routing step seq 5 (NDT Outsourced).");
    }
  }

  console.log("33. Seeding Corporate Services & Compliance modules...");
  const corpNow = new Date();

  if ((await prisma.statutoryContribution.count()) === 0) {
    await prisma.statutoryContribution.createMany({
      data: [
        {
          employeeName: "Ravi Sharma",
          employeeCode: "EMP-001",
          month: "2026-07",
          pfNumber: "PF/HYD/123456/000",
          esiNumber: "ESI-4100123456",
          pfWage: 21000, pfEmployee: 2520, pfEmployer: 2520,
          esiWage: 21000, esiEmployee: 1575, esiEmployer: 3675,
        },
        {
          employeeName: "Priya Nair",
          employeeCode: "EMP-002",
          month: "2026-07",
          pfNumber: "PF/HYD/123456/001",
          esiNumber: "ESI-4100123457",
          pfWage: 28000, pfEmployee: 3360, pfEmployer: 3360,
          esiWage: 28000, esiEmployee: 2100, esiEmployer: 4900,
        },
        {
          employeeName: "Karthik Reddy",
          employeeCode: "EMP-003",
          month: "2026-07",
          pfNumber: "PF/HYD/123456/002",
          esiNumber: "ESI-4100123458",
          pfWage: 18000, pfEmployee: 2160, pfEmployer: 2160,
          esiWage: 18000, esiEmployee: 1350, esiEmployer: 3150,
        },
      ],
    });
  }

  if ((await prisma.healthCheckRecord.count()) === 0) {
    await prisma.healthCheckRecord.createMany({
      data: [
        {
          employeeName: "Ravi Sharma", employeeCode: "EMP-001",
          checkDate: new Date(corpNow.getTime() - 45 * 86400000),
          bloodPressure: "120/80", vision: "6/6", audiometry: "Normal",
          weightKg: 72, fitnessStatus: "FIT", conductedBy: "Dr. Meera Iyer",
        },
        {
          employeeName: "Karthik Reddy", employeeCode: "EMP-003",
          checkDate: new Date(corpNow.getTime() - 45 * 86400000),
          bloodPressure: "138/92", vision: "6/9", audiometry: "Mild loss - 4kHz",
          weightKg: 81, fitnessStatus: "FIT_WITH_NOTES",
          notes: "Review BP quarterly; ear protection mandatory.", conductedBy: "Dr. Meera Iyer",
        },
      ],
    });
  }

  if ((await prisma.environmentalRecord.count()) === 0) {
    await prisma.environmentalRecord.createMany({
      data: [
        {
          recordType: "PERMIT", title: "Consent to Operate - Telangana PCB",
          permitNumber: "TS-PCB/CTO/2026/0412", complianceStatus: "COMPLIANT",
          recordedAt: new Date(corpNow.getTime() - 30 * 86400000),
          dueDate: new Date(corpNow.getTime() + 240 * 86400000), owner: "EHS Cell",
        },
        {
          recordType: "WASTE", title: "Hazardous waste disposal - Used coolant",
          description: "TSDF pickup certified.", complianceStatus: "COMPLIANT",
          recordedAt: new Date(corpNow.getTime() - 12 * 86400000), owner: "EHS Cell",
        },
        {
          recordType: "EFFLUENT", title: "STP outlet sampling - Q2",
          description: "BOD/COD within limits.", complianceStatus: "PARTIAL",
          recordedAt: new Date(corpNow.getTime() - 6 * 86400000),
          dueDate: new Date(corpNow.getTime() + 15 * 86400000), owner: "Maintenance",
        },
      ],
    });
  }

  if ((await prisma.fireDrillRecord.count()) === 0) {
    await prisma.fireDrillRecord.createMany({
      data: [
        {
          drillDate: new Date(corpNow.getTime() - 20 * 86400000), location: "Plant A - All Blocks",
          participants: 148, durationMin: 18, passed: true, conductedBy: "Fire Officer - R. Ganesh",
        },
        {
          drillDate: new Date(corpNow.getTime() - 200 * 86400000), location: "Machine Shop Block",
          participants: 96, durationMin: 15, passed: true, conductedBy: "Fire Officer - R. Ganesh",
        },
      ],
    });
  }

  if ((await prisma.eximShipment.count()) === 0) {
    await prisma.eximShipment.createMany({
      data: [
        {
          shipmentNumber: "EXP-2026-041", shipmentType: "EXPORT", mode: "AIR", incoterm: "FOB",
          port: "HYD Air Cargo", invoiceNumber: "INV-2026-114", customerName: "Global Industries",
          customsValue: 48250, currency: "USD",
          shipmentDate: new Date(corpNow.getTime() - 5 * 86400000), status: "IN_TRANSIT",
        },
        {
          shipmentNumber: "EXP-2026-042", shipmentType: "EXPORT", mode: "SEA", incoterm: "CIF",
          port: "Nhava Sheva", invoiceNumber: "INV-2026-121", customerName: "Aerospace Systems GmbH",
          customsValue: 127500, currency: "EUR",
          shipmentDate: new Date(corpNow.getTime() + 2 * 86400000), status: "BOOKED",
        },
        {
          shipmentNumber: "IMP-2026-017", shipmentType: "IMPORT", mode: "AIR", incoterm: "DDP",
          port: "HYD Air Cargo", invoiceNumber: "PO-IMP-88", customerName: "Mitsubishi Materials",
          customsValue: 18500, currency: "JPY",
          shipmentDate: new Date(corpNow.getTime() - 3 * 86400000), status: "CLEARED",
        },
      ],
    });
  }

  if ((await prisma.investorUpdate.count()) === 0) {
    await prisma.investorUpdate.createMany({
      data: [
        {
          quarter: "Q1 FY27", headline: "Record order intake across Aero & Defence",
          revenue: 285000000, ebitda: 51200000, netProfit: 28400000, ordersBooked: 410000000,
          summary: "Aerospace share crossed 62% of revenue; two new Nadcap-accredited lines added.",
          publishedAt: new Date(corpNow.getTime() - 21 * 86400000),
        },
        {
          quarter: "Q4 FY26", headline: "FY26 revenue up 18% YoY",
          revenue: 268000000, ebitda: 46300000, netProfit: 25100000, ordersBooked: 335000000,
          summary: "Export sales grew 31% driven by EU and SE Asia programs.",
          publishedAt: new Date(corpNow.getTime() - 112 * 86400000),
        },
      ],
    });
  }

  if ((await prisma.budgetLine.count()) === 0) {
    await prisma.budgetLine.createMany({
      data: [
        { fiscalYear: "FY27", department: "Production", category: "Consumables", allocated: 42000000, spent: 12300000, notes: "Tooling & inserts." },
        { fiscalYear: "FY27", department: "Maintenance", category: "Spares", allocated: 18500000, spent: 6400000 },
        { fiscalYear: "FY27", department: "Quality", category: "Metrology", allocated: 9600000, spent: 2100000, notes: "CMM calibration contract." },
        { fiscalYear: "FY27", department: "IT", category: "Infrastructure", allocated: 14500000, spent: 7200000, notes: "Network refresh + backups." },
      ].map((r: any) => toPaiseRow("BudgetLine", r)),
    });
  }

  // Risk register — demo risks (one with an overdue review so the digest,
  // the bell and the MRM agenda surface it on first run).
  if ((await prisma.riskRegister.count()) === 0) {
    const now = new Date();
    const d = (days: number) => {
      const x = new Date(now);
      x.setDate(x.getDate() + days);
      return x;
    };
    await prisma.riskRegister.createMany({
      data: [
        {
          riskCode: "RK-2026-001",
          title: "Key statutory consent renewal slippage (SPCB / CLRA)",
          category: "COMPLIANCE",
          description: "Consent and licence renewals depend on one coordinator; a slip blocks dispatch.",
          likelihood: 4,
          impact: 5,
          riskScore: 20,
          riskLevel: "CRITICAL",
          owner: "EHS Head",
          mitigation: "Renewal calendar in the compliance digest; 90-day alerting; second approver.",
          contingency: "Fast-track liaison with board office; interim permission letter.",
          status: "OPEN",
          reviewDueAt: d(-5), // overdue — flags digest + bell
          createdBy: "System Admin",
        },
        {
          riskCode: "RK-2026-002",
          title: "Single-source supplier concentration (critical raw material)",
          category: "SUPPLY",
          description: "Two critical forgings bought from one vendor with no qualified alternate.",
          likelihood: 4,
          impact: 3,
          riskScore: 12,
          riskLevel: "HIGH",
          owner: "SCM Head",
          mitigation: "Vendor qualification programme for a second source; 8-week buffer stock.",
          contingency: "Spot purchase at premium via rate contract; expedited freight.",
          status: "OPEN",
          reviewDueAt: d(40),
          createdBy: "System Admin",
        },
        {
          riskCode: "RK-2026-003",
          title: "Single-point backup failure on embedded database",
          category: "IT",
          description: "Backup chain depends on one nightly job; restore drills are quarterly.",
          likelihood: 3,
          impact: 2,
          riskScore: 6,
          riskLevel: "MEDIUM",
          owner: "IT Admin",
          mitigation: "Keep-30 rotation + physical fallback + scheduled restore drills.",
          contingency: "Quarantine + physical restore path proven in drill.",
          status: "OPEN",
          reviewDueAt: d(75),
          createdBy: "System Admin",
        },
      ],
    });
  }

  if ((await prisma.treasuryTransaction.count()) === 0) {
    await prisma.treasuryTransaction.createMany({
      data: [
        { date: new Date(corpNow.getTime() - 1 * 86400000), type: "INFLOW", account: "Main", amount: 8400000, reference: "REC-2026-331", category: "Customer Receipt", notes: "Global Industries - ADV 40%." },
        { date: new Date(corpNow.getTime() - 2 * 86400000), type: "OUTFLOW", account: "Main", amount: 2150000, reference: "PYMT-2026-118", category: "Supplier Payment", notes: "AeroHeat Treat Ltd." },
        { date: new Date(corpNow.getTime() - 4 * 86400000), type: "OUTFLOW", account: "Payroll", amount: 6800000, reference: "PAY-2026-07", category: "Payroll", notes: "July salary disbursal." },
        { date: new Date(corpNow.getTime() - 6 * 86400000), type: "INFLOW", account: "Main", amount: 4120000, reference: "REC-2026-327", category: "Customer Receipt", notes: "Aerospace Systems GmbH - Milestone 2." },
      ].map((r: any) => toPaiseRow("TreasuryTransaction", r)),
    });
  }

  if ((await prisma.utilityReading.count()) === 0) {
    await prisma.utilityReading.createMany({
      data: [
        { utilityType: "POWER", meterName: "Main HT Meter", reading: 124850, unit: "kWh", cost: 1264000, readAt: new Date(corpNow.getTime() - 1 * 86400000) },
        { utilityType: "COMPRESSED_AIR", meterName: "Compressor C-01", reading: 9820, unit: "Nm3", cost: 84000, readAt: new Date(corpNow.getTime() - 1 * 86400000) },
        { utilityType: "WATER", meterName: "Borewell M-2", reading: 4120, unit: "KL", cost: 61000, readAt: new Date(corpNow.getTime() - 1 * 86400000) },
        { utilityType: "HVAC", meterName: "QC Lab AHU", reading: 2310, unit: "kWh", cost: 42000, readAt: new Date(corpNow.getTime() - 1 * 86400000) },
      ],
    });
  }

  if ((await prisma.sparePart.count()) === 0) {
    await prisma.sparePart.createMany({
      data: [
        { sku: "SP-SPL-001", name: "Spindle Belt 5VX-710", machineCode: "CNC-01", currentQty: 6, minQty: 4, unitCost: 1850, supplierName: "Power Transmissions Co", location: "Stores Rack B3" },
        { sku: "SP-HYD-014", name: "Hydraulic Filter HF-6420", machineCode: "HYD-02", currentQty: 2, minQty: 5, unitCost: 940, supplierName: "Fluid Power Systems", location: "Stores Rack A1", notes: "Below min - reorder." },
        { sku: "SP-EL-009", name: "VFD Cooling Fan", machineCode: "CNC-03", currentQty: 12, minQty: 3, unitCost: 460, supplierName: "Control Gear India", location: "Stores Rack C2" },
        { sku: "SP-LB-003", name: "Gearbox Oil 68L Drum", machineCode: "GEN", currentQty: 3, minQty: 2, unitCost: 28500, supplierName: "Lubricants Ltd", location: "Oil Store" },
      ],
    });
  }

  if ((await prisma.contract.count()) === 0) {
    await prisma.contract.createMany({
      data: [
        {
          contractNumber: "CTR-AERO-2026-118", customerName: "Global Industries",
          title: "Titanium Bracket Series - 3 year frame", value: 85000000, currency: "INR",
          startDate: new Date(corpNow.getTime() - 200 * 86400000),
          endDate: new Date(corpNow.getTime() + 895 * 86400000),
          poReference: "PO-GI-1187", status: "ACTIVE",
        },
        {
          contractNumber: "CTR-DEF-2026-042", customerName: "DRDO Node",
          title: "Radar housing machining L1", value: 120000000, currency: "INR",
          startDate: new Date(corpNow.getTime() - 60 * 86400000),
          endDate: new Date(corpNow.getTime() + 1240 * 86400000),
          poReference: "PO-DRDO-042", status: "ACTIVE",
        },
        {
          contractNumber: "CTR-EU-2025-301", customerName: "Aerospace Systems GmbH",
          title: "Sensor housing - serialized", value: 2300000, currency: "EUR",
          startDate: new Date(corpNow.getTime() - 400 * 86400000),
          endDate: new Date(corpNow.getTime() - 35 * 86400000),
          poReference: "PO-AS-301", status: "COMPLETED",
        },
      ],
    });
  }

  if ((await prisma.infrastructureAsset.count()) === 0) {
    await prisma.infrastructureAsset.createMany({
      data: [
        { assetType: "SERVER", name: "App Server - PRD-01", ipAddress: "10.10.1.11", location: "Server Room", status: "OPERATIONAL", warrantyUntil: new Date(corpNow.getTime() + 300 * 86400000) },
        { assetType: "NETWORK", name: "Core Switch - CORE-1", ipAddress: "10.10.0.1", location: "Server Room", status: "OPERATIONAL" },
        { assetType: "WORKSTATION", name: "QC-04 CAD Station", ipAddress: "10.10.4.42", location: "QC Lab", status: "DEGRADED", notes: "GPU fan noisy." },
        { assetType: "SERVER", name: "File Server - NAS-01", ipAddress: "10.10.1.12", location: "Server Room", status: "OPERATIONAL" },
        { assetType: "UPS", name: "UPS - Machine Shop (200kVA)", location: "Machine Shop", status: "OPERATIONAL", warrantyUntil: new Date(corpNow.getTime() - 10 * 86400000), notes: "Warranty expired - renew AMC." },
        { assetType: "PRINTER", name: "Engineering Plotter", ipAddress: "10.10.6.9", location: "Drawing Office", status: "OFFLINE", notes: "Awaiting service." },
      ],
    });
  }

  if ((await prisma.backupJob.count()) === 0) {
    await prisma.backupJob.createMany({
      data: [
        { startedAt: new Date(corpNow.getTime() - 1 * 86400000), completedAt: new Date(corpNow.getTime() - 1 * 86400000 + 3600000), status: "SUCCESS", sizeMb: 18420, target: "PostgreSQL" },
        { startedAt: new Date(corpNow.getTime() - 2 * 86400000), completedAt: new Date(corpNow.getTime() - 2 * 86400000 + 3600000), status: "SUCCESS", sizeMb: 18310, target: "PostgreSQL" },
        { startedAt: new Date(corpNow.getTime() - 3 * 86400000), completedAt: null, status: "FAILED", sizeMb: null, target: "PostgreSQL", notes: "Connection timeout - retried next window." },
      ],
    });
  }

  console.log("34. Seeding Recruitment, QMS Audits & Marketing modules...");

  if ((await prisma.jobRequisition.count()) === 0) {
    const reqMachinist = await prisma.jobRequisition.create({
      data: { title: "CNC Machinist (5-Axis)", department: "Production", openings: 3, location: "Unit 1", status: "OPEN", postedAt: new Date(corpNow.getTime() - 20 * 86400000), notes: "Experience with Siemens controls preferred." },
    });
    const reqQc = await prisma.jobRequisition.create({
      data: { title: "Quality Inspector", department: "Quality", openings: 1, location: "Unit 1", status: "FILLED", postedAt: new Date(corpNow.getTime() - 90 * 86400000), notes: "AS9102 FAI experience required." },
    });
    await prisma.jobRequisition.create({
      data: { title: "Application Engineer", department: "R&D", openings: 2, location: "Unit 2", status: "ON_HOLD", postedAt: new Date(corpNow.getTime() - 40 * 86400000), notes: "Reopening expected next quarter." },
    });

    await prisma.candidate.create({
      data: { requisitionId: reqMachinist.id, name: "Suresh Kumar", email: "suresh.k@example.com", phone: "+91 90000 11111", stage: "SCREENING", source: "LINKEDIN", appliedAt: new Date(corpNow.getTime() - 5 * 86400000) },
    });
    const c2 = await prisma.candidate.create({
      data: { requisitionId: reqMachinist.id, name: "Anita Deshmukh", email: "anita.d@example.com", phone: "+91 90000 22222", stage: "INTERVIEW", source: "JOB_PORTAL", appliedAt: new Date(corpNow.getTime() - 12 * 86400000), notes: "Strong GD&T background." },
    });
    const c3 = await prisma.candidate.create({
      data: { requisitionId: reqQc.id, name: "Vikram Rao", email: "vikram.r@example.com", phone: "+91 90000 33333", stage: "OFFER", source: "REFERRAL", appliedAt: new Date(corpNow.getTime() - 30 * 86400000), notes: "Offer extended - awaiting acceptance." },
    });
    const c4 = await prisma.candidate.create({
      data: { requisitionId: reqQc.id, name: "Deepa Menon", email: "deepa.m@example.com", phone: "+91 90000 44444", stage: "HIRED", source: "AGENCY", appliedAt: new Date(corpNow.getTime() - 60 * 86400000), notes: "Joined 2 weeks ago." },
    });
    await prisma.candidate.create({
      data: { requisitionId: reqMachinist.id, name: "Rahul Verma", email: "rahul.v@example.com", phone: "+91 90000 55555", stage: "REJECTED", source: "CAMPUS", appliedAt: new Date(corpNow.getTime() - 25 * 86400000), notes: "Lack of CNC experience." },
    });

    await prisma.interview.createMany({
      data: [
        { candidateId: c2.id, scheduledAt: new Date(corpNow.getTime() + 2 * 86400000), interviewType: "TECHNICAL", panelist: "R. Ganesh", status: "SCHEDULED" },
        { candidateId: c3.id, scheduledAt: new Date(corpNow.getTime() - 10 * 86400000), interviewType: "HR", panelist: "Priya Nair", feedback: "Excellent - recommended hire.", status: "DONE" },
      ],
    });

    await prisma.onboardingTask.createMany({
      data: [
        { candidateId: c4.id, task: "Issue ID badge & safety shoes", dueDate: new Date(corpNow.getTime() - 14 * 86400000), done: true },
        { candidateId: c4.id, task: "AS9100 awareness induction", dueDate: new Date(corpNow.getTime() - 10 * 86400000), done: true },
        { candidateId: c4.id, task: "Calibrated tool usage training", dueDate: new Date(corpNow.getTime() + 5 * 86400000), done: false },
      ],
    });
  }

  if ((await prisma.qmsAudit.count()) === 0) {
    const audit1 = await prisma.qmsAudit.create({
      data: {
        auditNumber: "AUD-2026-001", title: "Annual AS9100 Surveillance - Quality Dept",
        standard: "AS9100", auditType: "SURVEILLANCE", auditor: "R. Ganesh", auditeeDept: "Quality",
        scheduledDate: new Date(corpNow.getTime() - 25 * 86400000),
        completedAt: new Date(corpNow.getTime() - 20 * 86400000),
        status: "COMPLETED", result: "PASS_WITH_FINDINGS",
        notes: "Two minor findings - calibration records and training matrix.",
      },
    });
    await prisma.qmsAudit.create({
      data: {
        auditNumber: "AUD-2026-002", title: "ISO 9001 Internal Audit - Production",
        standard: "ISO9001", auditType: "INTERNAL", auditor: "S. Iyer", auditeeDept: "Production",
        scheduledDate: new Date(corpNow.getTime() + 14 * 86400000),
        status: "PLANNED", notes: "Scope: 8.5.1 Production provision.",
      },
    });

    const ncr = await prisma.ncrReport.findFirst();
    await prisma.qmsAuditFinding.createMany({
      data: [
        {
          auditId: audit1.id, clause: "AS9100D 7.1.5.1",
          description: "Calibration certificate archive missing for torque wrench CAL-TW-014.",
          severity: "MINOR", status: "OPEN",
          correctiveAction: "Upload certificate to Metrology cert archive.",
          dueDate: new Date(corpNow.getTime() + 15 * 86400000),
        },
        {
          auditId: audit1.id, clause: "AS9100D 7.2",
          description: "Training matrix not updated for new inspector joiners.",
          severity: "MINOR", status: "IN_PROGRESS",
          correctiveAction: "Update certification register in Admin > Certifications.",
          dueDate: new Date(corpNow.getTime() + 20 * 86400000),
        },
        {
          auditId: audit1.id, clause: "AS9100D 8.7.1.4",
          description: "Non-conforming material disposition not linked to NCR for last lot.",
          severity: "MAJOR", status: "OPEN",
          correctiveAction: "Link disposition to NCR and close loop.",
          ncrId: ncr?.id || null,
          dueDate: new Date(corpNow.getTime() + 10 * 86400000),
        },
      ],
    });
  }

  if ((await prisma.marketingCampaign.count()) === 0) {
    const camp1 = await prisma.marketingCampaign.create({
      data: { name: "AeroDef 2026 Trade Show", channel: "TRADE_SHOW", budget: 2500000, spent: 1450000, status: "ACTIVE", startDate: new Date(corpNow.getTime() - 30 * 86400000), endDate: new Date(corpNow.getTime() + 20 * 86400000), notes: "Booth B-412, Bengaluru." },
    });
    const camp2 = await prisma.marketingCampaign.create({
      data: { name: "Q3 Digital Campaign - Nadcap Capability", channel: "DIGITAL", budget: 800000, spent: 220000, status: "ACTIVE", startDate: new Date(corpNow.getTime() - 10 * 86400000), endDate: new Date(corpNow.getTime() + 50 * 86400000) },
    });

    await prisma.lead.createMany({
      data: [
        { company: "Skyline Aerospace", contactName: "John Carter", phone: "+1 555 0101", email: "j.carter@skyline.example", campaignId: camp1.id, source: "TRADE_SHOW", status: "QUALIFIED", value: 4500000, at: new Date(corpNow.getTime() - 12 * 86400000) },
        { company: "Titan Forge", contactName: "Meera Pillai", phone: "+91 98100 00001", email: "meera@titanforge.example", campaignId: camp2.id, source: "WEBSITE", status: "NEW", value: 1200000, at: new Date(corpNow.getTime() - 3 * 86400000) },
        { company: "Helix Components", contactName: "David Lin", phone: "+65 9000 1234", email: "d.lin@helix.example", source: "REFERRAL", status: "PROPOSAL", value: 2800000, at: new Date(corpNow.getTime() - 20 * 86400000) },
      ],
    });
  }

  console.log("Recruitment (5 candidates, 3 requisitions), QMS (2 audits, 3 findings) and Marketing (2 campaigns, 3 leads) seeded.");

  console.log("35. Seeding Salary Structures...");
  const salarySeeds = [
    { employeeName: "Ravi Sharma", employeeCode: "EMP-001", designation: "CNC Operator", basicPay: 21000, hra: 8400, specialAllowance: 4000, conveyance: 1600, otherAllowance: 0, pfPercent: 12, professionalTax: 200 },
    { employeeName: "Priya Nair", employeeCode: "EMP-002", designation: "Quality Inspector", basicPay: 28000, hra: 11200, specialAllowance: 5500, conveyance: 1600, otherAllowance: 1200, pfPercent: 12, professionalTax: 200 },
    { employeeName: "Karthik Reddy", employeeCode: "EMP-003", designation: "CNC Operator", basicPay: 18000, hra: 7200, specialAllowance: 3000, conveyance: 1600, otherAllowance: 0, pfPercent: 12, professionalTax: 200 },
  ];
  for (const s of salarySeeds) {
    await prisma.salaryStructure.upsert({
      where: { employeeCode: s.employeeCode },
      update: {},
      create: s,
    });
  }
  console.log("3 Salary Structures seeded (CTC breakup ready for payslip generation).");

  console.log("36. Seeding Supplier Scorecards & Time Studies...");
  if ((await prisma.supplierScorecard.count()) === 0) {
    // Same weighted formula as the scorecard API (35% OTD, 35% PPM, 15% cost, 15% responsiveness).
    const scoreOf = (d: any) => {
      const otd = Math.min(100, Math.max(0, Number(d.onTimeDelivery) || 0));
      const ppm = Math.min(100, Math.max(0, 100 - (Number(d.qualityPpm) || 0) / 1000));
      const cost = Math.min(100, Math.max(0, 100 - Math.abs(Number(d.costVariance) || 0)));
      const resp = Math.min(5, Math.max(1, Number(d.responsiveness) || 3)) * 20;
      const overallScore = Math.round((0.35 * otd + 0.35 * ppm + 0.15 * cost + 0.15 * resp) * 10) / 10;
      const grade = overallScore >= 90 ? "A" : overallScore >= 75 ? "B" : overallScore >= 60 ? "C" : "D";
      return { overallScore, grade };
    };
    const scorecardSeeds = [
      { supplierName: "Global Steel Co", period: "Q2 FY27", onTimeDelivery: 94, qualityPpm: 2500, costVariance: 2.5, responsiveness: 4, notes: "Steady performer; minor cost drift." },
      { supplierName: "Power Transmissions Co", period: "Q2 FY27", onTimeDelivery: 88, qualityPpm: 8200, costVariance: -1.2, responsiveness: 3, notes: "Watch quality PPM trend." },
      { supplierName: "Fluid Power Systems", period: "Q2 FY27", onTimeDelivery: 55, qualityPpm: 32000, costVariance: 14.5, responsiveness: 1, notes: "Below threshold - improvement plan issued, risk supplier." },
      { supplierName: "AeroHeat Treat Ltd", period: "Q2 FY27", onTimeDelivery: 97, qualityPpm: 900, costVariance: 0.8, responsiveness: 5, notes: "Nadcap approved, top performer." },
    ];
    await prisma.supplierScorecard.createMany({
      data: scorecardSeeds.map((s) => ({ ...s, ...scoreOf(s) })),
    });
  }

  if ((await prisma.timeStudy.count()) === 0) {
    await prisma.timeStudy.createMany({
      data: [
        { productSku: "AERO-BRK-001", operationName: "OP10 - Face Milling", department: "Machining", standardTimeMin: 4.5, measuredTimeMin: 4.9, sampleSize: 12 },
        { productSku: "AERO-BRK-001", operationName: "OP20 - Drilling & Tapping", department: "Machining", standardTimeMin: 3.2, measuredTimeMin: 3.1, sampleSize: 12 },
        { operationName: "OP30 - Deburr & Final Wash", department: "Assembly", standardTimeMin: 2.0, measuredTimeMin: 2.4, sampleSize: 8 },
        { productSku: "AERO-HSG-002", operationName: "OP10 - CNC Turning", department: "Machining", standardTimeMin: 6.8, measuredTimeMin: 7.2, sampleSize: 10 },
      ],
    });
  }
  console.log("4 Supplier Scorecards and 4 Time Studies seeded.");

  console.log("37. Seeding Escalations...");
  if ((await prisma.escalation.count()) === 0) {
    const ncr = await prisma.ncrReport.findFirst({ orderBy: { raisedAt: "asc" } });
    const seeds: any[] = [
      {
        sourceType: "CUSTOM",
        sourceId: "custom-001",
        title: "Customer insists on 2-week early delivery of WO-2026-004",
        severity: "HIGH",
        status: "OPEN",
        escalatedAt: new Date(corpNow.getTime() - 2 * 86400000),
        dueDate: new Date(corpNow.getTime() + 7 * 86400000),
        notes: "Sales committed the date; capacity plan needs re-leveling.",
      },
      ...(ncr
        ? [{
            sourceType: "NCR",
            sourceId: ncr.id,
            title: `Open NCR ${ncr.ncrNumber} — supplier material awaiting disposition`,
            severity: ncr.severity || "MEDIUM",
            status: "ACKNOWLEDGED",
            escalatedAt: new Date(corpNow.getTime() - 4 * 86400000),
            dueDate: new Date(corpNow.getTime() + 5 * 86400000),
            notes: "MRB scheduled Friday; customer approval needed for use-as-is.",
          }]
        : []),
    ];
    for (const s of seeds) {
      await prisma.escalation.create({ data: s });
    }
    console.log(`Escalations seeded (${seeds.length}) — open NCR linked for MRB visibility.`);
  }

  console.log("38. Seeding Quality & AP suites (8D, PPAP, Control Plans, GRN, Gage R&R)...");

  // ---- 8D / CAPA (link to first open NCR) ----
  if ((await prisma.eightDReport.count()) === 0) {
    const ncrFor8d = await prisma.ncrReport.findFirst({ orderBy: { raisedAt: "asc" } });
    const report = await prisma.eightDReport.create({
      data: {
        reportNumber: `8D-${new Date().getFullYear()}-0001`,
        ncrId: ncrFor8d?.id || null,
        workOrderId: ncrFor8d?.workOrderId || null,
        productId: ncrFor8d?.productId || p1.id,
        title: "Dimensional drift on machined bore (surface scratch root cause)",
        problemDescription: "Bore diameter out of tolerance on 12 pcs of AERO-BRK-001; found at final QC before dispatch.",
        severity: "HIGH",
        status: "D4_ROOT_CAUSE",
        teamMembers: "Ramesh K (QA), Anil S (Machining), Meera V (Design), Prakash T (Maintenance)",
        containmentAction: "Quarantined 12 pcs in MRB cage; 100% re-inspection of remaining batch before dispatch.",
        containmentOwner: "Ramesh K",
        why1: "Tool wear on boring bar exceeded 0.05mm.",
        why2: "Tool change interval not monitored on this operation.",
        why3: "No tool-life counter wired on CNC station 3.",
        why4: "PM checklist for station 3 omitted tool-life sensor check.",
        why5: "Checklist not updated after last machine migration.",
        rootCauseSummary: "Stale PM checklist after machine migration — no tool-life monitoring on CNC station 3.",
        correctiveAction: "Re-certify station 3; add tool-life counter and operator pre-shift tool check.",
        correctiveOwner: "Prakash T",
        preventiveAction: "Update all PM checklists via ECO; add tool-life sensor check to machine PM templates.",
        preventiveOwner: "Meera V",
        raisedBy: "QA Team",
      },
    });
    await prisma.capaAction.createMany({
      data: [
        { reportId: report.id, type: "CONTAINMENT", description: "Quarantine 12 non-conforming pcs and 100% inspect remaining batch", owner: "Ramesh K", status: "VERIFIED", verifiedBy: "QA Supervisor" },
        { reportId: report.id, type: "CORRECTIVE", description: "Add tool-life counter on CNC station 3 and re-certify", owner: "Prakash T", status: "IN_PROGRESS" },
        { reportId: report.id, type: "PREVENTIVE", description: "Update PM checklists via ECO for all stations", owner: "Meera V", status: "OPEN", dueDate: new Date(corpNow.getTime() + 14 * 86400000) },
      ],
    });
    console.log(`8D report ${report.reportNumber} seeded (linked to ${ncrFor8d?.ncrNumber || "no NCR"}).`);
  }

  // ---- PPAP submissions (AIAG 18 elements) ----
  if ((await prisma.ppapSubmission.count()) === 0) {
    const sub1 = await prisma.ppapSubmission.create({
      data: {
        ppapNumber: `PPAP-${new Date().getFullYear()}-0001`,
        productId: p1.id,
        customerName: "Boeing Defense & Space",
        revision: "A",
        submissionLevel: 3,
        status: "SUBMITTED",
        submittedAt: new Date(corpNow.getTime() - 6 * 86400000),
        createdBy: "Process Engineering",
      },
    });
    const elements1 = [
      "Design Records", "Engineering Change Documents", "Customer Engineering Approval", "Design FMEA",
      "Process Flow Diagram", "Process FMEA", "Control Plan", "Measurement System Analysis Studies",
      "Dimensional Results", "Material / Performance Test Results", "Initial Process Studies",
      "Qualified Laboratory Documentation", "Appearance Approval Report", "Sample Production Parts",
      "Master Sample", "Checking Aids", "Customer-Specific Requirements", "Part Submission Warrant",
    ];
    await prisma.ppapElement.createMany({
      data: elements1.map((name, i) => ({
        ppapId: sub1.id,
        elementNo: i + 1,
        elementName: name,
        status: i < 16 ? "COMPLETE" : i === 16 ? "IN_PROGRESS" : "NOT_STARTED",
      })),
    });

    const sub2 = await prisma.ppapSubmission.create({
      data: {
        ppapNumber: `PPAP-${new Date().getFullYear()}-0002`,
        productId: p2.id,
        customerName: "Tesla Gigafactory Texas",
        revision: "A",
        submissionLevel: 2,
        status: "DRAFT",
        createdBy: "Process Engineering",
      },
    });
    await prisma.ppapElement.createMany({
      data: elements1.map((name, i) => ({ ppapId: sub2.id, elementNo: i + 1, elementName: name, status: "NOT_STARTED" })),
    });
    console.log(`2 PPAP submissions seeded (${sub1.ppapNumber} submitted, ${sub2.ppapNumber} draft).`);
  }

  // ---- Control Plans ----
  if ((await prisma.controlPlan.count()) === 0) {
    await prisma.controlPlan.createMany({
      data: [
        { planNumber: `CP-${new Date().getFullYear()}-0001`, productId: p1.id, revision: "A", status: "ACTIVE", processStep: "OP10 Face Milling", characteristic: "Face flatness", specMin: 0, specMax: 0.05, measurementMethod: "Dial indicator", sampleSize: 5, frequency: "Every 20 pcs", controlMethod: "X-bar R chart", reactionPlan: "Stop, quarantine, rework", responsible: "QA Machining" },
        { planNumber: `CP-${new Date().getFullYear()}-0002`, productId: p1.id, revision: "A", status: "ACTIVE", processStep: "OP20 Drilling", characteristic: "Bore diameter Ø25", specMin: 24.98, specMax: 25.02, measurementMethod: "CMM", sampleSize: 5, frequency: "Every 10 pcs", controlMethod: "X-bar R chart", reactionPlan: "Stop & 100% inspect", responsible: "QA Machining" },
        { planNumber: `CP-${new Date().getFullYear()}-0003`, productId: p2.id, revision: "A", status: "DRAFT", processStep: "OP30 Deburr & Wash", characteristic: "Edge radius R0.5 max", specMin: 0, specMax: 0.5, measurementMethod: "Radius gauge", sampleSize: 3, frequency: "Every 50 pcs", controlMethod: "Attribute check", reactionPlan: "Rework & re-inspect", responsible: "QA Assembly" },
      ],
    });
    console.log("3 Control Plan rows seeded.");
  }

  // ---- GRN + Supplier Invoices (3-way match demo: one MATCHED, one MISMATCHED) ----
  if ((await prisma.goodsReceiptNote.count()) === 0) {
    const po2 = await prisma.purchaseOrder.findUnique({ where: { poNumber: "PO-2026-002" } });
    const po3 = await prisma.purchaseOrder.findUnique({ where: { poNumber: "PO-2026-003" } });

    if (po2 && po3) {
      // GRN-1 against PO-002 (partial receipt continues: 400 + 600 = 1000 = full)
      const grn1 = await prisma.goodsReceiptNote.create({
        data: {
          grnNumber: `GRN-${new Date().getFullYear()}-0001`,
          poId: po2.id,
          supplierId: s2.id,
          rawMaterialId: po2.rawMaterialId,
          receivedQty: 600,
          receivedAt: new Date(corpNow.getTime() - 1 * 86400000),
          receivedBy: "Storekeeper Ram",
          batchNo: "HT-2608-A",
          inspectionStatus: "PASSED",
          inspector: "IQC Lead",
          inspectedAt: new Date(corpNow.getTime() - 1 * 86400000),
        },
      });
      // GRN-2 against PO-003 (full receipt)
      const grn2 = await prisma.goodsReceiptNote.create({
        data: {
          grnNumber: `GRN-${new Date().getFullYear()}-0002`,
          poId: po3.id,
          supplierId: s3.id,
          rawMaterialId: po3.rawMaterialId,
          receivedQty: 300,
          receivedAt: new Date(corpNow.getTime() - 3 * 86400000),
          receivedBy: "Storekeeper Ram",
          batchNo: "NDT-B8831",
          inspectionStatus: "PASSED",
          inspector: "IQC Lead",
          inspectedAt: new Date(corpNow.getTime() - 3 * 86400000),
        },
      });
      // Invoice-1: correct value 300 × 380 = 114,000 + 18% GST → MATCHED
      const inv1 = await prisma.supplierInvoice.create({
        data: toPaiseRow("SupplierInvoice", {
          invoiceNumber: "INV-2026-8831",
          supplierId: s3.id,
          poId: po3.id,
          grnId: grn2.id,
          amount: 114000,
          taxAmount: 20520,
          totalAmount: 134520,
          invoiceDate: new Date(corpNow.getTime() - 2 * 86400000),
          dueDate: new Date(corpNow.getTime() + 28 * 86400000),
          status: "MATCHED",
        }),
      });
      await prisma.goodsReceiptNote.update({ where: { id: grn2.id }, data: { matchStatus: "MATCHED" } });
      // Invoice-2: WRONG value (billed 150,000 instead of 45,000 for PO-002) → MISMATCHED
      const inv2 = await prisma.supplierInvoice.create({
        data: toPaiseRow("SupplierInvoice", {
          invoiceNumber: "INV-2026-7788",
          supplierId: s2.id,
          poId: po2.id,
          grnId: grn1.id,
          amount: 150000,
          taxAmount: 27000,
          totalAmount: 177000,
          invoiceDate: new Date(corpNow.getTime() - 1 * 86400000),
          dueDate: new Date(corpNow.getTime() + 30 * 86400000),
          status: "MISMATCHED",
        }),
      });
      await prisma.goodsReceiptNote.update({ where: { id: grn1.id }, data: { matchStatus: "MISMATCHED" } });
      // Bring the two POs to full RECEIVED (match the seeded 400 + 600 receipt history)
      await prisma.purchaseOrder.update({ where: { id: po2.id }, data: { receivedQty: 1000, status: "RECEIVED" } });
      console.log(`2 GRNs + 2 invoices seeded (${inv1.invoiceNumber} MATCHED, ${inv2.invoiceNumber} MISMATCHED).`);
    }
  }

  // ---- Gage R&R study on the OK micrometer (low %GRR → ACCEPTABLE) ----
  if ((await prisma.gageRnrStudy.count()) === 0) {
    const mic = await prisma.calibratedTool.findFirst({ where: { serialNumber: "CAL-MIC-001" } });
    if (mic) {
      // 3 appraisers × 5 parts × 3 trials around 25.000 (bore Ø25), tiny spread
      const base = [25.001, 25.002, 24.999, 25.000, 25.003];
      const measurements: { appraiser: string; part: number; trial: number; value: number }[] = [];
      for (const appr of ["A", "B", "C"]) {
        for (let p = 0; p < 5; p++) {
          for (let t = 0; t < 3; t++) {
            const noise = (Math.random() - 0.5) * 0.0006;
            const apprBias = appr === "A" ? 0.0001 : appr === "B" ? -0.0001 : 0.0002;
            measurements.push({ appraiser: appr, part: p + 1, trial: t + 1, value: +(base[p] + noise + apprBias).toFixed(4) });
          }
        }
      }
      const { computeGrr } = await import("../src/lib/grr");
      const result = computeGrr(measurements);
      await prisma.gageRnrStudy.create({
        data: {
          studyNumber: `GRR-${new Date().getFullYear()}-0001`,
          toolId: mic.id,
          appraisers: 3,
          parts: 5,
          trials: 3,
          measurements: measurements as any,
          ev: result.ev,
          av: result.av,
          grr: result.grr,
          partVar: result.partVar,
          totalVar: result.totalVar,
          grrPct: result.grrPct,
          ndc: result.ndc,
          verdict: result.verdict,
          conductedBy: "QA Metrology",
          notes: "Bore Ø25 — CMM #2, appraisers A/B/C.",
        },
      });
      console.log(`Gage R&R study seeded on ${mic.name} (%GRR ${result.grrPct}% → ${result.verdict}).`);
    }
  }

  console.log("Adding Quality Objectives & Management Review demo...");
  const periodNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const objectiveRows = [
    { department: "production", kpiType: "OTD_PCT", targetValue: 90, period: periodNow, ownerName: "Production Manager" },
    { department: "production", kpiType: "PPM", targetValue: 1500, period: periodNow, ownerName: "QA Manager" },
    { department: "maintenance", kpiType: "MTBF", targetValue: 40, period: periodNow, ownerName: "Maintenance Head" },
    { department: "people", kpiType: "TRAINING_PCT", targetValue: 60, period: periodNow, ownerName: "HR Manager" },
  ];
  for (const o of objectiveRows) {
    await prisma.qualityObjective.create({ data: o });
  }
  console.log(`Seeded ${objectiveRows.length} quality objectives for ${periodNow}.`);

  // One OPEN MRM with an overdue action item (auto-escalates at close) + one open one.
  const mrmCount = await prisma.mrmMeeting.count();
  if (mrmCount === 0) {
    const mrmNumber = `MRM-${now.getFullYear()}-001`;
    const mrm = await prisma.mrmMeeting.create({
      data: {
        meetingNumber: mrmNumber,
        title: "Monthly Management Review — Quality & Delivery",
        date: daysAgo(2),
        attendees: [
          { name: "System Admin", role: "Plant Head" },
          { name: "Sarah Jenkins", role: "Quality Manager" },
          { name: "Mike Ross", role: "Production Supervisor" },
        ],
        agenda: [
          { title: "Review previous action items", detail: "Status of open actions from last review", severity: "info", source: "MRM Standard" },
          { title: "Open NCRs and CAPA status", detail: "Review non-conformance backlog and 8D progress", severity: "warning", source: "Quality" },
          { title: "Quality objective performance", detail: "Actuals vs targets for the current month", severity: "warning", source: "Quality Objective" },
        ],
        minutesBy: "System Admin",
        status: "OPEN",
      },
    });
    await prisma.mrmActionItem.create({
      data: {
        meetingId: mrm.id,
        description: "Resolve disputed shift count on CNC Milling Center 1 and close the reconciliation",
        ownerName: "Mike Ross",
        dueDate: daysAgo(1),
        priority: "HIGH",
      },
    });
    await prisma.mrmActionItem.create({
      data: {
        meetingId: mrm.id,
        description: "Update calibration schedule for gauges expiring within 30 days",
        ownerName: "Sarah Jenkins",
        dueDate: daysAhead(5),
        priority: "MEDIUM",
      },
    });
    console.log(`Seeded ${mrmNumber} with 2 action items (1 overdue for auto-escalation demo).`);
  }

  console.log("Seeding Tooling & Fixture Register + Drawing Transmittal...");
  if ((await prisma.fixture.count()) === 0 && p1 && p2 && p3) {
    await prisma.fixture.create({
      data: {
        code: "FIX-MILL-01",
        name: "Housing Milling Fixture",
        productId: p1.id,
        machineId: cnc1.id,
        status: "AVAILABLE",
        location: "Tool Room Rack B3",
        procurementCost: 85000,
        notes: "Vise + datum plate set for aluminum housing family.",
      },
    });
    await prisma.fixture.create({
      data: {
        code: "FIX-MOLD-02",
        name: "Enclosure Molding Jig",
        productId: p2.id,
        machineId: imm2.id,
        status: "UNDER_MAINT",
        location: "Maintenance Bay",
        procurementCost: 120000,
        notes: "Pins worn — recalibration in progress (blocks WO start).",
      },
    });
    await prisma.fixture.create({
      data: {
        code: "FIX-WELD-03",
        name: "Chassis Weld Fixture",
        productId: p3.id,
        machineId: rob3.id,
        status: "MISSING",
        location: "Unknown",
        procurementCost: 160000,
        notes: "Not returned after last shift — search in progress (blocks WO start).",
      },
    });
    console.log("3 fixtures seeded (1 AVAILABLE, 1 UNDER_MAINT, 1 MISSING).");
  }

  // P3 — a released REV 2 drawing awaiting Production + Quality acknowledgement.
  // The p1 milling blueprint is the seeded REV 1; clone it as REV 2 with a transmittal.
  if ((await prisma.drawingTransmittal.count()) === 0) {
    const docV1 = await prisma.document.findFirst({ where: { title: { contains: "Gear Housing" } } });
    if (docV1) {
      // The REV 1 drawing is superseded by REV 2 — only REV 2 stays CURRENT.
      await prisma.document.update({ where: { id: docV1.id }, data: { status: "ARCHIVED" } });
      const docV2 = await prisma.document.create({
        data: {
          title: docV1.title.replace("Blueprint", "Blueprint") + "",
          productId: docV1.productId,
          operationId: docV1.operationId,
          version: 2,
          mimeType: docV1.mimeType,
          fileData: docV1.fileData,
          sizeKb: docV1.sizeKb,
          status: "CURRENT",
          uploadedBy: "Engineering Admin",
          uploadedAt: daysAgo(1),
          notes: "REV 2 — revised coolant hole datum; transmittal pending Production + Quality ack.",
        },
      });
      await prisma.drawingTransmittal.create({
        data: {
          documentId: docV2.id,
          revision: 2,
          releasedBy: "Engineering Admin",
          releasedAt: daysAgo(1),
        },
      });
      console.log("REV 2 drawing released — transmittal awaiting Production + Quality acknowledgement.");
    }
  }

  console.log("Seeding Core System & Onboarding Settings...");
  await prisma.setting.upsert({
    where: { key: "onboardingComplete" },
    update: { value: "true" },
    create: { key: "onboardingComplete", value: "true" },
  });
  await prisma.setting.upsert({
    where: { key: "onboardingSkipped" },
    update: { value: "false" },
    create: { key: "onboardingSkipped", value: "false" },
  });
  await prisma.setting.upsert({
    where: { key: "companyCurrency" },
    update: {},
    create: { key: "companyCurrency", value: "INR" },
  });

  console.log("Seeding Chart of Accounts...");
  const coaCount = await prisma.glAccount.count();
  if (coaCount === 0) {
    await prisma.glAccount.createMany({
      data: DEFAULT_COA.map((a) => ({ ...a, isSystem: true, createdBy: "seed" })),
    });
    console.log(`Seeded ${DEFAULT_COA.length} GL accounts.`);
  } else {
    console.log(`Chart of accounts already present (${coaCount} accounts) — skipping.`);
  }

  async function alignDocumentCounters() {
  // Seeded documents predate the SequenceCounter module: fresh databases would
  // collide (P2002) on the first new PO/GRN/INV/SO/JE. Walk each document table,
  // find the highest YYYY-NNNN suffix, and point the counter past it.
  const year = new Date().getFullYear();
  const maps: Record<string, { model: string; field: string }> = {
    PO: { model: "purchaseOrder", field: "poNumber" },
    GRN: { model: "goodsReceiptNote", field: "grnNumber" },
    INV: { model: "invoice", field: "invoiceNumber" },
    SO: { model: "salesOrder", field: "orderNumber" },
    JE: { model: "journalEntry", field: "entryNumber" },
  };
  console.log("Aligning document sequence counters...");
  for (const [prefix, { model, field }] of Object.entries(maps)) {
    const rows = await (prisma as any)[model].findMany({
      where: { [field]: { startsWith: `${prefix}-${year}-` } },
      select: { [field]: true },
    });
    const nums = rows
      .map((r: any) => parseInt(String(r[field]).split("-").pop() || "0", 10))
      .filter((n: number) => Number.isFinite(n));
    if (nums.length === 0) continue;
    const maxSeq = Math.max(...nums);
    const counterId = `${prefix}-${year}`;
    const counter = await prisma.sequenceCounter.findUnique({ where: { id: counterId } });
    if (!counter) {
      await prisma.sequenceCounter.create({ data: { id: counterId, nextVal: maxSeq + 1 } });
      console.log(`  ${counterId} counter created → ${maxSeq + 1}`);
    } else if ((counter as any).nextVal <= maxSeq) {
      await prisma.sequenceCounter.update({ where: { id: counterId }, data: { nextVal: maxSeq + 1 } });
      console.log(`  ${counterId} → ${maxSeq + 1} (was ${(counter as any).nextVal})`);
    }
  }
}

await alignDocumentCounters();

console.log("Enterprise MES database seed complete!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
