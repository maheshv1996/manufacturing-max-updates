import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { getProductionRegisterTx } from "@/lib/reports/reportsTx";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!can(user, "ops.view") && !can(user, "exec.view") && !can(user, "reports.print"))) {
      throw forbidden("ops.view, exec.view or reports.print permission required");
    }

    const { searchParams } = new URL(request.url);
    const machineId = searchParams.get("machineId") || undefined;
    const plantId = searchParams.get("plantId") || undefined;

    const now = new Date();
    const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const startDate = startDateParam ? new Date(startDateParam) : defaultStart;
    const endDate = endDateParam ? new Date(endDateParam) : now;

    const register = await getProductionRegisterTx(prisma, {
      startDate,
      endDate,
      machineId,
      plantId,
    });

    return NextResponse.json({ success: true, register });
  } catch (e) {
    const api = toApiError(e);
    const status = api.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(api, { status });
  }
}
