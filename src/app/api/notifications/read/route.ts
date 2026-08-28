import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const tokenStr = req.cookies.get("app_session")?.value;
    if (!tokenStr)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = await verifySessionToken(tokenStr);
    if (!token?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const ids: string[] = Array.isArray(body?.notificationIds)
      ? body.notificationIds
      : [];
    const unique = Array.from(new Set(ids.filter(Boolean)));

    if (unique.length > 0) {
      await prisma.notificationRead.createMany({
        data: unique.map((notificationId) => ({
          userId: token.id,
          notificationId,
        })),
        skipDuplicates: true,
      });
    }

    await logAudit({
      actor: token.id,
      action: "NOTIFICATIONS_MARKED_READ",
      entityType: "NotificationRead",
      details: `marked ${unique.length} notifications`,
    });

    return NextResponse.json({ success: true, marked: unique.length });
  } catch (err) {
    console.error("Notifications read error:", err);
    return NextResponse.json({ error: "Failed to mark read" }, { status: 500 });
  }
}
