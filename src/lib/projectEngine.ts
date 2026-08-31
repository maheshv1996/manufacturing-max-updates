/**
 * Business Logic Engine for Project-Based Multi-Op Routing & Machine Capacity Planning
 */

export interface RoutingStepData {
  id?: string;
  seq: number;
  stationName: string;
  setupTimeMin?: number | null;
  cycleTimeMin?: number | null;
  instructions?: string | null;
  machineId?: string | null;
  machine?: {
    id: string;
    code: string;
    name: string;
  } | null;
  operation?: {
    code: string;
    name: string;
  } | null;
}

export interface WorkOrderData {
  id: string;
  woNumber: string;
  plannedQuantity: number;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD" | string;
  plannedStartDate?: Date | string | null;
  plannedEndDate?: Date | string | null;
  currentSeq: number;
  product?: {
    id?: string;
    name?: string;
    sku?: string;
    routingSteps?: RoutingStepData[];
  } | null;
}

export interface ProjectData {
  id: string;
  name: string;
  code: string;
  clientName: string;
  targetCompletionDate: Date | string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD" | string;
  completionPercentage: number;
  description?: string | null;
  workOrders?: WorkOrderData[];
}

export interface BottleneckWarning {
  id: string;
  type:
    | "STATION_OVERLOAD" | "WORK_ORDER_HOLD" | "TARGET_DATE_RISK" | "LONG_SETUP";
  severity: "HIGH" | "CRITICAL" | "WARNING";
  title: string;
  message: string;
  stationName?: string;
  machineCode?: string;
  woNumber?: string;
}

export interface MachineLoadSummary {
  machineId: string | null;
  stationName: string;
  machineCode: string;
  machineName: string;
  totalSetupHours: number;
  totalRunHours: number;
  totalLoadHours: number;
  activeOpCount: number;
  utilizationPct: number; // relative to shift capacity standard
  isOverloaded: boolean;
}

/**
 * Calculates derived overall project completion percentage from completed routing steps across all linked work orders.
 */
export function calculateProjectCompletionPercentage(
  workOrders: WorkOrderData[] = [],
): number {
  if (!workOrders || workOrders.length === 0) return 0;

  let totalCompletedSteps = 0;
  let totalProjectSteps = 0;

  for (const wo of workOrders) {
    const steps = wo.product?.routingSteps || [];
    const totalStepsCount = Math.max(1, steps.length);
    totalProjectSteps += totalStepsCount;

    if (wo.status === "COMPLETED") {
      totalCompletedSteps += totalStepsCount;
    } else if (wo.status === "PLANNED") {
      totalCompletedSteps += 0;
    } else {
      // IN_PROGRESS or ON_HOLD
      // Steps prior to currentSeq are considered completed
      const completedBeforeCurrent = Math.max(0, wo.currentSeq - 1);
      totalCompletedSteps += Math.min(totalStepsCount, completedBeforeCurrent);
    }
  }

  if (totalProjectSteps === 0) return 0;

  const pct = (totalCompletedSteps / totalProjectSteps) * 100;
  return Math.round(pct * 10) / 10;
}

/**
 * Calculates total machine load hours per station/machine based on active project operations.
 */
export function calculateMachineLoadHours(
  workOrders: WorkOrderData[] = [],
  shiftHours: number = 8.0,
): Record<string, MachineLoadSummary> {
  const safeShiftHours = Math.max(1.0, shiftHours || 8.0);
  const loadMap: Record<string, MachineLoadSummary> = {};

  for (const wo of workOrders) {
    // Only active work orders contribute to upcoming machine load
    if (wo.status === "COMPLETED") continue;

    const steps = wo.product?.routingSteps || [];
    for (const step of steps) {
      const station = step.stationName || "Unassigned Station";
      const key = step.machineId || `station:${station}`;
      const setupMin = step.setupTimeMin ?? 15;
      const cycleMin = step.cycleTimeMin ?? 2.5;

      const setupHours = setupMin / 60;
      const runHours = (cycleMin * (wo.plannedQuantity || 1)) / 60;
      const stepTotalHours = setupHours + runHours;

      if (!loadMap[key]) {
        loadMap[key] = {
          machineId: step.machineId || null,
          stationName: station,
          machineCode: step.machine?.code || station,
          machineName: step.machine?.name || station,
          totalSetupHours: 0,
          totalRunHours: 0,
          totalLoadHours: 0,
          activeOpCount: 0,
          utilizationPct: 0,
          isOverloaded: false,
        };
      }

      loadMap[key].totalSetupHours += setupHours;
      loadMap[key].totalRunHours += runHours;
      loadMap[key].totalLoadHours += stepTotalHours;
      loadMap[key].activeOpCount += 1;
    }
  }

  // Calculate utilization % and overload flags
  for (const key of Object.keys(loadMap)) {
    const item = loadMap[key];
    item.totalSetupHours = Math.round(item.totalSetupHours * 10) / 10;
    item.totalRunHours = Math.round(item.totalRunHours * 10) / 10;
    item.totalLoadHours = Math.round(item.totalLoadHours * 10) / 10;
    item.utilizationPct = Math.round((item.totalLoadHours / safeShiftHours) * 100);
    item.isOverloaded = item.totalLoadHours > safeShiftHours;
  }

  return loadMap;
}

