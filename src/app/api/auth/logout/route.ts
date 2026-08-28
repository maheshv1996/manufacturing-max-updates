import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const username = request.headers.get("x-user-name");
  const userId = request.headers.get("x-user-id");

  const response = NextResponse.json({ success: true });
  response.cookies.delete("app_session");

  if (username) {
    await logAudit({
      actor: username,
      action: "LOGOUT",
      entityType: "USER",
      entityId: userId || undefined,
      details: "User logged out",
    });
  }

  return response;
}
