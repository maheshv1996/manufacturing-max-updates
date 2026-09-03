import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import {
  checkLedgerIntegrity,
  recordGlRun,
  recentGlRuns,
} from "@/lib/glIntegrity";

export const dynamic = "force-dynamic";

/**
 * Ledger integrity & provenance:
 *   GET  — recent run history (backfills + integrity scans), newest first.
 *   POST — execute a full integrity scan and persist the run. Authorized for
 *          finance users via session, OR for the desktop launcher's daily
 *          sweep via `Authorization: Bearer $MFGMAX_CONTROL_TOKEN`.
 */
export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "finance.view"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const runs = await recentGlRuns(10);
    return NextResponse.json({ success: true, runs });
  } catch (error) {
    console.error("GET /api/finance/gl-integrity error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    // Desktop control sweep: Bearer token must match the launcher-injected env.
    const envToken = process.env.MFGMAX_CONTROL_TOKEN;
    const bearer = headersList.get("authorization") || "";
    const isControl =
      !!envToken && bearer === `Bearer ${envToken}`;

    if (!user.id && !isControl) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.id && !user.isOwner && !can(user, "finance.edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = isControl ? "desktop-sweep" : user.name || user.id || "Admin";

    const summary = await checkLedgerIntegrity();
    const hasIssues = summary.unbalancedCount > 0 || summary.unpostedTotal > 0;
    const run = await recordGlRun({
      kind: "INTEGRITY",
      status: hasIssues ? "ISSUES" : "OK",
      actor,
      unbalanced: summary.unbalancedCount,
      unposted: summary.unpostedTotal,
      issues: summary.issues.slice(0, 20),
      details: `Integrity scan: ${summary.totalEntries} entries, ${summary.unbalancedCount} unbalanced, ${summary.unpostedTotal} unposted`,
    });

    return NextResponse.json({
      success: true,
      checkedAt: summary.checkedAt,
      totalEntries: summary.totalEntries,
      unbalancedCount: summary.unbalancedCount,
      unpostedTotal: summary.unpostedTotal,
      unpostedByKind: summary.unpostedByKind,
      issues: summary.issues,
      run: { id: run.id, runAt: run.runAt.toISOString(), status: run.status },
    });
  } catch (error: any) {
    console.error("POST /api/finance/gl-integrity error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
