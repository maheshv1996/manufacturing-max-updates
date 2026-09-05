/**
 * C10-1 — Pure Morning Digest & Anomaly Engine (DEPTH_03 F1 / DEPTH_04 W1).
 * Timezone-aware daily factory executive briefing, OEE computation,
 * plant averages, best/worst machine ranking, and overnight SLA breach detection.
 * DB-free, typed Result envelope.
 */

import { ok, type Result } from "../core/result";
import { type AppError } from "../core/errors";

export type ProductionDigestInput = ProductionCountInput;
export type DowntimeDigestInput = DowntimeMinutesInput;

export interface MachineDigestInput {
  id: string;
  name: string;
  code: string;
  idealCycleTimeSeconds: number;
  oeeTarget: number;
}

export interface ProductionCountInput {
  good: number;
  scrap: number;
  rework: number;
}

export interface DowntimeMinutesInput {
  plannedMinutes: number;
  unplannedMinutes: number;
}

export interface OeeOptions {
  shiftMinutes?: number;
  excludePlannedDowntime?: boolean;
}

export interface MachineOeeResult {
  machine: MachineDigestInput;
  good: number;
  scrap: number;
  rework: number;
  totalDowntimeMinutes: number;
  plannedDowntimeMinutes: number;
  unplannedDowntimeMinutes: number;
  availabilityPct: number;
  performancePct: number;
  qualityPct: number;
  oeePct: number;
}

export interface PlantOeeResult {
  plantOee: number;
  totalGood: number;
  totalScrap: number;
  totalRework: number;
  totalDowntimeMinutes: number;
  bestMachine: { name: string; code: string; oeePct: number } | null;
  worstMachine: { name: string; code: string; oeePct: number } | null;
  machineCount: number;
  machines: MachineOeeResult[];
}

export interface ComplaintDigestInput {
  id: string;
  complaintNumber: string;
  customerName: string;
  status: string;
  createdAt: Date;
  acknowledgedAt: Date | null;
  severity: string;
}

export interface StockDigestInput {
  id: string;
  sku: string;
  name: string;
  currentStock: number;
  minStock: number;
  unit: string;
}

export interface IncidentDigestInput {
  id: string;
  type: string;
  severity: string;
  description: string;
  status: string;
}

export interface AnomalyItem {
  code: string;
  severity: "critical" | "warning";
  id?: string;
  message: string;
  href?: string;
}

export interface MorningDigestDto {
  targetDate: Date;
  plantName: string;
  oee: number;
  oeeDelta: number;
  totalGood: number;
  totalScrap: number;
  totalRework: number;
  totalDowntimeMin: number;
  topDowntimeReason: string | null;
  bestMachine: { name: string; oeePct: number } | null;
  worstMachine: { name: string; oeePct: number } | null;
  openWorkOrders: number;
  anomalies: AnomalyItem[];
  attentionNeeded: string[];
}

/**
 * Calculates Availability, Performance, Quality, and overall OEE for a machine.
 */
export function calculateMachineOee(
  machine: MachineDigestInput,
  production: ProductionCountInput,
  downtime: DowntimeMinutesInput,
  options?: OeeOptions,
): MachineOeeResult {
  const shiftMinutes = options?.shiftMinutes ?? 1440;
  const excludePlanned = options?.excludePlannedDowntime ?? true;

  const plannedTime = excludePlanned
    ? Math.max(0, shiftMinutes - downtime.plannedMinutes)
    : shiftMinutes;

  const operatingMin = Math.max(0, plannedTime - downtime.unplannedMinutes);
  const availability = plannedTime > 0 ? Math.min(1, operatingMin / plannedTime) : 0;

  const totalParts = production.good + production.scrap + production.rework;
  const quality = totalParts > 0 ? Math.min(1, production.good / totalParts) : 1.0;

  const cycleSecs = Math.max(0.1, Number(machine.idealCycleTimeSeconds) || 60);
  const idealRunRatePerMin = 60 / cycleSecs;
  const theoreticalMax = operatingMin * idealRunRatePerMin;

  const performance =
    theoreticalMax > 0
      ? Math.min(1, Math.max(0, totalParts / theoreticalMax))
      : totalParts > 0
        ? 0.85
        : 0;

  const oee = Math.round(availability * performance * quality * 10000) / 100;

  return {
    machine,
    good: production.good,
    scrap: production.scrap,
    rework: production.rework,
    totalDowntimeMinutes: downtime.plannedMinutes + downtime.unplannedMinutes,
    plannedDowntimeMinutes: downtime.plannedMinutes,
    unplannedDowntimeMinutes: downtime.unplannedMinutes,
    availabilityPct: Math.round(availability * 1000) / 10,
    performancePct: Math.round(performance * 1000) / 10,
    qualityPct: Math.round(quality * 1000) / 10,
    oeePct: oee,
  };
}

/**
 * Aggregates machine OEE results into plant-level metrics with best/worst rankings.
 */
