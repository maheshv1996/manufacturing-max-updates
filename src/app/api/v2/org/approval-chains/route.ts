import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { recordAudit } from "@/lib/core/integrityDb";
import { SCOPE_VALUES } from "@/lib/org/orgConstants";

export const dynamic = "force-dynamic";

const chainStepSchema = z.object({
  criteria: z
    .object({
      roleId: z.string().optional(),
      levelMin: z.number().int().min(0).optional(),
      scope: z.enum(SCOPE_VALUES).optional(),
    })
    .default({}),
  minApprovals: z.number().int().min(1).max(10).default(1),
  fallback: z
    .object({
      escalateLevels: z.number().int().min(0).max(10).optional(),
      routeTo: z.enum(["unitHead"]).optional(),
    })
    .default({}),
});

const createChainSchema = z.object({
  entityType: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  isActive: z.boolean().default(true),
  steps: z.array(chainStepSchema).min(1).max(20),
});

function requireOrgAdmin(user: ReturnType<typeof getUserFromHeaders>): void {
  if (!user.id || !can(user, "users.manage")) {
    throw forbidden("users.manage required");
  }
}

/** GET — approval chains, optionally filtered by ?entityType=. */
export async function GET(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    requireOrgAdmin(user);

    const entityType = new URL(req.url).searchParams.get("entityType")?.trim() || undefined;
    const chains = await prisma.approvalChain.findMany({
      where: { isActive: true, ...(entityType ? { entityType } : {}) },
      orderBy: [{ entityType: "asc" }, { name: "asc" }],
      select: {
        id: true,
        entityType: true,
        name: true,
        steps: true,
        isActive: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ chains });
  } catch (e) {
    const api = toApiError(e);
    return NextResponse.json(api, { status: api.error === "FORBIDDEN" ? 403 : 400 });
  }
}

/** POST — create an approval chain (users.manage). */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const actor = getUserFromHeaders(headersList);
    requireOrgAdmin(actor);

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(createChainSchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const { entityType, name, isActive, steps } = parsed.value;

    const created = await prisma.approvalChain.create({
      data: {
        entityType,
        name,
        isActive,
        steps: steps as unknown as object,
        createdBy: actor.id,
      },
      select: { id: true, entityType: true, name: true, steps: true, isActive: true },
    });

    await recordAudit(prisma, {
      actor: actor.id,
      action: "APPROVAL_CHAIN_CREATED",
      entityType: "ApprovalChain",
      entityId: created.id,
      details: JSON.stringify({ entityType, name, stepCount: steps.length }),
    });

    return NextResponse.json({ chain: created }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status = api.error === "FORBIDDEN" ? 403 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}
