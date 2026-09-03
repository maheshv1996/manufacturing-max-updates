import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { parseOr400 } from "@/lib/validate";

export const dynamic = "force-dynamic";

function effectiveStatus(p: { status: string; endDate: Date | null; renewalDate: Date | null }) {
  if (p.status !== "ACTIVE") return p.status;
  const horizon = p.endDate || p.renewalDate;
  if (!horizon) return "ACTIVE";
  const days = (new Date(horizon).getTime() - Date.now()) / 86400000;
  if (days < 0) return "EXPIRED";
  if (days <= 60) return "EXPIRING";
  return "ACTIVE";
}

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "finance.view"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const policies = await prisma.insurancePolicy.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const withFlags = policies.map((p) => ({ ...p, effectiveStatus: effectiveStatus(p) }));

    return NextResponse.json({
      success: true,
      policies: withFlags,
      stats: {
        total: policies.length,
        expiring: withFlags.filter((p) => p.effectiveStatus === "EXPIRING").length,
        expired: withFlags.filter((p) => p.effectiveStatus === "EXPIRED").length,
        premiumYear: Math.round(
          withFlags
            .filter((p) => p.effectiveStatus === "ACTIVE")
            .reduce((s, p) => s + (p.premiumFrequency === "MONTHLY" ? p.premium * 12 : p.premiumFrequency === "QUARTERLY" ? p.premium * 4 : p.premiumFrequency === "HALF_YEARLY" ? p.premium * 2 : p.premium), 0),
        ),
      },
    });
  } catch (error) {
    console.error("GET /api/finance/insurance error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

const createSchema = z.object({
  policyNumber: z.string().min(1).max(60).transform((s) => s.trim()),
  insurer: z.string().max(150).optional().nullable(),
  policyType: z.string().max(40).optional().default("OTHER"),
  coveredAsset: z.string().max(200).optional().nullable(),
  sumInsured: z.coerce.number().nonnegative().optional().default(0),
  premium: z.coerce.number().nonnegative().optional().default(0),
  premiumFrequency: z.string().max(30).optional().default("YEARLY"),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  renewalDate: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
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
    const parsed = parseOr400(createSchema, body);
    if (!parsed.ok) return parsed.response;
    const d = parsed.data;

    const policy = await prisma.insurancePolicy.create({
      data: {
        policyNumber: d.policyNumber,
        insurer: d.insurer || null,
        policyType: d.policyType,
        coveredAsset: d.coveredAsset || null,
        sumInsured: d.sumInsured || 0,
        premium: d.premium || 0,
        premiumFrequency: d.premiumFrequency,
        startDate: d.startDate ? new Date(d.startDate) : null,
        endDate: d.endDate ? new Date(d.endDate) : null,
        renewalDate: d.renewalDate ? new Date(d.renewalDate) : null,
        notes: d.notes || null,
        createdBy: actor,
      },
    });

    await logAudit({
      actor,
      action: "INSURANCE_POLICY_ADDED",
      entityType: "InsurancePolicy",
      entityId: policy.id,
      details: `Policy ${policy.policyNumber} (${policy.policyType}) with ${policy.insurer || "unknown insurer"}`,
    });

    return NextResponse.json({ success: true, policy });
  } catch (error) {
    console.error("POST /api/finance/insurance error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}