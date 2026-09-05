import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { getMorningDigestTx } from "@/lib/reports/reportsTx";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!can(user, "exec.view") && !can(user, "reports.print"))) {
      throw forbidden("exec.view or reports.print permission required");
    }

    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get("plantId") || undefined;
    const targetDateParam = searchParams.get("targetDate");
    const targetDate = targetDateParam ? new Date(targetDateParam) : undefined;

    const digest = await getMorningDigestTx(prisma, {
      plantId,
      targetDate,
    });

    return NextResponse.json({ success: true, digest });
  } catch (e) {
    const api = toApiError(e);
    const status = api.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(api, { status });
  }
}
