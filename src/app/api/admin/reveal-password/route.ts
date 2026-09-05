import { getUserFromHeaders, can } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    const adminUserId = headersList.get("x-user-id");
    const adminUserName = headersList.get("x-user-name") || "Admin";

    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.isOwner && !can(user, "system.edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId parameter" },
        { status: 400 },
      );
    }

    if (userId === adminUserId) {
      return NextResponse.json(
        { error: "Cannot reveal admin's own password" },
        { status: 400 },
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        lastSetPassword: true,
        passwordChangedAt: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Write audit log
    await logAudit({
      actor: adminUserName,
      action: "PASSWORD_VIEWED",
      entityType: "USER",
      entityId: targetUser.id,
      details: `Admin ${adminUserName} viewed plain password for user ${targetUser.username || user.name}`,
    });

    return NextResponse.json({
      lastSetPassword: targetUser.lastSetPassword || "Not set",
      passwordChangedAt: targetUser.passwordChangedAt,
    });
  } catch (error) {
    console.error("Error in reveal-password API:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
