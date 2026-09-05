import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { logAuditTx } from "@/lib/audit";
import { z } from "zod";
import { parseOr400 } from "@/lib/validate";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  insurer: z.string().max(150).optional().nullable(),
  policyType: z.string().max(40).optional(),
  coveredAsset: z.string().max(200).optional().nullable(),
  sumInsured: z.coerce.number().nonnegative().optional(),
  premium: z.coerce.number().nonnegative().optional(),
  premiumFrequency: z.string().max(30).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  renewalDate: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export async function PATCH(
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
    const parsed = parseOr400(updateSchema, body);
    if (!parsed.ok) return parsed.response;

    const DATE_FIELDS = ["startDate", "endDate", "renewalDate"];
    const data: any = {};
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v === undefined) continue;
      data[k] = DATE_FIELDS.includes(k) ? (v ? new Date(String(v)) : null) : v === "" ? null : v;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const policy = await prisma.$transaction(async (tx) => {
      const pol = await tx.insurancePolicy.update({ where: { id }, data });
      await logAuditTx(tx, {
        actor,
        action: "INSURANCE_POLICY_UPDATED",
        entityType: "InsurancePolicy",
        entityId: id,
        details: `Updated policy ${pol.policyNumber}: ${Object.keys(data).join(", ")}`,
      });
      return pol;
    });

    return NextResponse.json({ success: true, policy });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }
    console.error("PATCH /api/finance/insurance/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

const actionSchema = z.object({
  action: z.enum(["cancel", "activate", "delete"]),
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
    const a = parsed.data.action;

    const existing = await prisma.insurancePolicy.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    if (a === "delete") {
      await prisma.$transaction(async (tx) => {
        await tx.insurancePolicy.delete({ where: { id } });
        await logAuditTx(tx, {
          actor,
          action: "INSURANCE_POLICY_DELETED",
          entityType: "InsurancePolicy",
          entityId: id,
          details: `Deleted policy ${existing.policyNumber}`,
          severity: "WARN",
        });
      });
      return NextResponse.json({ success: true });
    }

    const policy = await prisma.$transaction(async (tx) => {
      const pol = await tx.insurancePolicy.update({
        where: { id },
        data: { status: a === "cancel" ? "CANCELLED" : "ACTIVE" },
      });

      await logAuditTx(tx, {
        actor,
        action: a === "cancel" ? "INSURANCE_POLICY_CANCELLED" : "INSURANCE_POLICY_ACTIVATED",
        entityType: "InsurancePolicy",
        entityId: id,
        details: `${a === "cancel" ? "Cancelled" : "Activated"} policy ${existing.policyNumber}`,
        severity: a === "cancel" ? "WARN" : "INFO",
      });
      return pol;
    });

    return NextResponse.json({ success: true, policy });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }
    console.error("POST /api/finance/insurance/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}