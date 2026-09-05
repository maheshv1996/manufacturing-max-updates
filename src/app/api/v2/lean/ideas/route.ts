import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { submitIdeaTx } from "@/lib/lean/leanTx";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000),
  category: z.string().trim().max(50).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) throw forbidden("Authentication required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const idea = await submitIdeaTx(
      prisma,
      { id: user.id, name: user.name },
      parsed.value,
    );
    return NextResponse.json({ success: true, idea }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}

export async function GET(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) throw forbidden("Authentication required");

    const url = new URL(req.url);
    const status = url.searchParams.get("status");

    const ideas = await prisma.idea.findMany({
      where: status ? { status } : {},
      orderBy: [{ votes: "desc" }, { createdAt: "desc" }],
      take: 200,
    });
    return NextResponse.json({ success: true, ideas });
  } catch (e) {
    const api = toApiError(e);
    const status = api.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(api, { status });
  }
}
