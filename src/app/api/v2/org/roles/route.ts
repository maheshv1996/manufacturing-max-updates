import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden, validation, conflict } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { recordAudit } from "@/lib/core/integrityDb";
import { isPermissionKey } from "@/lib/org/permissions";

export const dynamic = "force-dynamic";

const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(64),
  description: z.string().trim().max(200).optional().nullable(),
  permissions: z.array(z.string().min(1).max(64)).default([]),
});

function requireOrgAdmin(user: ReturnType<typeof getUserFromHeaders>): void {
  if (!user.id || !can(user, "users.manage")) {
    throw forbidden("users.manage required");
  }
}

const roleSelect = {
  id: true,
  name: true,
  description: true,
  permissions: true,
  isSystem: true,
} as const;

/** GET — list roles (org admin). System roles included, read-only. */
export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    requireOrgAdmin(user);

    const roles = await prisma.role.findMany({
      select: roleSelect,
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
    return NextResponse.json({ roles });
  } catch (e) {
    const api = toApiError(e);
    return NextResponse.json(api, { status: api.error === "FORBIDDEN" ? 403 : 400 });
  }
}

/**
 * POST — create an org-defined role (users.manage). DEPTH_02 §8: org-created
 * roles may only reference permission keys from the typed catalog — anything
 * else is rejected. `isSystem` is never settable here (seeded roles only).
 */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const actor = getUserFromHeaders(headersList);
    requireOrgAdmin(actor);

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(createRoleSchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const { name, description, permissions } = parsed.value;
    const deduped = [...new Set(permissions)];
    const unknown = deduped.filter((p) => !isPermissionKey(p));
    if (unknown.length > 0) {
      throw validation(`Unknown permission keys: ${unknown.join(", ")}`);
    }

    let created;
    try {
      created = await prisma.role.create({
        data: { name, description: description || null, permissions: deduped },
        select: roleSelect,
      });
    } catch (e) {
      if (e instanceof Error && "code" in e && (e as { code?: string }).code === "P2002") {
        throw conflict(`Role '${name}' already exists`);
      }
      throw e;
    }

    await recordAudit(prisma, {
      actor: actor.id,
      action: "ROLE_CREATED",
      entityType: "Role",
      entityId: created.id,
      details: JSON.stringify({ name, permissionCount: deduped.length }),
    });

    return NextResponse.json({ role: created }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403
        : api.error === "VALIDATION" ? 422
          : api.error === "CONFLICT" ? 409
            : 400;
    return NextResponse.json(api, { status });
  }
}
