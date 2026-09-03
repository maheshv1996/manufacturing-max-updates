import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import { pruneIdempotencyKeys } from "@/lib/idempotency";

export const dynamic = "force-dynamic";

// POST /api/system/prune-idempotency  — requires owner or CRON_SECRET
export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const cronSecret = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("cronSecret");
  const envCron = process.env.CRON_SECRET;

  const isCron = !!envCron && cronSecret === envCron;
  const isOwner = !!user.isOwner;

  if (!isOwner && !isCron) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const days = Number(body.days ?? 7);
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(90, Math.max(1, days)) : 7;

  const deleted = await pruneIdempotencyKeys(safeDays);
  return NextResponse.json({ success: true, deleted, days: safeDays });
}

// GET convenience for manual trigger (same auth)
export async function GET(req: Request) {
  return POST(req);
}
