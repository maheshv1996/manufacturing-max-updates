import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { logAuditTx } from "@/lib/audit";
import { z } from "zod";
import { parseOr400 } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !can(user, "finance.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const periods = await prisma.fiscalPeriod.findMany({
      orderBy: [{ startDate: "desc" }],
      take: 120,
    });

    return NextResponse.json({ success: true, periods });
  } catch (error) {
    console.error("GET /api/finance/periods error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

const createPeriodSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[A-Za-z0-9-]+$/, "Period code: letters, digits, hyphens (e.g. 2026-04)")
    .transform((s) => s.trim()),
  label: z.string().max(200).optional().nullable(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

export async function POST(req: Request) {
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

    const body = await req.json();
    const parsed = parseOr400(createPeriodSchema, body);
    if (!parsed.ok) return parsed.response;

    const start = new Date(parsed.data.startDate);
    const end = new Date(parsed.data.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid period dates" }, { status: 400 });
    }
    if (end < start) {
      return NextResponse.json(
        { error: "End date must be on or after the start date" },
        { status: 400 },
      );
    }

    const existing = await prisma.fiscalPeriod.findUnique({
      where: { code: parsed.data.code },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Period ${parsed.data.code} already exists (${existing.status}).` },
        { status: 400 },
      );
    }

    const period = await prisma.$transaction(async (tx) => {
      const per = await tx.fiscalPeriod.create({
        data: {
          code: parsed.data.code,
          label: parsed.data.label || null,
          startDate: start,
          endDate: end,
          status: "OPEN",
        },
      });

      await logAuditTx(tx, {
        actor,
        action: "FISCAL_PERIOD_OPENED",
        entityType: "FiscalPeriod",
        entityId: per.id,
        details: `Opened fiscal period ${per.code} (${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)})`,
      });
      return per;
    });

    return NextResponse.json({ success: true, period });
  } catch (error) {
    console.error("POST /api/finance/periods error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}