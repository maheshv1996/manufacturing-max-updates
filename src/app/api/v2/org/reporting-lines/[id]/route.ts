import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { terminateReportingLineTx } from "@/lib/org/reportingLineTx";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "users.manage")) {
      throw forbidden("users.manage permission required");
    }

    const resolvedParams = await Promise.resolve(params);
    const line = await terminateReportingLineTx(
      prisma,
      resolvedParams.id,
      { id: user.id, name: user.name || "Admin" },
    );

    return NextResponse.json({ line });
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
