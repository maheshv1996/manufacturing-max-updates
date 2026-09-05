import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden, conflict } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { recordAudit } from "@/lib/core/integrityDb";
import { UNIT_TYPES } from "@/lib/org/orgConstants";

export const dynamic = "force-dynamic";

const createUnitSchema = z.object({
  code: z
    .string()
    .regex(/^[A-Z0-9][A-Z0-9_-]{0,63}$/, "code must be UPPER alphanumeric (max 64)")
    .toUpperCase(),
  name: z.string().min(1).max(200),
  type: z.enum(UNIT_TYPES),
  parentId: z.string().optional().nullable(),
  headUserId: z.string().optional().nullable(),
  costCenter: z.string().optional().nullable(),
});

function requireOrgAdmin(user: ReturnType<typeof getUserFromHeaders>): void {
  if (!user.id || !can(user, "users.manage")) {
    throw forbidden("users.manage required");
  }
}

/** GET — active org units (flat list, org admin). */
export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    requireOrgAdmin(user);

    const units = await prisma.orgUnit.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        parentId: true,
        headUserId: true,
        isActive: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ units });
  } catch (e) {
    const api = toApiError(e);
    return NextResponse.json(api, { status: api.error === "FORBIDDEN" ? 403 : 400 });
  }
}

/** POST — create an org unit (users.manage). */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    requireOrgAdmin(user);

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(createUnitSchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const { code, name, type, parentId, headUserId, costCenter } = parsed.value;

    let created;
    try {
      created = await prisma.orgUnit.create({
        data: { code, name, type, parentId: parentId ?? null, headUserId: headUserId ?? null, costCenter: costCenter ?? null },
        select: { id: true, code: true, name: true, type: true, parentId: true },
      });
    } catch (e) {
      if (e instanceof Error && "code" in e && (e as { code?: string }).code === "P2002") {
        throw conflict(`Org unit code '${code}' already exists`);
      }
      throw e;
    }

    await recordAudit(prisma, {
      actor: user.id,
      action: "ORG_UNIT_CREATED",
      entityType: "OrgUnit",
      entityId: created.id,
      details: JSON.stringify({ code, name, type }),
    });

    return NextResponse.json({ unit: created }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "VALIDATION" ? 422 : api.error === "CONFLICT" ? 409 : 400;
    return NextResponse.json(api, { status });
  }
}
