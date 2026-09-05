/**
 * C10-4 — Typed Reports Transaction Adapters (DEPTH_03 F1 / F12).
 * Strictly typed database adapters connecting Prisma Client to pure report engines:
 * - getMorningDigestTx: Timezone-aware executive morning digest with anomaly detection
 * - getProductionRegisterTx: Production logs aggregation and completion rates
 * - getStockValuationRegisterTx: Raw materials inventory valuation in integer paise
 * - getJobProfitabilityRegisterTx: Work order job costing and gross margins
 * - getJobTravelerPrintDataTx: High-fidelity job traveler with in-tx audit logging
 * Zero `as any` casts, fixed-point paise, typed Result envelopes.
 */

import type { PrismaClient } from "@prisma/client";
import { notFound, validation } from "../core/errors";
import { buildAuditEvent, type AuditEventInput } from "../core/audit";
import { toPaise } from "../money";
import { PLANT_TZ_OFFSET_MS, getPlantLocalDate } from "../plantTz";
import {
  calculateMachineOee,
  aggregatePlantOee,
  detectOvernightAnomalies,
  assembleMorningDigest,
  type MorningDigestDto,
} from "./digest";
import {
  buildProductionRegister,
  buildStockValuationRegister,
  calculateJobProfitability,
  type ProductionRegisterDto,
  type ProductionLogRowInput,
  type StockValuationRegisterDto,
  type StockItemInput,
  type JobProfitabilityDto,
} from "./registers";
import {
  formatJobTraveler,
  type JobTravelerDto,
  type JobTravelerRawInput,
  type TravelerRoutingStep,
  type TravelerDimension,
} from "./printTraveler";

type Tx = import("@prisma/client").Prisma.TransactionClient;

async function audit(tx: Tx, input: AuditEventInput): Promise<void> {
  const ev = buildAuditEvent(input);
  await tx.auditLog.create({
    data: {
      actor: ev.actor,
      action: ev.action,
      entityType: ev.entityType,
      entityId: ev.entityId,
      details: ev.details ?? "",
      at: ev.at,
    },
  });
}

export interface ReportsActor {
  id: string;
  name?: string;
}

// ------------------------------------------------------------------ 1. Morning Digest Adapter

