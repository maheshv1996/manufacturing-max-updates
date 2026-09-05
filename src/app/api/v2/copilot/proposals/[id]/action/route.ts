import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden, validation } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { decideAiProposalTx } from "@/lib/copilot/copilotTx";

export const dynamic = "force-dynamic";

const decideProposalSchema = z.object({
  decision: z.enum(["ACCEPT", "REJECT"]),
  reason: z.string().min(1).max(1000),
  actorSeatId: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      throw forbidden("Authenticated session required");
    }

    const resolvedParams = await Promise.resolve(params);
    const proposalId = resolvedParams.id;

    const rawBody = await request.json().catch(() => null);
    const parsed = parseOr400(decideProposalSchema, rawBody);
    if (parsed.tag === "err") throw parsed.error;
    const body = parsed.value;

    // Fetch user permissions & level
    const userRow = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        isOwner: true,
        level: true,
        role: { select: { permissions: true } },
        roleAssignments: {
          include: {
            role: { select: { permissions: true } },
          },
        },
      },
    });

    if (!userRow) {
      throw forbidden("User record not found");
    }

    const permissions = new Set<string>(userRow.role?.permissions ?? []);
    for (const a of userRow.roleAssignments) {
      for (const p of a.role?.permissions ?? []) {
        permissions.add(p);
      }
    }
    if (userRow.isOwner) {
      permissions.add("kpi.override");
      permissions.add("records.edit");
      permissions.add("ops.approve");
      permissions.add("finance.approve");
      permissions.add("quality.approve");
    }

    const rank = userRow.isOwner ? 5 : userRow.level === "MANAGER" ? 4 : 2;

    const result = await decideAiProposalTx(prisma, {
      proposalId,
      decision: body.decision,
      reason: body.reason,
      actor: {
        id: userRow.id,
        name: userRow.name || userRow.id,
        isOwner: userRow.isOwner,
      },
      actorPermissions: [...permissions],
      actorLevelRank: rank,
      actorSeatId: body.actorSeatId,
    });

    if (!result.success) {
      throw validation(result.error || "Proposal decision could not be processed");
    }

    return NextResponse.json({
      success: true,
      proposalId,
      decision: body.decision,
    });
  } catch (e) {
    const api = toApiError(e);
    const status = api.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(api, { status });
  }
}
