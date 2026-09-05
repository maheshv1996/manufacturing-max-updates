import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { createInvoice } from "@/lib/commercial/commercialTx";

export const dynamic = "force-dynamic";

const lineSchema = z.object({
  taxableValue: z.number().nonnegative(),
  cgstPct: z.number().min(0).max(100).default(0),
  sgstPct: z.number().min(0).max(100).default(0),
  igstPct: z.number().min(0).max(100).default(0),
});

const bodySchema = z.object({
  invoiceNumber: z.string().trim().min(1).max(64),
  dispatchRecordId: z.string().trim().optional(),
  workOrderId: z.string().trim().optional(),
  customerName: z.string().trim().min(1).max(200),
  customerAddress: z.string().trim().max(500).optional(),
  customerGstin: z.string().trim().max(20).optional(),
  taxableValue: z.number().nonnegative(),
  taxType: z.enum(["INTRA", "INTER"]).default("INTRA"),
  taxRatePct: z.number().min(0).max(100).default(18),
  cgstAmt: z.number().nonnegative().optional(),
  sgstAmt: z.number().nonnegative().optional(),
  igstAmt: z.number().nonnegative().optional(),
  lines: z.array(lineSchema).min(1),
  notes: z.string().trim().max(2000).optional(),
  clientId: z.string().trim().min(1).max(128).optional(),
});

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "commercial.edit")) throw forbidden("commercial.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    const result = await createInvoice(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      invoiceNumber: a.invoiceNumber,
      dispatchRecordId: a.dispatchRecordId,
      workOrderId: a.workOrderId,
      customerName: a.customerName,
      customerAddress: a.customerAddress,
      customerGstin: a.customerGstin,
      taxableValue: a.taxableValue,
      taxType: a.taxType,
      taxRatePct: a.taxRatePct,
      cgstAmt: a.cgstAmt,
      sgstAmt: a.sgstAmt,
      igstAmt: a.igstAmt,
      lines: a.lines,
      notes: a.notes,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Invoice already created (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, invoice: result }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : api.error === "CONFLICT" ? 409 : 400;
    return NextResponse.json(api, { status });
  }
}