/**
 * Evaluates a Project and its linked Work Orders to detect critical-path bottleneck warnings.
 */
export function analyzeProjectBottlenecks(
  project: {
    id: string;
    name: string;
    targetCompletionDate: Date | string;
    status: string;
    workOrders?: WorkOrderData[];
  },
  machineLoads?: Record<string, MachineLoadSummary>,
  options: { setupThresholdMin?: number; shiftHours?: number } = {},
): BottleneckWarning[] {
  const warnings: BottleneckWarning[] = [];
  const wos = project.workOrders || [];
  const shiftHours = options.shiftHours || 8.0;
  const setupThresholdMin = options.setupThresholdMin || 45;
  const loads = machineLoads || calculateMachineLoadHours(wos, shiftHours);

  // 1. Check Station Overloads
  for (const key of Object.keys(loads)) {
    const load = loads[key];
    if (load.isOverloaded || load.utilizationPct > 100) {
      warnings.push({
        id: `overload-${load.stationName}`,
        type: "STATION_OVERLOAD",
        severity: load.utilizationPct > 150 ? "CRITICAL" : "HIGH",
        title: `Capacity Overload: ${load.machineCode}`,
        message: `${load.stationName} load is ${load.totalLoadHours} hrs (${load.utilizationPct}% shift capacity).`,
        stationName: load.stationName,
        machineCode: load.machineCode,
      });
    }
  }

  // 2. Check On-Hold Work Orders
  for (const wo of wos) {
    if (wo.status === "ON_HOLD") {
      warnings.push({
        id: `hold-${wo.id}`,
        type: "WORK_ORDER_HOLD",
        severity: "HIGH",
        title: `Work Order On Hold: ${wo.woNumber}`,
        message: `${wo.woNumber} (${wo.product?.name || "Sub-component"}) is currently ON_HOLD, blocking downstream assembly.`,
        woNumber: wo.woNumber,
      });
    }
  }

  // 3. Check Target Completion Date Risk
  if (project.targetCompletionDate && project.status !== "COMPLETED") {
    const targetDate = new Date(project.targetCompletionDate);
    if (!isNaN(targetDate.getTime())) {
      const now = new Date();
      const diffDays =
        (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      const completionPct = calculateProjectCompletionPercentage(wos);

      if (diffDays < 0 && completionPct < 100) {
        warnings.push({
          id: `date-past-${project.id}`,
          type: "TARGET_DATE_RISK",
          severity: "CRITICAL",
          title: "Target Completion Overdue",
          message: `Project target date was ${targetDate.toLocaleDateString()}, but progress is at ${completionPct}%.`,
        });
      } else if (diffDays <= 3 && completionPct < 75) {
        warnings.push({
          id: `date-risk-${project.id}`,
          type: "TARGET_DATE_RISK",
          severity: "HIGH",
          title: "Target Date Schedule Risk",
          message: `Only ${Math.ceil(diffDays)} day(s) remaining until target completion date with ${completionPct}% complete.`,
        });
      }
    }
  }

  // 4. Check for Long Setup Times
  for (const wo of wos) {
    const steps = wo.product?.routingSteps || [];
    for (const step of steps) {
      if ((step.setupTimeMin ?? 0) >= setupThresholdMin) {
        warnings.push({
          id: `setup-${wo.id}-${step.seq}`,
          type: "LONG_SETUP",
          severity: "WARNING",
          title: `High Changeover Setup: Op ${step.seq * 10}`,
          message: `Op ${step.seq * 10} (${step.stationName}) requires ${step.setupTimeMin} min setup time.`,
          stationName: step.stationName,
          woNumber: wo.woNumber,
        });
      }
    }
  }

  return warnings;
}
