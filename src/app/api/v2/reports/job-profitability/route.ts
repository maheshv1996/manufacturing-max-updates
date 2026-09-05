import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { getJobProfitabilityRegisterTx } from "@/lib/reports/reportsTx";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!can(user, "finance.view") && !can(user, "exec.view") && !can(user, "reports.print"))) {
      throw forbidden("finance.view, exec.view or reports.print permission required");
    }

    const { searchParams } = new URL(request.url);
    const workOrderId = searchParams.get("workOrderId") || undefined;
    const customerId = searchParams.get("customerId") || undefined;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    const report = await getJobProfitabilityRegisterTx(prisma, {
      startDate,
      endDate,
      customerId,
      workOrderId,
    });

    return NextResponse.json({ success: true, ...report });
  } catch (e) {
    const api = toApiError(e);
    const status = api.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(api, { status });
  }
}
