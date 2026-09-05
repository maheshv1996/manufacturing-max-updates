import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { issueDocumentRevTx } from "@/lib/change/changeTx";

export const dynamic = "force-dynamic";

const issueSchema = z.object({
  documentId: z.string().trim().min(1),
  // Numeric document revisions (schema `Document.version Int`).
  newVersion: z.number().int().min(2),
  clientId: z.string().trim().min(1).max(128).optional(),
});

/** POST — issue a forward revision (engineering.edit). Superseded row is archived, never deleted. */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "engineering.edit")) throw forbidden("engineering.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(issueSchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const a = parsed.value;

    const result = await issueDocumentRevTx(prisma, {
      actor: { id: user.id, name: user.name },
      clientId: a.clientId,
      documentId: a.documentId,
      newVersion: a.newVersion,
    });
    if (result && "duplicate" in result && result.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: "Revision already issued (idempotent duplicate ignored)" });
    }
    return NextResponse.json({ success: true, document: result }, { status: 201 });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}