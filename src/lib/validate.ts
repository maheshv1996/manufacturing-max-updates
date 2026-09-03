import { z } from "zod";
import { NextResponse } from "next/server";

/**
 * Central validation helper — returns 400 with structured details instead of 500 + stack leak.
 * Use at the top of POST/PUT handlers before any DB work.
 */
export function parseOr400<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { ok: true; data: T } | { ok: false; response: NextResponse } {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    response: NextResponse.json(
      {
        error: "Validation failed",
        issues: result.error.flatten(),
      },
      { status: 400 },
    ),
  };
}

// ---- Money-path schemas (PR2) ----

export const createPoSchema = z.object({
  action: z.literal("CREATE_PO"),
  supplierId: z.string().cuid().or(z.string().min(1)), // allow cuid or legacy id
  rawMaterialId: z.string().min(1),
  qty: z.coerce.number().positive().finite().max(1_000_000),
  unitCost: z.coerce.number().nonnegative().finite().max(100_000_000),
  expectedDate: z.string().datetime().or(z.string().min(1)).nullable().optional(),
});

export const inventorySchema = z.object({
  action: z.enum(["IN", "OUT", "ADJUST"]),
  rawMaterialId: z.string().min(1),
  qty: z.coerce.number().finite(),
  unitCost: z.coerce.number().finite().optional().nullable(),
  batchNo: z.string().max(100).optional().nullable(),
  reference: z.string().max(200).optional().nullable(),
  workOrderId: z.string().optional().nullable(),
  heatNumber: z.string().max(100).optional().nullable(),
  certNumber: z.string().max(100).optional().nullable(),
  certType: z.string().max(50).optional().nullable(),
  specGrade: z.string().max(100).optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  certFileBase64: z.string().optional().nullable(),
  certMimeType: z.string().max(100).optional().nullable(),
  certSizeKb: z.coerce.number().optional().nullable(),
  clientId: z.string().max(200).optional().nullable(),
});

export const invoicePaySchema = z.object({
  id: z.string().min(1),
  amount: z.coerce.number().positive().finite().optional(),
  method: z.string().max(50).optional(),
  reference: z.string().max(200).optional(),
});

export const quotationSchema = z.object({
  customerName: z.string().min(1).max(200),
  customerContact: z.string().max(200).optional().nullable(),
  validUntil: z.string().datetime().or(z.string().min(1)).optional().nullable(),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        plannedQty: z.coerce.number().positive().max(1_000_000),
        unitPrice: z.coerce.number().nonnegative().max(100_000_000),
      }),
    )
    .min(1)
    .max(50),
  notes: z.string().max(5000).optional().nullable(),
  discountPct: z.coerce.number().min(0).max(100).optional(),
});

export const grnSchema = z.object({
  entity: z.enum(["grn", "invoice", "inspect", "aql-plan", "pay"]),
  data: z.record(z.string(), z.any()).optional(),
  clientId: z.string().max(200).optional().nullable(),
});
