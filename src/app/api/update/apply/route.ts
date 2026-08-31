import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { controlFetch, isDesktopMode } from "@/lib/desktopControl";

export const dynamic = "force-dynamic";

export async function POST() {
    await logAudit({ actor: "system", action: "UPDATE_APPLIED", entityType: "SystemUpdate", details: "System update applied" });
  if (!isDesktopMode()) {
    return NextResponse.json(
      {
        error: "DESKTOP_ONLY",
        message: "Update & install is available in the desktop edition.",
      },
      { status: 400 },
    );
  }
  const res = await controlFetch("/update/apply", { method: "POST" });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.ok ? 200 : res.status });
}
