import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { createEco } from "@/lib/change/changeTx";

export const dynamic = "force-dynamic";

const createEcoSchema = z.object({
  ecoNumber: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(2000),
  raisedBy: z.string().trim().min(1).max(128),
  effectivityType: z.enum(["DATE", "SERIAL"]).optional(),
  items: z
    .array(
      z.object({
        entityType: z.enum(["BOM", "DRAWING", "ROUTING"]),
        productId: z.string().trim().min(1),
        action: z.enum(["REPLACE", "ADD", "REMOVE"]),
        oldData: z.unknown().optional(),
        newData: z.unknown().optional(),
        notes: z.string().trim().max(1000).optional(),
      }),
    )
    .min(1),
  clientId: z.string().trim().min(1).max(128).optional(),
});

/** POST — create an ECO in DRAFT (engineering.edit). */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "engineering.edit")) throw forbidden("engineering.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(createEcoSchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    const result = await createEco(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      ecoNumber: a.ecoNumber,
      title: a.title,
      description: a.description,
      raisedBy: a.raisedBy,
      effectivityType: a.effectivityType,
      items: a.items,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "ECO already created (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, eco: result }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : api.error === "CONFLICT" ? 409 : 400;
    return NextResponse.json(api, { status });
  }
}