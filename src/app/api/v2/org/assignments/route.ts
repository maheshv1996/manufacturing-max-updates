import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden, notFound, validation } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { recordAudit } from "@/lib/core/integrityDb";
import { isPermissionKey } from "@/lib/org/permissions";
import { SCOPE_VALUES, ASSIGNMENT_STATUS_VALUES } from "@/lib/org/orgConstants";

export const dynamic = "force-dynamic";

const createAssignmentSchema = z
  .object({
    userId: z.string().min(1),
    orgUnitId: z.string().min(1),
    roleId: z.string().min(1),
    levelName: z.string().min(1).max(64),
    scope: z.enum(SCOPE_VALUES).default("SELF"),
    status: z.enum(ASSIGNMENT_STATUS_VALUES).default("ACTIVE"),
    validFrom: z.string().datetime().optional(),
    validTo: z.string().datetime().optional(),
    actsForUserId: z.string().optional().nullable(),
  })
  .refine((v) => !v.validTo || !v.validFrom || new Date(v.validTo) > new Date(v.validFrom), {
    message: "validTo must be after validFrom",
    path: ["validTo"],
  });

function requireOrgAdmin(user: ReturnType<typeof getUserFromHeaders>): void {
  if (!user.id || !can(user, "users.manage")) {
    throw forbidden("users.manage required");
  }
}

/** POST — create a RoleAssignment (users.manage). */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const actor = getUserFromHeaders(headersList);
    requireOrgAdmin(actor);

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(createAssignmentSchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const a = parsed.value;

    const [targetUser, orgUnit, role, level] = await Promise.all([
      prisma.user.findUnique({ where: { id: a.userId }, select: { id: true, isActive: true } }),
      prisma.orgUnit.findUnique({ where: { id: a.orgUnitId }, select: { id: true, isActive: true } }),
      prisma.role.findUnique({ where: { id: a.roleId }, select: { id: true, permissions: true } }),
      prisma.level.findFirst({ where: { name: a.levelName }, select: { id: true } }),
    ]);

    if (!targetUser || !targetUser.isActive) throw notFound("Target user not found or inactive");
    if (!orgUnit || !orgUnit.isActive) throw notFound("Org unit not found or inactive");
    if (!role) throw notFound("Role not found");
    if (!level) throw validation(`Unknown level '${a.levelName}' — create the level first`);
    const unknownKeys = role.permissions.filter((p) => !isPermissionKey(p));
    if (unknownKeys.length > 0) {
      throw validation(`Role contains unknown permission keys: ${unknownKeys.join(", ")}`);
    }

    const created = await prisma.roleAssignment.create({
      data: {
        userId: a.userId,
        orgUnitId: a.orgUnitId,
        roleId: a.roleId,
        levelName: a.levelName,
        scope: a.scope,
        status: a.status,
        validFrom: a.validFrom ? new Date(a.validFrom) : new Date(),
        validTo: a.validTo ? new Date(a.validTo) : null,
        actsForUserId: a.actsForUserId ?? null,
      },
      select: {
        id: true,
        userId: true,
        orgUnitId: true,
        roleId: true,
        levelName: true,
        scope: true,
        status: true,
        validFrom: true,
        validTo: true,
        actsForUserId: true,
      },
    });

    await recordAudit(prisma, {
      actor: actor.id,
      action: "ROLE_ASSIGNED",
      entityType: "RoleAssignment",
      entityId: created.id,
      details: JSON.stringify({ userId: a.userId, roleId: a.roleId, orgUnitId: a.orgUnitId, levelName: a.levelName }),
    });

    return NextResponse.json({ assignment: created }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403
        : api.error === "NOT_FOUND" ? 404
          : api.error === "VALIDATION" ? 422
            : 400;
    return NextResponse.json(api, { status });
  }
}
