import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { recordRcaTx } from "@/lib/lean/leanTx";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  problemStatement: z.string().trim().max(2000).optional().nullable(),
  why1: z.string().trim().max(1000).optional().nullable(),
  why2: z.string().trim().max(1000).optional().nullable(),
  why3: z.string().trim().max(1000).optional().nullable(),
  why4: z.string().trim().max(1000).optional().nullable(),
  why5: z.string().trim().max(1000).optional().nullable(),
  rootCause: z.string().trim().max(2000).optional().nullable(),
  fishboneCategory: z
    .enum(["MAN", "MACHINE", "METHOD", "MATERIAL", "MEASUREMENT", "ENVIRONMENT"])
    .optional()
    .nullable(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "projects.edit")) throw forbidden("projects.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const rca = await recordRcaTx(
      prisma,
      { id: user.id, name: user.name },
      params.id,
      parsed.value,
    );
    return NextResponse.json({ success: true, rca });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}
