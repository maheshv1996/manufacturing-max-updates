import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { logAuditTx } from "@/lib/audit";
import { z } from "zod";
import { parseOr400 } from "@/lib/validate";

export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum(["archive", "activate", "pin", "unpin", "delete"]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !can(user, "system.edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || user.id || "Admin";
    const { id } = await params;

    const body = await req.json();
    const parsed = parseOr400(actionSchema, body);
    if (!parsed.ok) return parsed.response;
    const a = parsed.data.action;

    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    if (a === "delete") {
      await prisma.$transaction(async (tx) => {
        await tx.announcement.delete({ where: { id } });
        await logAuditTx(tx, {
          actor,
          action: "ANNOUNCEMENT_DELETED",
          entityType: "Announcement",
          entityId: id,
          details: `Deleted: ${existing.title}`,
          severity: "WARN",
        });
      });
      return NextResponse.json({ success: true });
    }

    const announcement = await prisma.$transaction(async (tx) => {
      const ann = await tx.announcement.update({
        where: { id },
        data: {
          active: a === "archive" ? false : a === "activate" ? true : existing.active,
          pinned: a === "pin" ? true : a === "unpin" ? false : existing.pinned,
        },
      });

      await logAuditTx(tx, {
        actor,
        action: `ANNOUNCEMENT_${a.toUpperCase()}`,
        entityType: "Announcement",
        entityId: id,
        details: `${a} — ${existing.title}`,
      });

      return ann;
    });

    return NextResponse.json({ success: true, announcement });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }
    console.error("POST /api/system/announcements/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}