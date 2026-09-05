import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { controlFetch, isDesktopMode } from "@/lib/desktopControl";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.isOwner && !can(user, "system.edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!isDesktopMode()) {
      return NextResponse.json(
        {
          error: "DESKTOP_ONLY",
          message: "Update & install is available in the desktop edition.",
        },
        { status: 400 },
      );
    }

    const actor = user.name || user.id || "Admin";

    await logAudit({
      actor,
      action: "UPDATE_APPLIED",
      entityType: "SystemUpdate",
      details: "Desktop system update apply triggered",
    });

    const res = await controlFetch("/update/apply", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (error: unknown) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
