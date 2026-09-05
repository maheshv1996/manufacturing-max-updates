import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { getJobTravelerPrintDataTx } from "@/lib/reports/reportsTx";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (
      !user.id ||
      (!can(user, "ops.view") &&
        !can(user, "quality.view") &&
        !can(user, "reports.print") &&
        !can(user, "exec.view"))
    ) {
      throw forbidden("ops.view, quality.view, reports.print or exec.view permission required");
    }

    const resolvedParams = await Promise.resolve(params);
    const workOrderId = resolvedParams.id;

    const traveler = await getJobTravelerPrintDataTx(
      prisma,
      workOrderId,
      { id: user.id, name: user.name || "Operator" },
    );

    return NextResponse.json({ success: true, traveler });
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
