/**
 * C8-5 — Spares & kits (W11: "Spares: MaintenanceJob → spare issue → SparePart
 * stock OUT → reorder at min"). Pure — the adapter turns results into
 * SparePart updates + audit rows; no silent negative stock, ever.
 */

import { ok, err, type Result } from "../core/result";

export interface SparePartInput {
  id: string;
  sku: string;
  name: string;
  currentQty: number;
  minQty: number;
  reorderPoint: number;
  leadTimeDays: number;
  avgDailyUsage: number;
}

export type SpareError = "INSUFFICIENT_STOCK" | "INVALID_QTY";

export function issueSpare(spare: SparePartInput, qty: number): Result<SparePartInput, SpareError> {
  if (!Number.isFinite(qty) || qty <= 0) return err("INVALID_QTY");
  if (spare.currentQty - qty < 0) return err("INSUFFICIENT_STOCK");
  return ok({ ...spare, currentQty: spare.currentQty - qty });
}

export function receiveSpare(spare: SparePartInput, qty: number): Result<SparePartInput, SpareError> {
  if (!Number.isFinite(qty) || qty <= 0) return err("INVALID_QTY");
  return ok({ ...spare, currentQty: spare.currentQty + qty });
}

export interface ReorderSignal {
  reorder: boolean;
  /** Qty that restores stock to reorderPoint + one lead-time of usage. */
  suggestedQty?: number;
}

export function needsReorder(spare: Pick<SparePartInput, "currentQty" | "reorderPoint" | "leadTimeDays" | "avgDailyUsage">): ReorderSignal {
  if (spare.currentQty > spare.reorderPoint) return { reorder: false };
  const leadTimeBuffer = (spare.leadTimeDays || 0) * (spare.avgDailyUsage || 0);
  return { reorder: true, suggestedQty: Math.ceil(spare.reorderPoint + leadTimeBuffer - spare.currentQty) };
}

export interface SpareKitLine {
  spare: SparePartInput;
  required: number;
}

export interface KitShortfall {
  canIssue: boolean;
  missing: { spareId: string; sku: string; shortBy: number }[];
}

/** Can this kit be consumed in full right now? Lists exactly what's short. */
export function kitShortfall(lines: SpareKitLine[]): KitShortfall {
  const missing = lines
    .filter((l) => l.spare.currentQty < l.required)
    .map((l) => ({ spareId: l.spare.id, sku: l.spare.sku, shortBy: Math.ceil(l.required - l.spare.currentQty) }));
  return { canIssue: missing.length === 0, missing };
}
