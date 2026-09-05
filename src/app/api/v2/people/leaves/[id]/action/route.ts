import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { approveLeave, rejectLeave, cancelLeave } from "@/lib/people/peopleTx";

export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "CANCEL"]),
  note: z.string().trim().max(1000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "people.edit")) throw forbidden("people.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(actionSchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const { action, note } = parsed.value;

    switch (action) {
      case "APPROVE":
        await approveLeave(prisma, { id: user.id, name: user.name }, id, note);
        break;
      case "REJECT":
        await rejectLeave(prisma, { id: user.id, name: user.name }, id, note);
        break;
      case "CANCEL":
        await cancelLeave(prisma, { id: user.id, name: user.name }, id);
        break;
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}
