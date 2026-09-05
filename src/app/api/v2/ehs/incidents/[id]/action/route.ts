import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { incidentActionTx } from "@/lib/ehs/ehsTx";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("START_INVESTIGATION"),
    capaOwner: z.string().trim().min(1),
    dueDate: z.coerce.date().optional(),
  }),
  z.object({
    action: z.literal("CLOSE"),
    actionTaken: z.string().trim().min(1),
    rootCause: z.string().trim().min(1).optional(),
    fiveWhyReason: z.string().trim().min(1).optional(),
  }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "ehs.edit")) throw forbidden("ehs.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    const result = await incidentActionTx(
      prisma,
      { id: user.id, name: user.name },
      id,
      a.action,
      a.action === "START_INVESTIGATION"
        ? { capaOwner: a.capaOwner, dueDate: a.dueDate }
        : { actionTaken: a.actionTaken, rootCause: a.rootCause, fiveWhyReason: a.fiveWhyReason },
    );
    return NextResponse.json({ success: true, incident: result });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}
