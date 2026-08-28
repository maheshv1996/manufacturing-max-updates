import { prisma } from "@/lib/prisma";
import { ParsedDateRange } from "./date-utils";
import { getOEERules, OEERulesSettings } from "./settings";

export interface OEEEntry {
  id: string;
  machineId: string;
  date: string;
  plannedMinutes: number;
  actualRunMinutes: number;
  idealCycleSeconds: number;
  totalUnits: number;
  goodUnits: number;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
}

export interface Plant {
  id: string;
  name: string;
  address: string | null;
}

export interface ProductionLine {
  id: string;
  name: string;
  plantId: string;
  plant?: Plant;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  targetCycleTimeSeconds: number;
}

export interface WorkOrder {
  id: string;
  woNumber: string;
  productId: string;
  product?: Product;
  plannedQuantity: number;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";
  plannedStartDate: string;
  plannedEndDate: string;
}

export interface ProductionLog {
  id: string;
  workOrderId: string;
  workOrder?: WorkOrder;
  machineId: string;
  goodQuantity: number;
  scrapQuantity: number;
  reworkQuantity: number;
  startTime: string;
  endTime: string | null;
}

export interface DowntimeReason {
  id: string;
  code: string;
  description: string;
  category: "MECHANICAL" | "ELECTRICAL" | "MATERIAL" | "QUALITY" | "OPERATOR";
}

export interface DowntimeLog {
  id: string;
  machineId: string;
  workOrderId: string | null;
  workOrder?: WorkOrder | null;
  reasonId: string | null;
  reason?: DowntimeReason | null;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
  notes: string | null;
}

export interface Machine {
  id: string;
  name: string;
  code: string;
  lineId: string;
  line?: ProductionLine;
  idealCycleTimeSeconds: number;
  status: string;
  iotEnabled?: boolean;
  currentState?: string;
  oeeTarget?: number;
  oeeGoodThreshold?: number;
  oeeWarningThreshold?: number;
  createdAt: string;
  updatedAt: string;
  productionLogs?: ProductionLog[];
  downtimeLogs?: DowntimeLog[];
  activeWorkOrder?: WorkOrder | null;
}

export interface OeeTrendRow {
  dateKey: string;
  date: string;
  [machineCode: string]: any;
}

export interface DowntimeCategoryRow {
  category: string;
  minutes: number;
  hours: number;
}

export interface ComputedMetrics {
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  totalDowntimeMin: number;
  goodUnits: number;
  totalUnits: number;
}

// Helper to calculate real OEE from logs
export function calculateOEE(
  productionLogs: any[],
  downtimeLogs: any[],
  idealCycleTimeSeconds: number,
  durationMs: number,
  oeeRules?: OEERulesSettings,
): ComputedMetrics {
  const totalMinutes = durationMs / (1000 * 60);

  let totalDowntimeMin = 0;
  let plannedDowntimeMin = 0;
  let unplannedDowntimeMin = 0;

  for (const dl of downtimeLogs) {
    if (dl.durationMinutes) {
      totalDowntimeMin += dl.durationMinutes;
      const isPlanned = oeeRules?.plannedCategories.includes(
        dl.reason?.category,
      );
      if (isPlanned) {
        plannedDowntimeMin += dl.durationMinutes;
      } else {
        unplannedDowntimeMin += dl.durationMinutes;
      }
    }
  }

  const plannedProductionTime = oeeRules?.excludePlanned
    ? totalMinutes - plannedDowntimeMin
    : totalMinutes;
  const operatingMin = oeeRules?.excludePlanned
    ? plannedProductionTime - unplannedDowntimeMin
    : totalMinutes - totalDowntimeMin;

  const availability =
    plannedProductionTime > 0 ? operatingMin / plannedProductionTime : 0;

  let goodUnits = 0;
  let scrapUnits = 0;
  let reworkUnits = 0;

  for (const pl of productionLogs) {
    goodUnits += pl.goodQuantity;
    scrapUnits += pl.scrapQuantity;
    reworkUnits += pl.reworkQuantity;
  }

  const totalUnits = goodUnits + scrapUnits + reworkUnits;

  const quality = totalUnits > 0 ? goodUnits / totalUnits : 0;

  const idealRunRatePerMin = 60 / idealCycleTimeSeconds;
  const theoreticalMax = operatingMin * idealRunRatePerMin;

  let performance = theoreticalMax > 0 ? totalUnits / theoreticalMax : 0;

  // Cap at 1 (100%) to handle edge cases
  if (performance > 1) performance = 1;

  const oee = availability * performance * quality;

  return {
    oee: oee * 100,
    availability: availability * 100,
    performance: performance * 100,
    quality: quality * 100,
    totalDowntimeMin,
    goodUnits,
    totalUnits,
  };
}

