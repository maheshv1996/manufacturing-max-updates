import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { issueSpareToJobTx, issueKitToJobTx } from "@/lib/maintenance/maintenanceTx";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    spareId: z.string().trim().min(1).optional(),
    kitId: z.string().trim().min(1).optional(),
    jobId: z.string().trim().min(1).optional(),
    qty: z.number().positive().optional(),
  })
  .refine((v) => Boolean(v.spareId) !== Boolean(v.kitId), { message: "exactly one of spareId | kitId required" })
  .refine((v) => v.spareId === undefined || typeof v.qty === "number", { message: "qty required when issuing a spare" });

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "maintenance.edit")) throw forbidden("maintenance.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const actor = { id: user.id, name: user.name };
    let result;
    if (parsed.value.spareId) {
      result = await issueSpareToJobTx(prisma, actor, parsed.value.spareId, parsed.value.jobId ?? null, parsed.value.qty!);
    } else {
      if (!parsed.value.jobId) throw new Error("jobId required for kit issue");
      result = await issueKitToJobTx(prisma, actor, parsed.value.kitId!, parsed.value.jobId);
    }
    return NextResponse.json({ success: true, issue: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}