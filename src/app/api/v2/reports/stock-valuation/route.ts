import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { getStockValuationRegisterTx } from "@/lib/reports/reportsTx";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (
      !user.id ||
      (!can(user, "supply.view") &&
        !can(user, "finance.view") &&
        !can(user, "exec.view") &&
        !can(user, "reports.print"))
    ) {
      throw forbidden("supply.view, finance.view, exec.view or reports.print permission required");
    }

    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get("plantId") || undefined;

    const valuation = await getStockValuationRegisterTx(prisma, {
      plantId,
    });

    return NextResponse.json({ success: true, valuation });
  } catch (e) {
    const api = toApiError(e);
    const status = api.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(api, { status });
  }
}
