import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import {
  getDiagnostics,
  summarizeDiagnostics,
  clearDiagnostics,
  environmentSnapshot,
  LIMITS,
} from "@/lib/diagnostics";

export const dynamic = "force-dynamic";

/**
 * GET /api/system/diagnostics
 * Returns the in-process redacted diagnostic ring buffer and environmental snapshot.
 * Gated to users with "system.view" permission.
 */
export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user.isOwner && !can(user, "system.view")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const summary = summarizeDiagnostics();
  const entries = getDiagnostics();
  const env = environmentSnapshot();

  return NextResponse.json({
    success: true,
    limits: LIMITS,
    summary,
    entries,
    env,
  });
}

/**
 * DELETE /api/system/diagnostics
 * Resets the in-process diagnostic ring buffer.
 * Gated to users with "system.edit" permission or owners.
 */
export async function DELETE() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user.isOwner && !can(user, "system.edit")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  clearDiagnostics();

  await logAudit({
    actor: user.name || "Admin",
    action: "DIAGNOSTICS_BUFFER_CLEARED",
    entityType: "Diagnostics",
    details: "Diagnostics ring buffer cleared",
    severity: "WARN",
  });

  return NextResponse.json({
    success: true,
    message: "Diagnostics ring buffer cleared successfully",
  });
}
