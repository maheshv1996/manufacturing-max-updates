import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { receiveBackChallanTx, signOffChallanTx } from "@/lib/supply/supplyTx";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("RECEIVE_BACK"),
    challanId: z.string().trim().min(1),
    receivedQty: z.number().int().nonnegative(),
    certsPresent: z.number().int().nonnegative(),
    specialProcessCertsRequired: z.number().int().nonnegative(),
    clientId: z.string().trim().min(1).max(128).optional(),
  }),
  z.object({
    action: z.literal("SIGNOFF"),
    challanId: z.string().trim().min(1),
    result: z.enum(["PASS", "FAIL"]),
    clientId: z.string().trim().min(1).max(128).optional(),
  }),
]);

/** POST — receive a challan back (certs gated) or QC-sign it off
 * (supply.edit; FAIL routes an NCR flag for the quality flow). */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "supply.edit")) throw forbidden("supply.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    const result =
      a.action === "RECEIVE_BACK"
        ? await receiveBackChallanTx(prisma, {
            actor: { id: user.id, name: user.name },
            clientId: a.clientId,
            challanId: a.challanId,
            receivedQty: a.receivedQty,
            certsPresent: a.certsPresent,
            specialProcessCertsRequired: a.specialProcessCertsRequired,
          })
        : await signOffChallanTx(prisma, {
            actor: { id: user.id, name: user.name },
            clientId: a.clientId,
            challanId: a.challanId,
            result: a.result,
          });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Challan transition already applied (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, challan: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}