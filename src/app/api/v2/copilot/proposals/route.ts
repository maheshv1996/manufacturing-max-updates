import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { getPendingProposalsTx } from "@/lib/copilot/copilotTx";

export const dynamic = "force-dynamic";

export async function GET(_request: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      throw forbidden("Authenticated session required");
    }

    const proposals = await getPendingProposalsTx(prisma, user.isOwner ? undefined : user.id);

    return NextResponse.json({
      success: true,
      count: proposals.length,
      proposals,
    });
  } catch (e) {
    const api = toApiError(e);
    const status = api.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(api, { status });
  }
}
