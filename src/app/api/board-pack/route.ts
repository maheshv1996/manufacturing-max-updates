import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { getComplianceFlags } from "@/lib/complianceDigest";
import { fromPaise } from "@/lib/money";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// M32 — monthly board pack, auto-compiled live from existing registers.
export async function GET(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const gate =
      canAny(user, [
        "exec.view",
        "finance.view",
        "quality.view",
        "commercial.view",
        "system.view",
      ]) || user.isOwner;
    if (!gate)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);
    const month =
      url.searchParams.get("month") || new Date().toISOString().slice(0, 7);
    const [ys, ms] = month.split("-").map(Number);
    const start = new Date(ys, ms - 1, 1);
    const end = new Date(ys, ms, 0, 23, 59, 59, 999);
    const prevStart = new Date(ys, ms - 2, 1);
    const prevEnd = new Date(ys, ms - 1, 0, 23, 59, 59, 999);

    const [
      invoices,
      prevInvoices,
      allInvoices,
      ncrs,
      complaints,
      open8d,
      openEscalations,
      sentQuotes,
      wonQuotes,
      prevWonQuotes,
      flagsBundle,
    ] = await Promise.all([
      prisma.invoice.findMany({
        where: { invoiceDate: { gte: start, lte: end } },
      }),
      prisma.invoice.findMany({
        where: { invoiceDate: { gte: prevStart, lte: prevEnd } },
      }),
      prisma.invoice.findMany(),
      prisma.ncrReport.count({ where: { raisedAt: { gte: start, lte: end } } }),
      prisma.customerComplaint.count({ where: { status: { not: "CLOSED" } } }),
      prisma.eightDReport.count({ where: { status: { not: "CLOSED" } } }),
      prisma.escalation.findMany({
        where: { status: { not: "RESOLVED" } },
        orderBy: [{ severity: "asc" }, { escalatedAt: "asc" }],
        take: 20,
      }),
      prisma.quotation.findMany({ where: { status: "SENT" } }),
      prisma.quotation.findMany({
        where: { status: "WON", createdAt: { gte: start, lte: end } },
      }),
      prisma.quotation.findMany({
        where: { status: "WON", createdAt: { gte: prevStart, lte: prevEnd } },
      }),
      getComplianceFlags(),
    ]);

    const sum = (rs: any[], f: string) =>
      rs.reduce((s, r) => s + Number(r[f] || 0), 0);
    // Ledger-style fixed point: invoice rows store paise — expose rupees.
    const invoiced = fromPaise(sum(invoices, "totalValue"));
    const collected = fromPaise(sum(invoices, "paidAmount"));
    const outstanding = fromPaise(
      allInvoices
        .filter((i) => i.status !== "PAID")
        .reduce((s, i) => s + (Number(i.totalValue) - Number(i.paidAmount)), 0),
    );
    const prevInvoiced = fromPaise(sum(prevInvoices, "totalValue"));
    const wonValue = sum(wonQuotes, "quotedPrice");
    const prevWonValue = sum(prevWonQuotes, "quotedPrice");
    const sentPipeline = sum(sentQuotes, "quotedPrice");

    const escalationCounts: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };
    openEscalations.forEach((e) => {
      escalationCounts[e.severity] = (escalationCounts[e.severity] || 0) + 1;
    });

    return NextResponse.json({
      month,
      compiledAt: new Date().toISOString(),
      financials: {
        invoiced,
        collected,
        outstanding,
        invoiceCount: invoices.length,
        prevInvoiced,
        invoiceDeltaPct:
          prevInvoiced > 0
            ? Math.round(((invoiced - prevInvoiced) / prevInvoiced) * 1000) / 10
            : null,
        receivableCount: allInvoices.filter((i) => i.status !== "PAID").length,
      },
      quality: {
        ncrCount: ncrs,
        openComplaints: complaints,
        open8d,
        ppm: null,
        topFlags: flagsBundle.flags.slice(0, 5),
      },
      pipeline: {
        sentCount: sentQuotes.length,
        sentValue: sentPipeline,
        wonCount: wonQuotes.length,
        wonValue,
        wonDeltaPct:
          prevWonValue > 0
            ? Math.round(((wonValue - prevWonValue) / prevWonValue) * 1000) / 10
            : null,
      },
      risks: {
        critical: flagsBundle.criticalCount,
        warning: flagsBundle.warningCount,
        top: flagsBundle.flags.slice(0, 8),
      },
      escalations: {
        open: openEscalations.length,
        bySeverity: escalationCounts,
        list: openEscalations.slice(0, 10),
      },
    });
  } catch (error) {
    console.error("GET /api/board-pack error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
