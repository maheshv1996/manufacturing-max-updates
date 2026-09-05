import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import {
  getSystemConstantsTx,
  updateSystemConstantsTx,
} from "@/lib/system/settingsTx";

export const dynamic = "force-dynamic";

const updateConstantsSchema = z.object({
  oeeTargetPct: z.number().min(0).max(100).optional(),
  countTolerancePct: z.number().min(0).max(100).optional(),
  requireMillCerts: z.boolean().optional(),
  maxOvertimeHoursWeekly: z.number().min(0).max(168).optional(),
  defaultTimezone: z.string().min(1).max(64).optional(),
  currencyCode: z.string().min(1).max(10).optional(),
});

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!can(user, "system.view") && !can(user, "ops.view"))) {
      throw forbidden("system.view or ops.view permission required");
    }

    const constants = await getSystemConstantsTx(prisma);
    return NextResponse.json({ constants });
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

export async function PUT(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "system.edit")) {
      throw forbidden("system.edit permission required");
    }

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(updateConstantsSchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const constants = await updateSystemConstantsTx(
      prisma,
      parsed.value,
      { id: user.id, name: user.name || "Admin" },
    );

    return NextResponse.json({ constants });
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
