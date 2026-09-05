import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden, conflict } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { recordAudit } from "@/lib/core/integrityDb";

export const dynamic = "force-dynamic";

const createLevelSchema = z.object({
  name: z.string().min(1).max(64),
  rank: z.number().int().min(1).max(100),
  family: z.string().optional().nullable(),
});

function requireOrgAdmin(user: ReturnType<typeof getUserFromHeaders>): void {
  if (!user.id || !can(user, "users.manage")) {
    throw forbidden("users.manage required");
  }
}

/** GET — the level ladder (org admin). */
export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    requireOrgAdmin(user);

    const levels = await prisma.level.findMany({
      orderBy: [{ family: "asc" }, { rank: "asc" }],
      select: { id: true, name: true, rank: true, family: true },
    });
    return NextResponse.json({ levels });
  } catch (e) {
    const api = toApiError(e);
    return NextResponse.json(api, { status: api.error === "FORBIDDEN" ? 403 : 400 });
  }
}

/** POST — add a level to the ladder (org-defined families allowed). */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const actor = getUserFromHeaders(headersList);
    requireOrgAdmin(actor);

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(createLevelSchema, body);
    if (parsed.tag === "err") throw parsed.error;

    const { name, rank, family } = parsed.value;
    const familyValue = family?.trim() || null;

    // NB: `family: null` (global ladder) cannot be used in the compound-unique
    // `where` input, so resolve existing rows via findFirst instead of upsert.
    const existing = await prisma.level.findFirst({ where: { name, family: familyValue } });
    let created;
    if (existing) {
      created = await prisma.level.update({
        where: { id: existing.id },
        data: { rank },
        select: { id: true, name: true, rank: true, family: true },
      });
    } else {
      try {
        created = await prisma.level.create({
          data: { name, rank, family: familyValue },
          select: { id: true, name: true, rank: true, family: true },
        });
      } catch (e) {
        if (e instanceof Error && "code" in e && (e as { code?: string }).code === "P2002") {
          throw conflict(`Level '${name}' in family '${familyValue ?? "global"}' already exists`);
        }
        throw e;
      }
    }

    await recordAudit(prisma, {
      actor: actor.id,
      action: "LEVEL_UPSERTED",
      entityType: "Level",
      entityId: created.id,
      details: JSON.stringify({ name, rank, family: familyValue }),
    });

    return NextResponse.json({ level: created }, { status: 200 });
  } catch (e) {
    const api = toApiError(e);
    const status = api.error === "FORBIDDEN" ? 403 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}
