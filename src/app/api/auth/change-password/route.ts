import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { hashPassword, verifyPassword, signSessionToken } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const userId = headersList.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Skip for fallback users
    if (userId.startsWith("fallback-")) {
      return NextResponse.json(
        { error: "Cannot change password for emergency fallback user." },
        { status: 400 },
      );
    }

    const { currentPassword, newPassword } = await req.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters long." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify current password if the user has one
    if (user.passwordHash) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required." },
          { status: 400 },
        );
      }
      const isValid = verifyPassword(currentPassword, user.passwordHash);
      if (!isValid) {
        return NextResponse.json(
          { error: "Incorrect current password." },
          { status: 400 },
        );
      }
    }

    const newHash = hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        lastSetPassword: newPassword,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
      },
    });

    // Update the session token to reflect the new mustChangePassword status
    const token = await signSessionToken({
      id: user.id,
      username: user.username || user.email || "",
      name: user.name || "",
      roleId: user.roleId || "",
      roleName: user.role?.name || "",
      permissions: user.role?.permissions || [],
      isOwner: user.isOwner,
      level: user.level || "WORKER",
      mustChangePassword: false,
      sess: user.sessionEpoch || 0,
    });

    const isProd = process.env.NODE_ENV === "production";

    // Log success
    await logAudit({
      actor: user.username || user.name || user.id,
      action: "PASSWORD_CHANGED",
      entityType: "USER",
      entityId: user.id,
      details: `User ${user.username || user.name} changed their password`,
    });

    const response = NextResponse.json({ success: true });

    response.cookies.set({
      name: "app_session",
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
