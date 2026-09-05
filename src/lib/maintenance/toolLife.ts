/**
 * C8-3 — Tool life (W11: "Tool life: cycle decrements on LOG_GOOD → wear % → warn → mandatory replace").
 * Two families, both pure:
 *  • MaintenanceTool (dies/moulds/fixtures/blades): units-based life with a
 *    REGRIND lifecycle — regrind only from NEEDS_REGRIND, and when regrinds hit
 *    maxRegrinds the engine forces SCRAP (mandatory replace, M3).
 *  • Tool (cycle-counted tooling): warn at warningThreshold %, RETIRE at max life,
 *    retired tools refuse further cycles.
 */

import { ok, err, type Result } from "../core/result";

// ------------------------------------------------------------- MaintenanceTool (units)

export type ToolLifeStatus = "AVAILABLE" | "IN_USE" | "NEEDS_REGRIND" | "SCRAPPED";

export interface MaintenanceToolInput {
  id: string;
  code: string;
  ratedLifeUnits: number;
  usedUnits: number;
  regrinds: number;
  maxRegrinds: number;
  lifeStatus: ToolLifeStatus;
}

export type ToolLifeError = "SCRAPPED" | "INVALID_UNITS" | "REFUSE_REGRIND" | "SCRAP_REQUIRED";

export function wearPct(tool: Pick<MaintenanceToolInput, "ratedLifeUnits" | "usedUnits">): number {
  if (tool.ratedLifeUnits <= 0) return 0;
  return Math.min(100, Math.round((tool.usedUnits / tool.ratedLifeUnits) * 100));
}

export function consumeUnits(
  tool: MaintenanceToolInput,
  units: number,
  _now: Date,
): Result<MaintenanceToolInput, ToolLifeError> {
  if (tool.lifeStatus === "SCRAPPED") return err("SCRAPPED");
  if (!Number.isFinite(units) || units <= 0) return err("INVALID_UNITS");

  const usedUnits = tool.usedUnits + units;
  const lifeStatus: ToolLifeStatus = usedUnits >= tool.ratedLifeUnits ? "NEEDS_REGRIND" : tool.lifeStatus === "AVAILABLE" ? "IN_USE" : tool.lifeStatus;
  return ok({ ...tool, usedUnits, lifeStatus });
}

export function regrind(
  tool: MaintenanceToolInput,
  _opts: { costRupees?: number; now: Date },
): Result<MaintenanceToolInput, ToolLifeError> {
  if (tool.lifeStatus === "SCRAPPED") return err("SCRAPPED");
  if (tool.lifeStatus !== "NEEDS_REGRIND") return err("REFUSE_REGRIND");
  if (tool.regrinds >= tool.maxRegrinds) return err("SCRAP_REQUIRED");

  return ok({ ...tool, usedUnits: 0, regrinds: tool.regrinds + 1, lifeStatus: "AVAILABLE" });
}

export function scrap(
  tool: MaintenanceToolInput,
  _opts: { reason: string; now: Date },
): Result<MaintenanceToolInput, ToolLifeError> {
  if (tool.lifeStatus === "SCRAPPED") return err("SCRAPPED");
  return ok({ ...tool, lifeStatus: "SCRAPPED" });
}

// ------------------------------------------------------------- Tool (cycles)

export interface CycleToolInput {
  id: string;
  toolCode: string;
  maxLifeCycles: number;
  currentCycles: number;
  warningThreshold: number; // percent 0–100
  status: string; // ACTIVE | WARNING | MAINTENANCE | RETIRED
}

export function cycleWearPct(tool: Pick<CycleToolInput, "maxLifeCycles" | "currentCycles">): number {
  if (tool.maxLifeCycles <= 0) return 100;
  return Math.min(100, Math.round((tool.currentCycles / tool.maxLifeCycles) * 100));
}

export function recordCycles(
  tool: CycleToolInput,
  cycles: number,
  _now: Date,
): Result<CycleToolInput, "RETIRED" | "INVALID_CYCLES"> {
  if (tool.status === "RETIRED") return err("RETIRED");
  if (!Number.isFinite(cycles) || cycles <= 0) return err("INVALID_CYCLES");

  const currentCycles = tool.currentCycles + cycles;
  let status = tool.status;
  if (currentCycles >= tool.maxLifeCycles) {
    status = "RETIRED";
  } else if (cycleWearPct({ ...tool, currentCycles }) >= tool.warningThreshold) {
    status = "WARNING";
  } else if (status === "WARNING") {
    // wear only moves forward; a WARNING tool stays flagged until replaced
    status = "WARNING";
  }
  return ok({ ...tool, currentCycles, status });
}
