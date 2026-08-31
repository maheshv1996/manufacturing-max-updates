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

function safeJsonClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  try {
    return JSON.parse(
      JSON.stringify(obj, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );
  } catch {
    return obj;
  }
}

/**
 * Standardized Overall Equipment Effectiveness (OEE) Calculation Engine.
 * Availability = Operating Time / Planned Production Time
 * Performance = Total Units Produced / (Operating Time * Ideal Run Rate)
 * Quality = Good Units / Total Units
 */
export function calculateOEE(
  productionLogs: any[] = [],
  downtimeLogs: any[] = [],
  idealCycleTimeSeconds: number = 60,
  durationMs: number = 24 * 60 * 60 * 1000,
  oeeRules?: OEERulesSettings,
): ComputedMetrics {
  const safeCycleTime = Math.max(0.1, Number(idealCycleTimeSeconds) || 60);
  const totalMinutes = Math.max(1, Number(durationMs) / (1000 * 60));

  let totalDowntimeMin = 0;
  let plannedDowntimeMin = 0;
  let unplannedDowntimeMin = 0;

  const safeDownLogs = Array.isArray(downtimeLogs) ? downtimeLogs : [];
  for (const dl of safeDownLogs) {
    const mins = Number(dl?.durationMinutes) || 0;
    if (mins > 0) {
      totalDowntimeMin += mins;
      const isPlanned = oeeRules?.plannedCategories?.includes(dl?.reason?.category);
      if (isPlanned) {
        plannedDowntimeMin += mins;
      } else {
        unplannedDowntimeMin += mins;
      }
    }
  }

  const plannedProductionTime = oeeRules?.excludePlanned
    ? Math.max(0, totalMinutes - plannedDowntimeMin)
    : totalMinutes;

  const operatingMin = oeeRules?.excludePlanned
    ? Math.max(0, plannedProductionTime - unplannedDowntimeMin)
    : Math.max(0, totalMinutes - totalDowntimeMin);

  const availability = plannedProductionTime > 0 ? Math.min(1, operatingMin / plannedProductionTime) : 0;

  let goodUnits = 0;
  let scrapUnits = 0;
  let reworkUnits = 0;

  const safeProdLogs = Array.isArray(productionLogs) ? productionLogs : [];
  for (const pl of safeProdLogs) {
    goodUnits += Number(pl?.goodQuantity) || 0;
    scrapUnits += Number(pl?.scrapQuantity) || 0;
    reworkUnits += Number(pl?.reworkQuantity) || 0;
  }

  const totalUnits = goodUnits + scrapUnits + reworkUnits;
  const quality = totalUnits > 0 ? Math.min(1, Math.max(0, goodUnits / totalUnits)) : 1;

  const idealRunRatePerMin = 60 / safeCycleTime;
  const theoreticalMax = operatingMin * idealRunRatePerMin;

  let performance = theoreticalMax > 0 ? totalUnits / theoreticalMax : 0;
  if (performance > 1) performance = 1;
  if (performance < 0) performance = 0;

  const oee = availability * performance * quality;

  return {
    oee: Math.round(oee * 10000) / 100,
    availability: Math.round(availability * 10000) / 100,
    performance: Math.round(performance * 10000) / 100,
    quality: Math.round(quality * 10000) / 100,
    totalDowntimeMin: Math.round(totalDowntimeMin * 10) / 10,
    goodUnits,
    totalUnits,
  };
}

// In-memory cache for high-frequency dashboard queries
const memoryCache = new Map<string, { data: any; expires: number }>();

function getFromCache<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (entry && entry.expires > Date.now()) {
    return entry.data as T;
  }
  return null;
}

function setToCache(key: string, data: any, ttlSeconds: number = 30) {
  memoryCache.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
}

