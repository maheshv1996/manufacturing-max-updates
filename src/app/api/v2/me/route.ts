import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError } from "@/lib/core/errors";
import { loadSeatContext } from "@/lib/org/loadSeatContext";

export const dynamic = "force-dynamic";

/**
 * GET /api/v2/me — the caller's seat context (DEPTH_02 §10): effective
 * permissions/level/scope, role codes, acting coverage. The proxy already
 * gated this route behind a valid session.
 */
export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Not signed in" }, { status: 401 });
    }

    const loaded = await loadSeatContext(prisma, user.id);
    if (!loaded.user || !loaded.context) {
      return NextResponse.json({ error: "NOT_FOUND", message: "User not found or inactive" }, { status: 404 });
    }

    return NextResponse.json({
      user: loaded.user,
      seat: {
        seats: loaded.context.seats,
        permissions: [...loaded.context.perms],
        maxLevelRank: loaded.context.maxLevelRank,
        homeSeat: loaded.context.homeSeat,
        roleCodes: loaded.context.roleCodes,
        actsForUserId: loaded.context.actsForUserId,
      },
    });
  } catch (e) {
    const api = toApiError(e);
    return NextResponse.json(api, { status: api.error === "UNAUTHORIZED" ? 401 : api.error === "NOT_FOUND" ? 404 : 400 });
  }
}
