import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { receiveGrnTx } from "@/lib/supply/supplyTx";

export const dynamic = "force-dynamic";

const certSchema = z.object({
  heatNumber: z.string().trim().min(1).max(64),
  certNumber: z.string().trim().max(64).optional(),
  specGrade: z.string().trim().max(64).optional(),
  certType: z.enum(["MILL_CERT", "COC", "TEST_REPORT"]).optional(),
});

const bodySchema = z.object({
  poId: z.string().trim().min(1),
  qty: z.number().positive(),
  batchNo: z.string().trim().max(64).optional(),
  notes: z.string().trim().max(2000).optional(),
  certs: z.array(certSchema).max(500).optional(),
  clientId: z.string().trim().min(1).max(128).optional(),
});

/** POST — receive goods against a PO (supply.edit). Engine-gated: double
 * receipt, cert-before-use (W3), over-delivery tolerance. */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "supply.edit")) throw forbidden("supply.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    const result = await receiveGrnTx(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      poId: a.poId,
      qty: a.qty,
      batchNo: a.batchNo,
      notes: a.notes,
      certs: a.certs,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "GRN already posted (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, grn: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}