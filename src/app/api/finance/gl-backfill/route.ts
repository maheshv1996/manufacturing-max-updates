import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { listGlBackfillCandidates, runGlBackfill } from "@/lib/glBackfill";
import { recordGlRun } from "@/lib/glIntegrity";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * GL backfill workbench (admin / finance.edit):
 *   GET  — preview: how many pre-auto-post documents are missing from the ledger
 *   POST — execute: post them all through the idempotent autoPostToGL path
 *
 * GET is a pure read (count + samples). POST only ever POSTS missing entries
 * (already-posted docs are skipped), is safe to re-run, and audit-logs each
 * backfill. Scope: sales invoices, customer payments, supplier invoices.
 */
export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "finance.view"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const candidates = await listGlBackfillCandidates();
    const byKind: Record<string, number> = {};
    for (const c of candidates) byKind[c.kind] = (byKind[c.kind] || 0) + 1;
    return NextResponse.json({
      success: true,
      total: candidates.length,
      byKind,
      samples: candidates.slice(0, 10).map((c) => ({
        kind: c.kind,
        docNumber: c.docNumber,
        memo: c.memo,
      })),
    });
  } catch (error) {
    console.error("GET /api/finance/gl-backfill error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "finance.edit"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || user.id || "Admin";

    const preview = await listGlBackfillCandidates();
    const result = await runGlBackfill(actor);

    await logAudit({
      actor,
      action: "GL_BACKFILL_RUN",
      entityType: "GL_JOURNAL",
      entityId: "batch",
      details: `GL backfill executed: ${result.posted} posted, ${result.skipped} already present, ${result.failed.length} failed`,
    });
    // Provenance: persist this execution so the workbench history and the
    // scheduled sweep share one record of what was repaired and when.
    await recordGlRun({
      kind: "BACKFILL",
      status: result.failed.length > 0 ? "ISSUES" : "OK",
      actor,
      posted: result.posted,
      skipped: result.skipped,
      failed: result.failed.length,
      details: `Backfill: ${result.posted} posted, ${result.skipped} already present, ${result.failed.length} failed`,
    });

    return NextResponse.json({ success: true, previewed: preview.length, result });
  } catch (error: any) {
    console.error("POST /api/finance/gl-backfill error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