export async function getMorningDigestTx(
  db: PrismaClient,
  opts: { plantId?: string; targetDate?: Date; tzOffsetMs?: number } = {},
): Promise<MorningDigestDto> {
  const tzOffset = opts.tzOffsetMs ?? PLANT_TZ_OFFSET_MS;
  const targetDate = opts.targetDate ?? getPlantLocalDate(new Date(), tzOffset);

  const dayStart = new Date(targetDate);
  dayStart.setUTCHours(0, 0, 0, 0);

  const dayEnd = new Date(targetDate);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const prevStart = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000);
  const prevEnd = new Date(dayEnd.getTime() - 24 * 60 * 60 * 1000);

  const isAll = !opts.plantId || opts.plantId === "ALL";
  const plantWhere = isAll ? {} : { plantId: opts.plantId };
  const machineWhere = isAll ? { isActive: true } : { plantId: opts.plantId, isActive: true };

  const [
    plant,
    machines,
    openWorkOrders,
    currentPLogs,
    currentDLogs,
    prevPLogs,
    prevDLogs,
    complaints,
    stocks,
    incidents,
  ] = await Promise.all([
    isAll ? db.plant.findFirst() : db.plant.findUnique({ where: { id: opts.plantId } }),
    db.machine.findMany({
      where: machineWhere,
      select: {
        id: true,
        name: true,
        code: true,
        idealCycleTimeSeconds: true,
        oeeTarget: true,
      },
    }),
    db.workOrder.count({
      where: {
        status: { in: ["PLANNED", "IN_PROGRESS"] },
        ...plantWhere,
      },
    }),
    db.productionLog.findMany({
      where: {
        startTime: { gte: dayStart, lte: dayEnd },
        machine: machineWhere,
      },
    }),
    db.downtimeLog.findMany({
      where: {
        startTime: { gte: dayStart, lte: dayEnd },
        machine: machineWhere,
      },
      include: { reason: true },
    }),
    db.productionLog.findMany({
      where: {
        startTime: { gte: prevStart, lte: prevEnd },
        machine: machineWhere,
      },
    }),
    db.downtimeLog.findMany({
      where: {
        startTime: { gte: prevStart, lte: prevEnd },
        machine: machineWhere,
      },
      include: { reason: true },
    }),
    db.customerComplaint.findMany({
      where: { status: { not: "CLOSED" } },
      select: {
        id: true,
        complaintNumber: true,
        customerName: true,
        status: true,
        raisedAt: true,
        ackAt: true,
        severity: true,
      },
    }),
    db.rawMaterial.findMany({
      where: { isActive: true, ...plantWhere },
      select: {
        id: true,
        sku: true,
        name: true,
        currentStock: true,
        minStock: true,
        unit: true,
      },
    }),
    db.safetyIncident.findMany({
      where: { status: { not: "CLOSED" } },
      select: {
        id: true,
        type: true,
        severity: true,
        description: true,
        status: true,
      },
    }),
  ]);

  // Map machine metrics for current date
  const currentMachineResults = machines.map((m) => {
    const pLogs = currentPLogs.filter((p) => p.machineId === m.id);
    const dLogs = currentDLogs.filter((d) => d.machineId === m.id);

    const good = pLogs.reduce((acc, p) => acc + (p.goodQuantity || 0), 0);
    const scrap = pLogs.reduce((acc, p) => acc + (p.scrapQuantity || 0), 0);
    const rework = pLogs.reduce((acc, p) => acc + (p.reworkQuantity || 0), 0);

    let plannedMin = 0;
    let unplannedMin = 0;
    for (const d of dLogs) {
      const duration = d.durationMinutes || 0;
      const isPlanned = Boolean(d.reason && !d.reason.affectsOperatorScore);
      if (isPlanned) plannedMin += duration;
      else unplannedMin += duration;
    }

    return calculateMachineOee(
      {
        id: m.id,
        name: m.name,
        code: m.code,
        idealCycleTimeSeconds: m.idealCycleTimeSeconds,
        oeeTarget: m.oeeTarget,
      },
      { good, scrap, rework },
      { plannedMinutes: plannedMin, unplannedMinutes: unplannedMin },
    );
  });

  // Map machine metrics for previous date
  const prevMachineResults = machines.map((m) => {
    const pLogs = prevPLogs.filter((p) => p.machineId === m.id);
    const dLogs = prevDLogs.filter((d) => d.machineId === m.id);

    const good = pLogs.reduce((acc, p) => acc + (p.goodQuantity || 0), 0);
    const scrap = pLogs.reduce((acc, p) => acc + (p.scrapQuantity || 0), 0);
    const rework = pLogs.reduce((acc, p) => acc + (p.reworkQuantity || 0), 0);

    let plannedMin = 0;
    let unplannedMin = 0;
    for (const d of dLogs) {
      const duration = d.durationMinutes || 0;
      const isPlanned = Boolean(d.reason && !d.reason.affectsOperatorScore);
      if (isPlanned) plannedMin += duration;
      else unplannedMin += duration;
    }

    return calculateMachineOee(
      {
        id: m.id,
        name: m.name,
        code: m.code,
        idealCycleTimeSeconds: m.idealCycleTimeSeconds,
        oeeTarget: m.oeeTarget,
      },
      { good, scrap, rework },
      { plannedMinutes: plannedMin, unplannedMinutes: unplannedMin },
    );
  });

  const currentPlant = aggregatePlantOee(currentMachineResults);
  const prevPlant = aggregatePlantOee(prevMachineResults);

  // Top downtime reason
  const reasonMap = new Map<string, number>();
  for (const d of currentDLogs) {
    if (d.reason?.description) {
      const cur = reasonMap.get(d.reason.description) || 0;
      reasonMap.set(d.reason.description, cur + (d.durationMinutes || 0));
    }
  }
  let topReason: string | null = null;
  let maxDur = -1;
  for (const [r, dur] of reasonMap.entries()) {
    if (dur > maxDur) {
      maxDur = dur;
      topReason = r;
    }
  }

  // Detect anomalies
  const anomalies = detectOvernightAnomalies({
    complaints: complaints.map((c) => ({
      id: c.id,
      complaintNumber: c.complaintNumber,
      customerName: c.customerName,
      status: c.status,
      createdAt: c.raisedAt,
      acknowledgedAt: c.ackAt,
      severity: c.severity,
    })),
    stocks: stocks.map((s) => ({
      id: s.id,
      sku: s.sku,
      name: s.name,
      currentStock: s.currentStock,
      minStock: s.minStock,
      unit: s.unit,
    })),
    incidents: incidents.map((i) => ({
      id: i.id,
      type: i.type,
      severity: i.severity,
      description: i.description,
      status: i.status,
    })),
    machineResults: currentMachineResults,
    referenceTime: targetDate,
  });

  const plantName = plant?.name || (isAll ? "All Plants Facility" : "Manufacturing Plant");

  const digestResult = assembleMorningDigest({
    targetDate,
    plantName,
    currentOee: currentPlant.plantOee,
    previousOee: prevPlant.plantOee,
    totalGood: currentPlant.totalGood,
    totalScrap: currentPlant.totalScrap,
    totalRework: currentPlant.totalRework,
    totalDowntimeMinutes: currentPlant.totalDowntimeMinutes,
    topDowntimeReason: topReason,
    bestMachine: currentPlant.bestMachine,
    worstMachine: currentPlant.worstMachine,
    openWorkOrders,
    anomalies,
  });

  if (digestResult.tag === "err") {
    throw validation(digestResult.error.message);
  }

  return digestResult.value;
}