// Simple in-memory cache for high-frequency dashboard queries
const memoryCache = new Map<string, { data: any; expires: number }>();

function getFromCache<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (entry && entry.expires > Date.now()) {
    return entry.data as T;
  }
  return null;
}

function setToCache(key: string, data: any, ttlSeconds: number = 10) {
  memoryCache.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
}

export async function getMachinesData(
  parsedRange: ParsedDateRange,
  plantId: string = "ALL",
): Promise<{ machines: any[]; previousMachines: any[] }> {
  const cacheKey = `machines_data_${plantId}_${parsedRange.current.from.toISOString()}_${parsedRange.current.to.toISOString()}`;
  const cached = getFromCache<{ machines: any[]; previousMachines: any[] }>(
    cacheKey,
  );
  if (cached) return cached;

  const fetchForRange = async (range: { from: Date; to: Date }) => {
    return prisma.machine.findMany({
      where:
        plantId !== "ALL" ? { plantId, isActive: true } : { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        stationName: true,
        status: true,
        idealCycleTimeSeconds: true,
        lineId: true,
        plantId: true,
        line: {
          select: {
            id: true,
            name: true,
            plant: { select: { id: true, name: true } },
          },
        },
        productionLogs: {
          where: { startTime: { gte: range.from, lte: range.to } },
          select: {
            id: true,
            goodQuantity: true,
            scrapQuantity: true,
            reworkQuantity: true,
            startTime: true,
            workOrderId: true,
            workOrder: {
              select: {
                id: true,
                woNumber: true,
                status: true,
                product: { select: { name: true, sku: true } },
              },
            },
          },
          orderBy: { startTime: "desc" },
        },
        downtimeLogs: {
          where: { startTime: { gte: range.from, lte: range.to } },
          select: {
            id: true,
            durationMinutes: true,
            startTime: true,
            reason: {
              select: { category: true, code: true, description: true },
            },
          },
          orderBy: { startTime: "desc" },
        },
      },
      orderBy: { code: "asc" },
    });
  };

  const durationMs =
    parsedRange.current.to.getTime() - parsedRange.current.from.getTime();

  const [currentMachines, previousMachines, oeeRules] = await Promise.all([
    fetchForRange(parsedRange.current),
    fetchForRange(parsedRange.previous),
    getOEERules(),
  ]);

  const processMachines = (machinesList: any[]) => {
    return machinesList.map((machine) => {
      const activeLog = machine.productionLogs.find(
        (log: any) => log.workOrder && log.workOrder.status === "IN_PROGRESS",
      );
      const metrics = calculateOEE(
        machine.productionLogs,
        machine.downtimeLogs,
        machine.idealCycleTimeSeconds,
        durationMs,
        oeeRules,
      );
      return {
        ...machine,
        activeWorkOrder: activeLog ? activeLog.workOrder : null,
        metrics,
      };
    });
  };

  const result = {
    machines: processMachines(currentMachines),
    previousMachines: processMachines(previousMachines),
  };

  setToCache(cacheKey, result, 10);
  return result;
}

