import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { parseOr400 } from "@/lib/core/parse";
import { addActionItemTx, markActionItemDoneTx } from "@/lib/lean/leanTx";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ADD"),
    description: z.string().trim().min(1).max(500),
    ownerName: z.string().trim().min(1).max(100),
    dueDate: z.coerce.date(),
  }),
  z.object({
    action: z.literal("MARK_DONE"),
    itemId: z.string().trim().min(1),
  }),
]);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "projects.edit")) throw forbidden("projects.edit required");

    const body = await req.json().catch(() => null);
    const parsed = parseOr400(bodySchema, body);
    if (parsed.tag === "err") throw parsed.error;
    const val = parsed.value;

    if (val.action === "ADD") {
      const item = await addActionItemTx(
        prisma,
        { id: user.id, name: user.name },
        params.id,
        { description: val.description, ownerName: val.ownerName, dueDate: val.dueDate },
      );
      return NextResponse.json({ success: true, actionItem: item }, { status: 201 });
    } else {
      const item = await markActionItemDoneTx(
        prisma,
        { id: user.id, name: user.name },
        val.itemId,
      );
      return NextResponse.json({ success: true, actionItem: item });
    }
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}
