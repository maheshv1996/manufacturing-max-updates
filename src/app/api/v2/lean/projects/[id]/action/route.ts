import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { projectActionTx } from "@/lib/lean/leanTx";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["ADVANCE_PHASE", "HOLD", "RESUME", "COMPLETE"]),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "projects.edit")) throw forbidden("projects.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const project = await projectActionTx(
      prisma,
      { id: user.id, name: user.name },
      params.id,
      parsed.value.action,
    );
    return NextResponse.json({ success: true, project });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}