export async function getStatsData(
  parsedRange: ParsedDateRange,
  plantId: string = "ALL",
): Promise<{
  oeeTrends: OeeTrendRow[];
  downtimeByCategory: DowntimeCategoryRow[];
}> {
  const cacheKey = `stats_data_${plantId}_${parsedRange.current.from.toISOString()}_${parsedRange.current.to.toISOString()}`;
  const cached = getFromCache<{
    oeeTrends: OeeTrendRow[];
    downtimeByCategory: DowntimeCategoryRow[];
  }>(cacheKey);
  if (cached) return cached;

  const machines = await prisma.machine.findMany({
    where: plantId !== "ALL" ? { plantId, isActive: true } : { isActive: true },
    select: { id: true, code: true, idealCycleTimeSeconds: true },
    orderBy: { code: "asc" },
  });

  const dateMap = new Map<string, Record<string, any>>();
  const diffDays = Math.ceil(
    (parsedRange.current.to.getTime() - parsedRange.current.from.getTime()) /
      (1000 * 60 * 60 * 24),
  );
  const numPoints = Math.min(diffDays, 30);

  for (let i = numPoints - 1; i >= 0; i--) {
    const dFrom = new Date(
      parsedRange.current.to.getTime() - (i + 1) * 24 * 60 * 60 * 1000,
    );
    const dateKey = dFrom.toISOString().slice(0, 10);
    const dateLabel = dFrom.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    dateMap.set(dateKey, { dateKey, date: dateLabel });
  }

  const machineIds = machines.map((m) => m.id);

  const [allProdLogs, allDownLogs, oeeRules] = await Promise.all([
    prisma.productionLog.findMany({
      where: {
        startTime: {
          gte: parsedRange.current.from,
          lte: parsedRange.current.to,
        },
        machineId: { in: machineIds },
      },
      select: {
        machineId: true,
        startTime: true,
        goodQuantity: true,
        scrapQuantity: true,
        reworkQuantity: true,
      },
    }),
    prisma.downtimeLog.findMany({
      where: {
        startTime: {
          gte: parsedRange.current.from,
          lte: parsedRange.current.to,
        },
        machineId: { in: machineIds },
      },
      select: {
        machineId: true,
        startTime: true,
        durationMinutes: true,
        reason: { select: { category: true } },
      },
    }),
    getOEERules(),
  ]);

  for (const dateKey of dateMap.keys()) {
    const bucket = dateMap.get(dateKey)!;
    for (const m of machines) {
      const pLogs = allProdLogs.filter(
        (l) =>
          l.machineId === m.id &&
          l.startTime.toISOString().slice(0, 10) === dateKey,
      );
      const dLogs = allDownLogs.filter(
        (l) =>
          l.machineId === m.id &&
          l.startTime.toISOString().slice(0, 10) === dateKey,
      );

      const metrics = calculateOEE(
        pLogs,
        dLogs,
        m.idealCycleTimeSeconds,
        24 * 60 * 60 * 1000,
        oeeRules,
      );
      bucket[m.code] = Number(metrics.oee.toFixed(1));
    }
  }

  const categoryMap = new Map<string, number>();
  allDownLogs.forEach((log) => {
    const cat = log.reason?.category || "MECHANICAL";
    const mins = log.durationMinutes || 0;
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + mins);
  });

  const downtimeByCategory = Array.from(categoryMap.entries())
    .map(([category, minutes]) => ({
      category,
      minutes,
      hours: Number((minutes / 60).toFixed(1)),
    }))
    .sort((a, b) => b.hours - a.hours);

  const result = {
    oeeTrends: Array.from(dateMap.values()) as OeeTrendRow[],
    downtimeByCategory,
  };

  setToCache(cacheKey, result, 10);
  return result;
}

