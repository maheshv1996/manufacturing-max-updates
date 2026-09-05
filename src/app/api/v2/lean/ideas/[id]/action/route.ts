import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { upvoteIdeaTx, transitionIdeaTx } from "@/lib/lean/leanTx";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("UPVOTE") }),
  z.object({ action: z.literal("START_REVIEW") }),
  z.object({ action: z.literal("IMPLEMENT") }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) throw forbidden("Authentication required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    if (a.action === "UPVOTE") {
      const idea = await upvoteIdeaTx(
        prisma,
        { id: user.id, name: user.name },
        id,
      );
      return NextResponse.json({ success: true, idea });
    }

    if (!can(user, "projects.edit") && !can(user, "ops.edit")) {
      throw forbidden("projects.edit or ops.edit required");
    }

    const idea = await transitionIdeaTx(
      prisma,
      { id: user.id, name: user.name },
      id,
      a.action,
    );
    return NextResponse.json({ success: true, idea });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}
