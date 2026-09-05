import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { logAuditTx } from "@/lib/audit";
import { z } from "zod";
import { parseOr400 } from "@/lib/validate";

export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum(["close", "open"]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !can(user, "finance.edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || user.id || "Admin";
    const { id } = await params;

    const body = await req.json();
    const parsed = parseOr400(actionSchema, body);
    if (!parsed.ok) return parsed.response;

    const period = await prisma.fiscalPeriod.findUnique({ where: { id } });
    if (!period) {
      return NextResponse.json({ error: "Fiscal period not found" }, { status: 404 });
    }

    const closing = parsed.data.action === "close";
    if (closing && period.status === "CLOSED") {
      return NextResponse.json({ error: "Period is already closed" }, { status: 400 });
    }
    if (!closing && period.status === "OPEN") {
      return NextResponse.json({ error: "Period is already open" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.fiscalPeriod.update({
        where: { id },
        data: {
          status: closing ? "CLOSED" : "OPEN",
          closedBy: closing ? actor : null,
          closedAt: closing ? new Date() : null,
        },
      });

      await logAuditTx(tx, {
        actor,
        action: closing ? "FISCAL_PERIOD_CLOSED" : "FISCAL_PERIOD_OPENED",
        entityType: "FiscalPeriod",
        entityId: period.id,
        details: `${closing ? "Closed" : "Reopened"} fiscal period ${period.code}`,
        severity: closing ? "WARN" : "INFO",
      });
      return u;
    });

    return NextResponse.json({ success: true, period: updated });
  } catch (error) {
    console.error("POST /api/finance/periods/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}