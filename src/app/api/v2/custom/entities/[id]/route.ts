import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden, notFound } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import {
  getCustomEntityByIdTx,
  updateCustomEntityTx,
} from "@/lib/custom/customTx";

export const dynamic = "force-dynamic";

const updateEntitySchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(64).optional().nullable(),
  colorTone: z.string().max(32).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!can(user, "system.view") && !can(user, "ops.view"))) {
      throw forbidden("system.view or ops.view permission required");
    }

    const resolvedParams = await Promise.resolve(params);
    const entity = await getCustomEntityByIdTx(prisma, resolvedParams.id);
    if (!entity) {
      throw notFound("Custom entity not found");
    }

    return NextResponse.json({ entity });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN"
        ? 403
        : api.error === "NOT_FOUND"
          ? 404
          : api.error === "VALIDATION"
            ? 422
            : 400;
    return NextResponse.json(api, { status });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "system.edit")) {
      throw forbidden("system.edit permission required");
    }

    const resolvedParams = await Promise.resolve(params);
    const body = await req.json().catch(() => null);
    const parsed = parseOr400(updateEntitySchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const entity = await updateCustomEntityTx(
      prisma,
      resolvedParams.id,
      parsed.value,
      { id: user.id, name: user.name || "Admin" },
    );

    return NextResponse.json({ entity });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN"
        ? 403
        : api.error === "NOT_FOUND"
          ? 404
          : api.error === "VALIDATION"
            ? 422
            : 400;
    return NextResponse.json(api, { status });
  }
}