export function aggregatePlantOee(machines: MachineOeeResult[]): PlantOeeResult {
  if (machines.length === 0) {
    return {
      plantOee: 0,
      totalGood: 0,
      totalScrap: 0,
      totalRework: 0,
      totalDowntimeMinutes: 0,
      bestMachine: null,
      worstMachine: null,
      machineCount: 0,
      machines: [],
    };
  }

  let totalGood = 0;
  let totalScrap = 0;
  let totalRework = 0;
  let totalDowntimeMinutes = 0;
  let sumOee = 0;

  for (const m of machines) {
    totalGood += m.good;
    totalScrap += m.scrap;
    totalRework += m.rework;
    totalDowntimeMinutes += m.totalDowntimeMinutes;
    sumOee += m.oeePct;
  }

  const sorted = [...machines].sort((a, b) => b.oeePct - a.oeePct);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  return {
    plantOee: Math.round((sumOee / machines.length) * 10) / 10,
    totalGood,
    totalScrap,
    totalRework,
    totalDowntimeMinutes,
    bestMachine: { name: best.machine.name, code: best.machine.code, oeePct: best.oeePct },
    worstMachine: { name: worst.machine.name, code: worst.machine.code, oeePct: worst.oeePct },
    machineCount: machines.length,
    machines,
  };
}

/**
 * Detects overnight SLA breaches, low stock alerts, and safety anomalies.
 */
export function detectOvernightAnomalies(params: {
  complaints?: ComplaintDigestInput[];
  stocks?: StockDigestInput[];
  incidents?: IncidentDigestInput[];
  machineResults?: MachineOeeResult[];
  referenceTime?: Date;
}): AnomalyItem[] {
  const refTime = params.referenceTime ? params.referenceTime.getTime() : Date.now();
  const anomalies: AnomalyItem[] = [];

  // 1. Complaint SLA checks (DEPTH_04 W8 / complaintSla)
  if (params.complaints) {
    for (const c of params.complaints) {
      const createdMs = new Date(c.createdAt).getTime();
      const ageHours = (refTime - createdMs) / (1000 * 60 * 60);

      // 24h ACK SLA
      if (c.status === "OPEN" && !c.acknowledgedAt && ageHours > 24) {
        anomalies.push({
          code: "COMPLAINT_ACK_OVERDUE",
          severity: "critical",
          id: c.id,
          message: `Complaint ${c.complaintNumber} (${c.customerName}) unacknowledged for ${Math.floor(ageHours)}h (SLA: 24h)`,
          href: "/complaints",
        });
      }

      // 10-day 8D CAPA SLA
      const ageDays = ageHours / 24;
      if (c.status !== "CLOSED" && ageDays > 10) {
        anomalies.push({
          code: "COMPLAINT_8D_OVERDUE",
          severity: "critical",
          id: c.id,
          message: `Complaint ${c.complaintNumber} (${c.customerName}) 8D CAPA open for ${Math.floor(ageDays)}d (SLA: 10d)`,
          href: "/quality/eight-d",
        });
      }
    }
  }

  // 2. Low stock checks
  if (params.stocks) {
    for (const s of params.stocks) {
      if (s.currentStock < s.minStock) {
        anomalies.push({
          code: "LOW_STOCK",
          severity: "warning",
          id: s.id,
          message: `${s.name} (${s.sku}) stock (${s.currentStock} ${s.unit}) below reorder minimum (${s.minStock} ${s.unit})`,
          href: "/inventory",
        });
      }
    }
  }

  // 3. Open Critical / High safety incidents (DEPTH_03 F10)
  if (params.incidents) {
    for (const inc of params.incidents) {
      if (inc.status !== "CLOSED" && (inc.severity === "CRITICAL" || inc.severity === "HIGH")) {
        anomalies.push({
          code: "CRITICAL_INCIDENT",
          severity: "critical",
          id: inc.id,
          message: `Open ${inc.severity} safety incident: ${inc.description}`,
          href: "/system/ehs",
        });
      }
    }
  }

  // 4. Machine downtime / underperforming checks
  if (params.machineResults) {
    for (const m of params.machineResults) {
      if (m.totalDowntimeMinutes > 60 || m.oeePct < m.machine.oeeTarget) {
        anomalies.push({
          code: "MACHINE_UNDERPERFORMING",
          severity: m.totalDowntimeMinutes > 120 ? "critical" : "warning",
          id: m.machine.id,
          message: `${m.machine.name} OEE ${m.oeePct}% (target: ${m.machine.oeeTarget}%), downtime: ${m.totalDowntimeMinutes}m`,
          href: "/ops",
        });
      }
    }
  }

  return anomalies;
}

/**
 * Assembles the full Morning Digest DTO with previous day delta comparison.
 */
export function assembleMorningDigest(input: {
  targetDate: Date;
  plantName: string;
  currentOee: number;
  previousOee: number;
  totalGood: number;
  totalScrap: number;
  totalRework: number;
  totalDowntimeMinutes: number;
  topDowntimeReason: string | null;
  bestMachine: { name: string; oeePct: number } | null;
  worstMachine: { name: string; oeePct: number } | null;
  openWorkOrders: number;
  anomalies: AnomalyItem[];
}): Result<MorningDigestDto, AppError> {
  const oeeDelta = Math.round((input.currentOee - input.previousOee) * 10) / 10;
  const attentionNeeded = input.anomalies.map((a) => a.message);

  return ok({
    targetDate: input.targetDate,
    plantName: input.plantName,
    oee: input.currentOee,
    oeeDelta,
    totalGood: input.totalGood,
    totalScrap: input.totalScrap,
    totalRework: input.totalRework,
    totalDowntimeMin: input.totalDowntimeMinutes,
    topDowntimeReason: input.topDowntimeReason,
    bestMachine: input.bestMachine,
    worstMachine: input.worstMachine,
    openWorkOrders: input.openWorkOrders,
    anomalies: input.anomalies,
    attentionNeeded,
  });
}
