import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden, validation } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { executeCopilotTaskTx } from "@/lib/copilot/copilotTx";

export const dynamic = "force-dynamic";

const copilotChatSchema = z.object({
  toolId: z.string().min(1).max(64),
  context: z.record(z.string(), z.unknown()).default({}),
  activeTier: z.enum(["TIER_A", "TIER_B", "TIER_C", "TIER_D"]).optional(),
  targetApproverUserId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      throw forbidden("Authenticated session required");
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = parseOr400(copilotChatSchema, rawBody);
    if (parsed.tag === "err") throw parsed.error;
    const body = parsed.value;

    const result = await executeCopilotTaskTx(prisma, {
      toolId: body.toolId,
      context: body.context,
      actor: {
        id: user.id,
        name: user.name || user.id,
        isOwner: user.isOwner,
      },
      activeTier: body.activeTier,
      targetApproverUserId: body.targetApproverUserId,
    });

    if (result.error) {
      throw validation(result.error);
    }

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const api = toApiError(e);
    const status = api.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(api, { status });
  }
}
