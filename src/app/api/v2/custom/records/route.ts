import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden, validation } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import {
  createCustomRecordTx,
  getCustomRecordsTx,
} from "@/lib/custom/customTx";

export const dynamic = "force-dynamic";

const createRecordSchema = z.object({
  entityId: z.string().min(1),
  values: z.record(z.string(), z.unknown()),
});

export async function GET(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!can(user, "system.view") && !can(user, "ops.view"))) {
      throw forbidden("system.view or ops.view permission required");
    }

    const url = new URL(req.url);
    const entityId = url.searchParams.get("entityId");
    if (!entityId) {
      throw validation("entityId query parameter is required");
    }

    const take = Math.min(Math.max(Number(url.searchParams.get("take")) || 100, 1), 500);
    const skip = Math.max(Number(url.searchParams.get("skip")) || 0, 0);

    const records = await getCustomRecordsTx(prisma, entityId, { take, skip });
    return NextResponse.json({ records });
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

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!can(user, "system.edit") && !can(user, "ops.edit"))) {
      throw forbidden("system.edit or ops.edit permission required");
    }

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(createRecordSchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const record = await createCustomRecordTx(
      prisma,
      parsed.value,
      { id: user.id, name: user.name || "Operator" },
    );

    return NextResponse.json({ record }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN"
        ? 403
        : api.error === "NOT_FOUND"
          ? 404
          : api.error === "CONFLICT"
            ? 409
            : api.error === "VALIDATION"
              ? 422
              : 400;
    return NextResponse.json(api, { status });
  }
}