// ------------------------------------------------------------------ 2. Production Register Adapter

export async function getProductionRegisterTx(
  db: PrismaClient,
  opts: { startDate: Date; endDate: Date; machineId?: string; plantId?: string },
): Promise<ProductionRegisterDto> {
  const whereClause: import("@prisma/client").Prisma.ProductionLogWhereInput = {
    startTime: { gte: opts.startDate, lte: opts.endDate },
    ...(opts.machineId ? { machineId: opts.machineId } : {}),
    ...(opts.plantId ? { machine: { plantId: opts.plantId } } : {}),
  };

  const logs = await db.productionLog.findMany({
    where: whereClause,
    include: {
      workOrder: {
        include: { product: true },
      },
      machine: true,
    },
    orderBy: { startTime: "desc" },
  });

  const rowInputs: ProductionLogRowInput[] = logs.map((l) => ({
    workOrderId: l.workOrderId,
    woNumber: l.workOrder.woNumber,
    productSku: l.workOrder.product.sku,
    productName: l.workOrder.product.name,
    plannedQty: l.workOrder.plannedQuantity,
    machineCode: l.machine.code,
    goodQty: l.goodQuantity || 0,
    scrapQty: l.scrapQuantity || 0,
    reworkQty: l.reworkQuantity || 0,
    runMinutes: l.endTime
      ? Math.max(0, Math.round((new Date(l.endTime).getTime() - new Date(l.startTime).getTime()) / 60000))
      : 0,
  }));

  return buildProductionRegister(rowInputs);
}

// ------------------------------------------------------------------ 3. Stock Valuation Register Adapter

export async function getStockValuationRegisterTx(
  db: PrismaClient,
  opts: { plantId?: string } = {},
): Promise<StockValuationRegisterDto> {
  const whereClause: import("@prisma/client").Prisma.RawMaterialWhereInput = {
    isActive: true,
    ...(opts.plantId && opts.plantId !== "ALL" ? { plantId: opts.plantId } : {}),
  };

  const rawMaterials = await db.rawMaterial.findMany({
    where: whereClause,
    orderBy: { sku: "asc" },
  });

  const stockInputs: StockItemInput[] = rawMaterials.map((rm) => ({
    id: rm.id,
    sku: rm.sku,
    name: rm.name,
    unit: rm.unit,
    currentStock: rm.currentStock,
    minStock: rm.minStock,
    unitCostPaise: toPaise(rm.unitCost),
    materialClass: rm.materialClass,
  }));

  return buildStockValuationRegister(stockInputs);
}

// ------------------------------------------------------------------ 4. Job Profitability Register Adapter

