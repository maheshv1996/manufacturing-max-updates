import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden, notFound } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import {
  updateCustomRecordTx,
  deleteCustomRecordTx,
} from "@/lib/custom/customTx";

export const dynamic = "force-dynamic";

const updateRecordSchema = z.object({
  values: z.record(z.string(), z.unknown()),
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
    const record = await prisma.customRecord.findUnique({
      where: { id: resolvedParams.id },
      include: { entity: { include: { fields: true } } },
    });

    if (!record) {
      throw notFound("Custom record not found");
    }

    return NextResponse.json({ record });
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
    if (!user.id || (!can(user, "system.edit") && !can(user, "ops.edit"))) {
      throw forbidden("system.edit or ops.edit permission required");
    }

    const resolvedParams = await Promise.resolve(params);
    const body = await req.json().catch(() => null);
    const parsed = parseOr400(updateRecordSchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const record = await updateCustomRecordTx(
      prisma,
      resolvedParams.id,
      parsed.value.values,
      { id: user.id, name: user.name || "Operator" },
    );

    return NextResponse.json({ record });
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

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "system.edit")) {
      throw forbidden("system.edit permission required");
    }

    const resolvedParams = await Promise.resolve(params);
    const res = await deleteCustomRecordTx(
      prisma,
      resolvedParams.id,
      { id: user.id, name: user.name || "Admin" },
    );

    return NextResponse.json(res);
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
