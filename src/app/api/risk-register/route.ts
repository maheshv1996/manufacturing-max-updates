import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";
import { nextSeqNumber } from "@/lib/seqNumbers";
import {
  computeRisk,
  nextReviewDate,
  reviewStatus,
  isValidCategory,
  CATEGORY_LABEL,
} from "@/lib/riskRegister";

export const maxDuration = 60;

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const gate =
      canAny(user, ["system.view", "system.edit", "exec.view"]) || user.isOwner;
    if (!gate)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const risks = await prisma.riskRegister.findMany({
      orderBy: [
        { riskLevel: "asc" },
        { updatedAt: "desc" },
      ],
    });
    // Order by level severity, not alphabetically: CRITICAL → HIGH → MEDIUM → LOW
    const rank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const enriched = risks
      .map((r) => ({ ...r, ...reviewStatus(r.reviewDueAt) }))
      .sort((a, b) => rank[a.riskLevel] - rank[b.riskLevel]);

    const open = enriched.filter((r) => r.status !== "CLOSED");
    const stats = {
      total: enriched.length,
      open: open.length,
      critical: open.filter((r) => r.riskLevel === "CRITICAL").length,
      high: open.filter((r) => r.riskLevel === "HIGH").length,
      reviewOverdue: open.filter((r) => r.reviewStatus === "OVERDUE").length,
    };
    return NextResponse.json({ risks: enriched, stats });
  } catch (error) {
    console.error("GET /api/risk-register error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = user.name || "Admin";
  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action, data } = body;
    if (!action || !data)
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );
    const canEdit =
      user.isOwner ||
      (await requireManagerLevel(user)).ok ||
      canAny(user, ["system.edit"]);
    if (!canEdit)
      return NextResponse.json(
        { error: "Requires manager or system.edit" },
        { status: 403 },
      );

    let result: any;
    if (action === "create-risk") {
      const {
        title,
        category,
        description,
        likelihood,
        impact,
        owner,
        mitigation,
        contingency,
      } = data;
      if (!title || !category || !isValidCategory(category))
        return NextResponse.json(
          { error: "title and a valid category required" },
          { status: 400 },
        );
      const { score, level } = computeRisk(likelihood, impact);
      const riskCode = await nextSeqNumber("riskRegister", "riskCode", "RK");
      result = await prisma.riskRegister.create({
        data: {
          riskCode,
          title: String(title).slice(0, 200),
          category,
          description: description ? String(description).slice(0, 2000) : null,
          likelihood: Math.round(Number(likelihood) || 1),
          impact: Math.round(Number(impact) || 1),
          riskScore: score,
          riskLevel: level,
          owner: owner ? String(owner).slice(0, 100) : null,
          mitigation: mitigation ? String(mitigation).slice(0, 2000) : null,
          contingency: contingency ? String(contingency).slice(0, 2000) : null,
          status: "OPEN",
          reviewDueAt: nextReviewDate(),
          createdBy: actor,
        },
      });
      await logAudit({
        actor,
        action: "RISK_CREATED",
        entityType: "RISK_REGISTER",
        entityId: result.id,
        details: `${riskCode} · ${CATEGORY_LABEL[category] || category} · ${level} (${score})`,
      });
    } else if (action === "update-risk") {
      const existing = await prisma.riskRegister.findUnique({
        where: { id: data.id },
      });
      if (!existing)
        return NextResponse.json(
          { error: "Risk not found" },
          { status: 404 },
        );
      const { score, level } = computeRisk(
        data.likelihood ?? existing.likelihood,
        data.impact ?? existing.impact,
      );
      result = await prisma.riskRegister.update({
        where: { id: existing.id },
        data: {
          title:
            data.title !== undefined ? String(data.title).slice(0, 200) : undefined,
          category:
            data.category !== undefined && isValidCategory(data.category)
              ? data.category
              : undefined,
          description:
            data.description !== undefined
              ? data.description
                ? String(data.description).slice(0, 2000)
                : null
              : undefined,
          likelihood:
            data.likelihood !== undefined
              ? Math.round(Number(data.likelihood) || 1)
              : undefined,
          impact:
            data.impact !== undefined
              ? Math.round(Number(data.impact) || 1)
              : undefined,
          riskScore: score,
          riskLevel: level,
          owner:
            data.owner !== undefined
              ? data.owner
                ? String(data.owner).slice(0, 100)
                : null
              : undefined,
          mitigation:
            data.mitigation !== undefined
              ? data.mitigation
                ? String(data.mitigation).slice(0, 2000)
                : null
              : undefined,
          contingency:
            data.contingency !== undefined
              ? data.contingency
                ? String(data.contingency).slice(0, 2000)
                : null
              : undefined,
          status:
            data.status !== undefined &&
            ["OPEN", "MITIGATED", "CLOSED"].includes(data.status)
              ? data.status
              : undefined,
        },
      });
      await logAudit({
        actor,
        action: "RISK_UPDATED",
        entityType: "RISK_REGISTER",
        entityId: existing.id,
        details: `${existing.riskCode} → ${level} (${score})`,
      });
    } else if (action === "close-risk") {
      const existing = await prisma.riskRegister.findUnique({
        where: { id: data.id },
      });
      if (!existing)
        return NextResponse.json(
          { error: "Risk not found" },
          { status: 404 },
        );
      result = await prisma.riskRegister.update({
        where: { id: existing.id },
        data: { status: "CLOSED" },
      });
      await logAudit({
        actor,
        action: "RISK_CLOSED",
        entityType: "RISK_REGISTER",
        entityId: existing.id,
        details: `${existing.riskCode} closed — ${existing.riskLevel} (${existing.riskScore})`,
      });
    } else if (action === "review-risk") {
      const existing = await prisma.riskRegister.findUnique({
        where: { id: data.id },
      });
      if (!existing)
        return NextResponse.json(
          { error: "Risk not found" },
          { status: 404 },
        );
      result = await prisma.riskRegister.update({
        where: { id: existing.id },
        data: {
          lastReviewedAt: new Date(),
          reviewDueAt: nextReviewDate(),
        },
      });
      await logAudit({
        actor,
        action: "RISK_REVIEWED",
        entityType: "RISK_REGISTER",
        entityId: existing.id,
        details: `${existing.riskCode} reviewed — next review ${result.reviewDueAt.toISOString().slice(0, 10)}`,
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/risk-register error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}