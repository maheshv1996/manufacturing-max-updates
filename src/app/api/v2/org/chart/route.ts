import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { getOrgChartHierarchyTx } from "@/lib/org/reportingLineTx";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (
      !user.id ||
      (!can(user, "users.manage") &&
        !can(user, "system.view") &&
        !can(user, "ops.view"))
    ) {
      throw forbidden("users.manage, system.view, or ops.view permission required");
    }

    const url = new URL(req.url);
    const plantId = url.searchParams.get("plantId") ?? undefined;

    const hierarchy = await getOrgChartHierarchyTx(prisma, plantId);
    return NextResponse.json({ hierarchy });
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
