import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import {
  getTerminologyMapTx,
  updateTerminologyMapTx,
} from "@/lib/system/settingsTx";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!can(user, "system.view") && !can(user, "ops.view"))) {
      throw forbidden("system.view or ops.view permission required");
    }

    const { effective, overrides } = await getTerminologyMapTx(prisma);
    return NextResponse.json({ effective, overrides });
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
    const result = await updateTerminologyMapTx(
      prisma,
      body,
      { id: user.id, name: user.name || "Admin" },
    );

    return NextResponse.json(result);
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
