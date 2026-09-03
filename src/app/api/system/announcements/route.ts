import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { parseOr400 } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "system.view"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [announcements, live] = await Promise.all([
      prisma.announcement.findMany({
        orderBy: [{ pinned: "desc" }, { publishAt: "desc" }],
        take: 100,
      }),
      prisma.announcement.count({ where: { active: true } }),
    ]);

    return NextResponse.json({
      success: true,
      announcements,
      stats: { total: announcements.length, live, pinned: announcements.filter((a) => a.pinned).length },
    });
  } catch (error) {
    console.error("GET /api/system/announcements error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

const createSchema = z.object({
  title: z.string().min(1).max(200).transform((s) => s.trim()),
  body: z.string().min(1).max(5000).transform((s) => s.trim()),
  category: z
    .enum(["GENERAL", "HR", "SAFETY", "QUALITY", "MAINTENANCE", "EVENT", "EMERGENCY"])
    .default("GENERAL"),
  priority: z.enum(["NORMAL", "IMPORTANT", "URGENT"]).default("NORMAL"),
  pinned: z.boolean().optional().default(false),
  expiresAt: z.string().optional().nullable(),
  clientId: z.string().max(200).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "system.edit"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || user.id || "Admin";

    const body = await req.json();
    const parsed = parseOr400(createSchema, body);
    if (!parsed.ok) return parsed.response;
    const d = parsed.data;

    const announcement = await prisma.announcement.create({
      data: {
        title: d.title,
        body: d.body,
        category: d.category,
        priority: d.priority,
        pinned: d.pinned,
        expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
        author: actor,
      },
    });

    await logAudit({
      actor,
      action: "ANNOUNCEMENT_POSTED",
      entityType: "Announcement",
      entityId: announcement.id,
      details: `${d.priority} ${d.category}: ${d.title}`,
    });

    return NextResponse.json({ success: true, announcement });
  } catch (error) {
    console.error("POST /api/system/announcements error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}