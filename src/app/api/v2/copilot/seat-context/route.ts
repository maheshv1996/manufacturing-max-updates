import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { getSeatContextBundleTx } from "@/lib/copilot/copilotTx";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      throw forbidden("Authenticated session required");
    }

    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get("plantId") || undefined;
    const unitId = searchParams.get("unitId") || undefined;

    const bundle = await getSeatContextBundleTx(prisma, user.id, unitId, plantId);
    if (!bundle) {
      return NextResponse.json({ success: false, error: "Seat context not found or user inactive" }, { status: 404 });
    }

    return NextResponse.json({ success: true, seatContext: bundle });
  } catch (e) {
    const api = toApiError(e);
    const status = api.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(api, { status });
  }
}
