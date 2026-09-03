import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import {
  getTrialBalance,
  getIncomeStatement,
  getBalanceSheet,
  ensureChartOfAccounts,
} from "@/lib/glEngine";

export const dynamic = "force-dynamic";

function parseDate(raw: string | null, fallback: Date): Date {
  if (!raw) return fallback;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? fallback : d;
}

export async function GET(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "finance.view"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await ensureChartOfAccounts();

    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "trial-balance";

    if (type === "profit-loss") {
      const now = new Date();
      const from = parseDate(url.searchParams.get("from"), new Date(now.getFullYear(), 0, 1));
      const to = parseDate(url.searchParams.get("to"), now);
      const data = await getIncomeStatement({ from, to });
      return NextResponse.json({ success: true, report: data });
    }

    if (type === "balance-sheet") {
      const asOf = parseDate(url.searchParams.get("asOf"), new Date());
      const data = await getBalanceSheet({ asOf });
      return NextResponse.json({ success: true, report: data });
    }

    // default: trial-balance
    const now = new Date();
    const from = parseDate(url.searchParams.get("from"), new Date(now.getFullYear(), 0, 1));
    const to = parseDate(url.searchParams.get("to"), now);
    const data = await getTrialBalance({ from, to });
    return NextResponse.json({ success: true, report: data });
  } catch (error) {
    console.error("GET /api/finance/reports error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}