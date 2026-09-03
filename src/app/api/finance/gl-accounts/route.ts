import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { ensureChartOfAccounts } from "@/lib/glEngine";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { parseOr400 } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "finance.view"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await ensureChartOfAccounts();

    const accounts = await prisma.glAccount.findMany({
      orderBy: [{ code: "asc" }],
    });
    const byType = await prisma.glAccount.groupBy({
      by: ["type"],
      _count: { _all: true },
    });

    return NextResponse.json({
      success: true,
      accounts,
      stats: {
        total: accounts.length,
        active: accounts.filter((a) => a.isActive).length,
        byType: Object.fromEntries(byType.map((b) => [b.type, b._count._all])),
      },
    });
  } catch (error) {
    console.error("GET /api/finance/gl-accounts error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

const createAccountSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[0-9]{2,10}$/, "Account code must be numeric (e.g. 1010)"),
  name: z.string().min(2).max(120).transform((s) => s.trim()),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  group: z
    .enum([
      "CURRENT_ASSET",
      "FIXED_ASSET",
      "INTANGIBLE_ASSET",
      "CURRENT_LIABILITY",
      "LONG_TERM_LIABILITY",
      "CAPITAL",
      "RESERVES",
      "RETAINED_EARNINGS",
      "SALES_REVENUE",
      "OTHER_REVENUE",
      "DIRECT_EXPENSE",
      "OPERATING_EXPENSE",
      "FINANCE_EXPENSE",
      "TAX_EXPENSE",
    ])
    .optional()
    .nullable(),
  normalBalance: z.enum(["DEBIT", "CREDIT"]).default("DEBIT"),
  description: z.string().max(500).optional().nullable(),
  clientId: z.string().max(200).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "finance.edit"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || user.id || "Admin";

    const body = await req.json();
    const parsed = parseOr400(createAccountSchema, body);
    if (!parsed.ok) return parsed.response;

    const data = parsed.data;
    await ensureChartOfAccounts();

    const existing = await prisma.glAccount.findUnique({ where: { code: data.code } });
    if (existing) {
      return NextResponse.json(
        { error: `Account code ${data.code} already exists (${existing.name}).` },
        { status: 400 },
      );
    }

    const account = await prisma.glAccount.create({
      data: {
        code: data.code,
        name: data.name,
        type: data.type,
        group: data.group || null,
        normalBalance: data.normalBalance,
        description: data.description || null,
        createdBy: actor,
      },
    });

    await logAudit({
      actor,
      action: "GL_ACCOUNT_CREATED",
      entityType: "GlAccount",
      entityId: account.id,
      details: `Created GL account ${account.code} ${account.name} (${account.type})`,
    });

    return NextResponse.json({ success: true, account });
  } catch (error: any) {
    console.error("POST /api/finance/gl-accounts error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}