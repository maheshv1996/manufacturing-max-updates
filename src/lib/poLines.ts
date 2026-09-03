/**
 * Shared helpers for multi-line PurchaseOrder documents.
 *
 * Migration model: every PO created after this module lands carries one or more
 * `PurchaseOrderLine` rows. The legacy header scalars (rawMaterialId / qty /
 * unitCost / receivedQty) are kept as the *first-line mirror* so every existing
 * single-material consumer keeps working. Money math must go through these
 * helpers so multi-line documents are never under-counted.
 */
import type { PurchaseOrderLine, RawMaterial } from "@prisma/client";

export interface PoItem {
  rawMaterialId: string;
  qty: number;
  unitCost: number;
}

/** PO payload shape that includes an explicit items array (or legacy scalar fields). */
export type PoCreatePayload =
  | { items: PoItem[] }
  | { rawMaterialId: string; qty: number; unitCost: number };

/**
 * Normalize a PO create payload to an items array. Accepts the legacy
 * single-item shape (`rawMaterialId`/`qty`/`unitCost`) and the new
 * `items: [...]` shape. Throws on invalid quantities.
 */
export function normalizePoItems(body: PoCreatePayload): PoItem[] {
  let items: PoItem[];
  if (Array.isArray((body as any).items) && (body as any).items.length > 0) {
    items = (body as any).items.map((it: any) => ({
      rawMaterialId: String(it.rawMaterialId),
      qty: Number(it.qty),
      unitCost: Number(it.unitCost),
    }));
  } else if ((body as any).rawMaterialId) {
    items = [
      {
        rawMaterialId: String((body as any).rawMaterialId),
        qty: Number((body as any).qty),
        unitCost: Number((body as any).unitCost),
      },
    ];
  } else {
    throw new Error("A PO needs at least one material line (rawMaterialId + qty + unitCost)");
  }

  for (const it of items) {
    if (!it.rawMaterialId) throw new Error("Each line needs a rawMaterialId");
    if (!Number.isFinite(it.qty) || it.qty <= 0) {
      throw new Error("Each line needs a positive quantity");
    }
    if (!Number.isFinite(it.unitCost) || it.unitCost < 0) {
      throw new Error("Each line needs a valid unit cost");
    }
  }
  return items;
}

export function poItemsTotal(items: PoItem[]): number {
  return items.reduce((s, it) => s + it.qty * it.unitCost, 0);
}

type PoWithLines = {
  qty?: number;
  unitCost?: number;
  receivedQty?: number;
  lines?: (Pick<PurchaseOrderLine, "qty" | "unitCost" | "receivedQty"> & {
    rawMaterial?: Pick<RawMaterial, "id" | "sku" | "name" | "unit"> | RawMaterial | null;
  })[];
};


/** Total ordered value of a PO — sums lines when present, falls back to header mirror. */
export function poOrderedValue(po: PoWithLines): number {
  if (po.lines && po.lines.length > 0) {
    return po.lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
  }
  return (po.qty || 0) * (po.unitCost || 0);
}

/** Total received value of a PO — sums per-line received qty × line unit cost. */
export function poReceivedValue(po: PoWithLines): number {
  if (po.lines && po.lines.length > 0) {
    return po.lines.reduce((s, l) => s + (l.receivedQty || 0) * l.unitCost, 0);
  }
  return (po.receivedQty || 0) * (po.unitCost || 0);
}

/** Ordered qty across all lines (fallback: header qty). */
export function poOrderedQty(po: PoWithLines): number {
  if (po.lines && po.lines.length > 0) {
    return po.lines.reduce((s, l) => s + l.qty, 0);
  }
  return po.qty || 0;
}

/** Received qty across all lines (fallback: header receivedQty). */
export function poReceivedQty(po: PoWithLines): number {
  if (po.lines && po.lines.length > 0) {
    return po.lines.reduce((s, l) => s + (l.receivedQty || 0), 0);
  }
  return po.receivedQty || 0;
}

/** True when every line is fully received (or the single legacy line is). */
export function poFullyReceived(po: PoWithLines): boolean {
  if (po.lines && po.lines.length > 0) {
    return po.lines.every((l) => (l.receivedQty || 0) >= l.qty - 0.001);
  }
  return (po.receivedQty || 0) >= (po.qty || 0) - 0.001;
}

/**
 * Resolve which PO line a receipt should apply to. When `poLineId` is omitted
 * and the PO has a single line (or none — legacy data), the implicit line is
 * the header. Throws for multi-line POs without an explicit line choice.
 */
export function resolveReceiveLine(
  po: PoWithLines & { id: string; rawMaterialId: string },
  poLineId?: string | null,
): { lineId: string; rawMaterialId: string; remaining: number } {
  const lines = po.lines || [];
  if (lines.length > 1 && !poLineId) {
    throw new Error("This PO has multiple lines — choose which line is being received");
  }
  const all = lines as any[];
  const line = all.length > 0 ? all.find((l: any) => l.id === poLineId) || all[0] : null;
  if (poLineId && !line) {
    throw new Error("PO line not found");
  }
  const qty = line ? line.qty : po.qty || 0;
  const received = line ? line.receivedQty || 0 : po.receivedQty || 0;
  return {
    lineId: line ? line.id : "",
    rawMaterialId: line ? line.rawMaterialId || po.rawMaterialId : po.rawMaterialId,
    remaining: Math.max(0, qty - received),
  };
}