export async function getMachinesData(
  parsedRange: ParsedDateRange,
  plantId: string = "ALL",
): Promise<{ machines: any[]; previousMachines: any[] }> {
  const isAll = !plantId || plantId === "ALL";
  const cacheKey = `machines_data_${plantId}_${parsedRange.current.from.toISOString()}_${parsedRange.current.to.toISOString()}`;
  const cached = getFromCache<{ machines: any[]; previousMachines: any[] }>(cacheKey);
  if (cached) return cached;

  const fetchForRange = async (range: { from: Date; to: Date }) => {
    return prisma.machine.findMany({
      where: isAll ? { isActive: true } : { plantId, isActive: true },
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

  const durationMs = parsedRange.current.to.getTime() - parsedRange.current.from.getTime();

  const [currentMachines, previousMachines, oeeRules] = await Promise.all([
    fetchForRange(parsedRange.current),
    parsedRange.previous ? fetchForRange(parsedRange.previous) : Promise.resolve([]),
    getOEERules(),
  ]);

  const processMachines = (machinesList: any[]) => {
    return machinesList.map((machine) => {
      const activeLog = machine.productionLogs?.find(
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

  setToCache(cacheKey, result, 30);
  return result;
}

export async function getStatsData(
  parsedRange: ParsedDateRange,
  plantId: string = "ALL",
): Promise<{
  oeeTrends: OeeTrendRow[];
  downtimeByCategory: DowntimeCategoryRow[];
}> {
  const isAll = !plantId || plantId === "ALL";
  const cacheKey = `stats_data_${plantId}_${parsedRange.current.from.toISOString()}_${parsedRange.current.to.toISOString()}`;
  const cached = getFromCache<{
    oeeTrends: OeeTrendRow[];
    downtimeByCategory: DowntimeCategoryRow[];
  }>(cacheKey);
  if (cached) return cached;

  const dateMap = new Map<string, Record<string, any>>();
  const diffDays = Math.max(1, Math.round(
    (parsedRange.current.to.getTime() - parsedRange.current.from.getTime()) /
      (1000 * 60 * 60 * 24),
  ));
  const numPoints = Math.min(diffDays, 30);

  for (let i = numPoints - 1; i >= 0; i--) {
    const dFrom = new Date(parsedRange.current.to.getTime() - (i + 1) * 24 * 60 * 60 * 1000);
    const dateKey = dFrom.toISOString().slice(0, 10);
    const dateLabel = dFrom.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    dateMap.set(dateKey, { dateKey, date: dateLabel });
  }

  const machineWhere = isAll ? { isActive: true } : { plantId, isActive: true };

  // All database lookups execute in parallel in a single Promise.all roundtrip
  const [machines, allProdLogs, allDownLogs, oeeRules] = await Promise.all([
    prisma.machine.findMany({
      where: machineWhere,
      select: { id: true, code: true, idealCycleTimeSeconds: true },
      orderBy: { code: "asc" },
    }),
    prisma.productionLog.findMany({
      where: {
        startTime: {
          gte: parsedRange.current.from,
          lte: parsedRange.current.to,
        },
        machine: machineWhere,
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
        machine: machineWhere,
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
      const pLogs = allProdLogs.filter((l) => {
        if (l.machineId !== m.id || !l.startTime) return false;
        const key = l.startTime instanceof Date ? l.startTime.toISOString().slice(0, 10) : String(l.startTime).slice(0, 10);
        return key === dateKey;
      });
      const dLogs = allDownLogs.filter((l) => {
        if (l.machineId !== m.id || !l.startTime) return false;
        const key = l.startTime instanceof Date ? l.startTime.toISOString().slice(0, 10) : String(l.startTime).slice(0, 10);
        return key === dateKey;
      });

      const metrics = calculateOEE(
        pLogs,
        dLogs,
        m.idealCycleTimeSeconds,
        24 * 60 * 60 * 1000,
        oeeRules,
      );
      bucket[m.code || m.id] = Number(metrics.oee.toFixed(1));
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

  setToCache(cacheKey, result, 30);
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

  const durationMs = parsedRange.current.to.getTime() - parsedRange.current.from.getTime();

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
    previousMachine?.idealCycleTimeSeconds || currentMachine.idealCycleTimeSeconds,
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

  const result = safeJsonClone({ machine: finalMachine, previousMetrics });
  setToCache(cacheKey, result, 30);
  return result;
}

export async function getProductsData(): Promise<Product[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  return safeJsonClone(products);
}

export async function getWorkOrdersData(
  statusFilter?: string,
  plantId: string = "ALL",
) {
  const isAll = !plantId || plantId === "ALL";
  const where: any = {};
  if (statusFilter && statusFilter !== "ALL") {
    where.status = statusFilter;
  }
  if (!isAll) {
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
        take: 20,
      },
      downtimeLogs: { include: { machine: true, reason: true }, take: 20 },
    } as any,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return safeJsonClone(workOrders);
}

export async function getWorkOrderDetailData(id: string): Promise<any> {
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
        take: 50,
      },
      downtimeLogs: {
        include: { machine: true, reason: true },
        orderBy: { startTime: "desc" },
        take: 50,
      },
      movementLogs: {
        orderBy: { at: "asc" },
        take: 50,
      },
      inventoryTransactions: {
        include: { rawMaterial: true, materialCert: true },
        orderBy: { at: "desc" },
        take: 50,
      },
      dispatchRecords: {
        include: { invoice: true },
        orderBy: { dispatchedAt: "desc" },
        take: 20,
      },
      serialUnits: {
        include: { events: { orderBy: { at: "asc" } } },
        orderBy: { serialNo: "asc" },
        take: 100,
      },
      holdPointSignoffs: true,
      dataPackages: { orderBy: { createdAt: "desc" }, take: 20 },
    } as any,
  });

  if (!workOrder) return null;
  return safeJsonClone(workOrder);
}
