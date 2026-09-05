import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import {
  createReportingLineTx,
  getReportingLinesTx,
} from "@/lib/org/reportingLineTx";

export const dynamic = "force-dynamic";

const createReportingLineSchema = z.object({
  reportUserId: z.string().min(1),
  managerUserId: z.string().min(1),
  orgUnitId: z.string().optional().nullable(),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!can(user, "users.manage") && !can(user, "system.view"))) {
      throw forbidden("users.manage or system.view permission required");
    }

    const url = new URL(req.url);
    const reportUserId = url.searchParams.get("reportUserId") ?? undefined;
    const managerUserId = url.searchParams.get("managerUserId") ?? undefined;
    const activeOnly = url.searchParams.get("activeOnly") !== "false";

    const lines = await getReportingLinesTx(prisma, {
      reportUserId,
      managerUserId,
      activeOnly,
    });

    return NextResponse.json({ lines });
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
    if (!user.id || !can(user, "users.manage")) {
      throw forbidden("users.manage permission required");
    }

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(createReportingLineSchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const line = await createReportingLineTx(
      prisma,
      parsed.value,
      { id: user.id, name: user.name || "Admin" },
    );

    return NextResponse.json({ line }, { status: 201 });
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
