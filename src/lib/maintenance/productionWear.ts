/**
 * C8-9a — Production-driven tool wear projection (W11: "Tool life: cycle
 * decrements on LOG_GOOD → wear % → warn → mandatory replace").
 * Pure — a machine's production good-pieces map onto:
 *   • `Tool` (cycle-counted): `recordCycles` per assigned tool (warn → RETIRE at max)
 *   • `MaintenanceTool` (unit-life): `consumeUnits` per machine tool (crossing rated
 *     life flips NEEDS_REGRIND — the mandatory-replace path)
 * RETIRED/SCRAPPED tools are never re-armed by production. The adapter applies the
 * projection inside the shopfloor LOG_GOOD transaction and audits the result.
 */

import { recordCycles, consumeUnits, type CycleToolInput, type MaintenanceToolInput } from "./toolLife";

export interface CycleWearUpdate {
  id: string;
  currentCycles: number;
  status: string;
  changed: boolean;
}

export interface UnitWearUpdate {
  id: string;
  usedUnits: number;
  lifeStatus: string;
  crossedThreshold: boolean;
}

export interface ProductionToolWearInput {
  /** Machine-assigned cycle-counted tools (all non-RETIRED qualify). */
  cycleTools: CycleToolInput[];
  /** Machine-assigned unit-life tools (all non-SCRAPPED qualify). */
  unitTools: MaintenanceToolInput[];
  /** Pieces produced (LOG_GOOD qty) — each piece is one cycle/unit of wear. */
  units: number;
  now?: Date;
}

export interface ProductionToolWearProjection {
  cycles: CycleWearUpdate[];
  units: UnitWearUpdate[];
}

export function projectProductionToolWear(input: ProductionToolWearInput): ProductionToolWearProjection {
  const at = input.now ?? new Date();

  const cycles: CycleWearUpdate[] = [];
  for (const t of input.cycleTools) {
    if (t.status === "RETIRED") continue; // retired tooling is out of circulation
    const r = recordCycles(t, input.units, at);
    if (r.tag === "err") continue; // e.g. INVALID_CYCLES — never partially applied
    const v = r.value;
    cycles.push({
      id: v.id,
      currentCycles: v.currentCycles,
      status: v.status,
      changed: v.currentCycles !== t.currentCycles || v.status !== t.status,
    });
  }

  const units: UnitWearUpdate[] = [];
  for (const t of input.unitTools) {
    if (t.lifeStatus === "SCRAPPED") continue; // scrapped tooling is out of circulation
    const r = consumeUnits(t, input.units, at);
    if (r.tag === "err") continue;
    const v = r.value;
    units.push({
      id: v.id,
      usedUnits: v.usedUnits,
      lifeStatus: v.lifeStatus,
      // true only on the state crossing — a tool already in NEEDS_REGRIND keeps
      // wearing but must not re-fire the CONSUME alert (no log spam per LOG_GOOD)
      // (SCRAPPED is unreachable here — skipped above)
      crossedThreshold:
        (v.lifeStatus === "NEEDS_REGRIND" || v.lifeStatus === "SCRAPPED") &&
        t.lifeStatus !== "NEEDS_REGRIND",
    });
  }

  return { cycles, units };
}