export async function getJobProfitabilityRegisterTx(
  db: PrismaClient,
  opts: { startDate?: Date; endDate?: Date; customerId?: string; workOrderId?: string } = {},
): Promise<{
  jobs: JobProfitabilityDto[];
  totalRevenuePaise: number;
  totalCostPaise: number;
  totalGrossProfitPaise: number;
  overallMarginPct: number;
}> {
  const whereClause: import("@prisma/client").Prisma.WorkOrderWhereInput = {
    ...(opts.workOrderId ? { id: opts.workOrderId } : {}),
    ...(opts.startDate || opts.endDate
      ? {
          createdAt: {
            ...(opts.startDate ? { gte: opts.startDate } : {}),
            ...(opts.endDate ? { lte: opts.endDate } : {}),
          },
        }
      : {}),
  };

  const workOrders = await db.workOrder.findMany({
    where: whereClause,
    include: {
      product: true,
      invoices: true,
      productionLogs: true,
      scrapQuarantines: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  let totalRevenuePaise = 0;
  let totalCostPaise = 0;

  const jobs: JobProfitabilityDto[] = workOrders.map((wo) => {
    // 1. Revenue
    let revenuePaise = 0;
    if (wo.invoices.length > 0) {
      revenuePaise = wo.invoices.reduce((acc, inv) => acc + Math.round(inv.totalValue), 0);
    } else if (wo.quotedPrice) {
      revenuePaise = toPaise(wo.quotedPrice);
    }

    // 2. Direct Material Cost
    const materialCostPaise = toPaise(wo.materialCostTotal || 0);

    // 3. Labor Cost (estimate ₹300/hr = 30000 paise/hr)
    const runMinutes = wo.productionLogs.reduce((acc, p) => {
      if (p.endTime) {
        return acc + Math.max(0, (new Date(p.endTime).getTime() - new Date(p.startTime).getTime()) / 60000);
      }
      return acc;
    }, 0);
    const laborCostPaise = Math.round((runMinutes / 60) * 30000);

    // 4. Overhead Cost (estimate tooling + machine run overhead)
    const overheadCostPaise = toPaise(wo.toolingCostRupees || 0) + Math.round((runMinutes / 60) * 20000);

    // 5. Scrap Cost penalty
    const scrapCostPaise = wo.scrapQuarantines.reduce(
      (acc, sq) => acc + toPaise(sq.costEstimate || 0),
      0,
    );

    const profitability = calculateJobProfitability({
      workOrderId: wo.id,
      woNumber: wo.woNumber,
      customerName: wo.customerName || "Standard Inventory",
      revenuePaise,
      materialCostPaise,
      laborCostPaise,
      overheadCostPaise,
      scrapCostPaise,
    });

    totalRevenuePaise += profitability.revenuePaise;
    totalCostPaise += profitability.totalCostPaise;

    return profitability;
  });

  const totalGrossProfitPaise = totalRevenuePaise - totalCostPaise;
  const overallMarginPct =
    totalRevenuePaise > 0
      ? Math.round((totalGrossProfitPaise / totalRevenuePaise) * 1000) / 10
      : 0;

  return {
    jobs,
    totalRevenuePaise,
    totalCostPaise,
    totalGrossProfitPaise,
    overallMarginPct,
  };
}

// ------------------------------------------------------------------ 5. Job Traveler Print Adapter

export async function getJobTravelerPrintDataTx(
  db: PrismaClient,
  workOrderId: string,
  actor: ReportsActor,
): Promise<JobTravelerDto> {
  return db.$transaction(async (tx) => {
    const wo = await tx.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        product: {
          include: {
            routingSteps: {
              include: {
                operation: true,
                machine: true,
              },
              orderBy: { seq: "asc" },
            },
          },
        },
        inventoryTransactions: {
          where: { type: "OUT" },
          include: { materialCert: true },
          take: 1,
        },
        faiReports: {
          include: { characteristics: true },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!wo) {
      throw notFound("WorkOrder not found");
    }

    const routingSteps: TravelerRoutingStep[] = wo.product.routingSteps.map((rs) => ({
      seq: rs.seq,
      operationName: rs.operation?.name || rs.stationName,
      stationName: rs.machine?.name || rs.stationName,
      setupTimeMin: rs.setupTimeMin,
      cycleTimeMin: rs.cycleTimeMin,
      isHoldPoint: rs.isHoldPoint,
      holdAuthority: rs.holdAuthority,
    }));

    const inspectionDimensions: TravelerDimension[] =
      wo.faiReports[0]?.characteristics.map((c, idx) => ({
        balloonNo: idx + 1,
        parameter: c.description,
        nominal: c.target || 0,
        usl: c.usl || 0,
        lsl: c.lsl || 0,
        unit: "mm",
      })) || [];

    const rawInput: JobTravelerRawInput = {
      workOrderId: wo.id,
      woNumber: wo.woNumber,
      plannedQuantity: wo.plannedQuantity,
      plannedStartDate: wo.plannedStartDate,
      plannedEndDate: wo.plannedEndDate,
      faiRequired: wo.faiRequired,
      trackingMode: wo.trackingMode === "SERIAL" ? "SERIAL" : "BATCH",
      product: {
        sku: wo.product.sku,
        name: wo.product.name,
        description: wo.product.description,
      },
      customerName: wo.customerName,
      routingSteps,
      materialHeatNo: wo.inventoryTransactions[0]?.materialCert?.heatNumber || null,
      millCertAttached: Boolean(wo.inventoryTransactions[0]?.materialCert),
      inspectionDimensions,
    };

    const formatted = formatJobTraveler(rawInput);
    if (formatted.tag === "err") {
      throw validation(formatted.error.message);
    }

    await audit(tx, {
      actor: actor.name || actor.id || "System",
      action: "EXPORT_TRAVELER",
      entityType: "WorkOrder",
      entityId: wo.id,
      details: `Generated physical job traveler for ${wo.woNumber} (${wo.product.sku}) with checksum ${formatted.value.verificationHash}`,
    });

    return formatted.value;
  });
}