export async function getMachineDetailData(
  machineId: string,
  parsedRange: ParsedDateRange,
): Promise<{ machine: any; previousMetrics: ComputedMetrics } | null> {
  const cacheKey = `machine_detail_${machineId}_${parsedRange.current.from.toISOString()}_${parsedRange.current.to.toISOString()}`;
  const cached = getFromCache<{
    machine: any;
    previousMetrics: ComputedMetrics;
  }>(cacheKey);
  if (cached) return cached;

  const fetchForRange = async (range: { from: Date; to: Date }) => {
    return prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        line: { include: { plant: true } },
        assignments: {
          where: { status: "ACTIVE" },
          include: { operator: true, shift: true },
        },
        productionLogs: {
          where: { startTime: { gte: range.from, lte: range.to } },
          include: {
            workOrder: { include: { product: true } },
            operator: true,
            shift: true,
          },
          orderBy: { startTime: "desc" },
          take: 50,
        },
        downtimeLogs: {
          where: { startTime: { gte: range.from, lte: range.to } },
          include: { reason: true, workOrder: { include: { product: true } } },
          orderBy: { startTime: "desc" },
          take: 50,
        },
      },
    });
  };

  const [currentMachine, previousMachine, oeeRules] = await Promise.all([
    fetchForRange(parsedRange.current),
    fetchForRange(parsedRange.previous),
    getOEERules(),
  ]);

  if (!currentMachine) return null;

  const durationMs =
    parsedRange.current.to.getTime() - parsedRange.current.from.getTime();

  const currentMetrics = calculateOEE(
    currentMachine.productionLogs,
    currentMachine.downtimeLogs,
    currentMachine.idealCycleTimeSeconds,
    durationMs,
    oeeRules,
  );
  const previousMetrics = calculateOEE(
    previousMachine?.productionLogs || [],
    previousMachine?.downtimeLogs || [],
    currentMachine.idealCycleTimeSeconds,
    durationMs,
    oeeRules,
  );

  const activeLog = currentMachine.productionLogs.find(
    (log) => log.workOrder && log.workOrder.status === "IN_PROGRESS",
  );

  let activeWorkOrder = activeLog ? activeLog.workOrder : null;
  if (!activeWorkOrder && currentMachine.status === "RUNNING") {
    activeWorkOrder = await prisma.workOrder.findFirst({
      where: { status: "IN_PROGRESS" },
      include: { product: true },
      orderBy: { updatedAt: "desc" },
    });
  }

  const finalMachine = {
    ...currentMachine,
    activeWorkOrder,
    metrics: currentMetrics,
  };

  return JSON.parse(JSON.stringify({ machine: finalMachine, previousMetrics }));
}

export async function getProductsData(): Promise<Product[]> {
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
  });
  return JSON.parse(JSON.stringify(products));
}

export async function getWorkOrdersData(
  statusFilter?: string,
  plantId: string = "ALL",
) {
  const where: any = {};
  if (statusFilter && statusFilter !== "ALL") {
    where.status = statusFilter;
  }
  if (plantId !== "ALL") {
    where.plantId = plantId;
  }

  const workOrders = await prisma.workOrder.findMany({
    where,
    include: {
      product: {
        include: {
          bomLines: {
            include: {
              rawMaterial: {
                include: { supplier: true },
              },
            },
          },
        },
      },
      productionLogs: {
        include: { machine: true, operator: true, shift: true },
      },
      downtimeLogs: { include: { machine: true, reason: true } },
    } as any,
    orderBy: { createdAt: "desc" },
  });

  return JSON.parse(JSON.stringify(workOrders));
}

export async function getWorkOrderDetailData(id: string) {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id },
    include: {
      product: {
        include: {
          routingSteps: {
            include: { operation: true },
            orderBy: { seq: "asc" },
          },
          bomLines: {
            include: {
              rawMaterial: {
                include: { supplier: true },
              },
            },
          },
        },
      },
      productionLogs: {
        include: { machine: true, operator: true, shift: true },
        orderBy: { startTime: "desc" },
      },
      downtimeLogs: {
        include: { machine: true, reason: true },
        orderBy: { startTime: "desc" },
      },
      movementLogs: {
        orderBy: { at: "asc" },
      },
      inventoryTransactions: {
        include: { rawMaterial: true, materialCert: true },
        orderBy: { at: "desc" },
      },
      dispatchRecords: {
        include: { invoice: true },
        orderBy: { dispatchedAt: "desc" },
      },
      serialUnits: {
        include: { events: { orderBy: { at: "asc" } } },
        orderBy: { serialNo: "asc" },
      },
      holdPointSignoffs: true,
      dataPackages: { orderBy: { createdAt: "desc" } },
    } as any,
  });

  if (!workOrder) return null;
  return JSON.parse(JSON.stringify(workOrder));
}
