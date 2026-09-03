import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { autoPostToGL } from "@/lib/glPosting";

export const dynamic = "force-dynamic";

function parseIntent(details: string | null): { reason?: string; intent?: any } | null {
  if (!details) return null;
  try {
    const j = JSON.parse(details);
    if (typeof j !== "object" || j === null) return null;
    return j;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "finance.view"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const failures = await prisma.auditLog.findMany({
      where: { action: "GL_AUTOPOST_FAILED" },
      orderBy: { at: "desc" },
      take: 100,
    });
    const items = failures
      .map((f) => {
        const parsed = parseIntent(f.details);
        return {
          auditId: f.id,
          sourceId: f.entityId,
          reason: parsed?.reason || "unknown",
          memo: parsed?.intent?.memo || "",
          source: parsed?.intent?.source || "",
          createdAt: f.at,
        };
      })
      .filter((x) => x.sourceId);
    // A failure is open only while its document is still missing from the ledger —
    // audit rows are append-only, so once a retry posts the journal entry this
    // row must drop out of the queue even though the audit trail keeps it.
    const sourceIds = [...new Set(items.map((x) => x.sourceId).filter((s): s is string => !!s))];
    const posted = new Set(
      (
        await prisma.journalEntry.findMany({
          where: { sourceId: { in: sourceIds } },
          select: { sourceId: true },
        })
      ).map((j) => j.sourceId),
    );
    const open = items.filter((x) => !posted.has(x.sourceId));
    return NextResponse.json({ failures: open, count: open.length });
  } catch (error: any) {
    console.error("GET /api/finance/gl-repair error:", error);
    return NextResponse.json({ error: "Failed to list GL failures" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "finance.edit"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action, data } = body;
    if (action === "retry") {
      const auditId = data?.auditId;
      if (!auditId) return NextResponse.json({ error: "auditId required" }, { status: 400 });
      const audit = await prisma.auditLog.findUnique({ where: { id: auditId } });
      if (!audit || audit.action !== "GL_AUTOPOST_FAILED") {
        return NextResponse.json({ error: "Failed auto-post record not found" }, { status: 404 });
      }
      const parsed = parseIntent(audit.details);
      const intent = parsed?.intent;
      if (!intent || !intent.sourceId || !Array.isArray(intent.lines)) {
        return NextResponse.json({ error: "Stored intent is unreadable — repair manually" }, { status: 400 });
      }
      const result = await autoPostToGL({
        source: intent.source,
        sourceId: intent.sourceId,
        memo: intent.memo || `GL repair — ${intent.sourceId}`,
        createdBy: intent.createdBy || user.name || "system",
        date: intent.date ? new Date(intent.date) : undefined,
        lines: intent.lines,
      });
      if (result.ok) {
        await logAudit({
          actor: user.name || "system",
          action: "GL_AUTOPOST_RETRIED",
          entityType: "GL_JOURNAL",
          entityId: audit.entityId,
          details: `Repaired auto-post ${intent.source} ${intent.sourceId} → ${result.entryNumber || "skipped (already posted)"}`,
        });
        return NextResponse.json({
          repaired: true,
          entryNumber: result.entryNumber,
          skipped: result.skipped,
          message: result.skipped
            ? "Already posted — no action needed"
            : `Posted ${result.entryNumber}`,
        });
      }
      return NextResponse.json(
        { error: `Retry failed again: ${result.error || "unknown"}` },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/finance/gl-repair error:", error);
    return NextResponse.json({ error: "Failed to repair GL posting" }, { status: 500 });
  }
}
