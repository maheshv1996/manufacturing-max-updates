import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";
import { nextSeqNumber } from "@/lib/seqNumbers";

export const maxDuration = 60;

const CATEGORIES = [
  "ABSENTEEISM",
  "MISCONDUCT",
  "INSUBORDINATION",
  "SAFETY",
  "PUNCTUALITY",
  "OTHER",
];

export async function GET(_req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const gate =
      canAny(user, ["people.view", "people.edit", "system.edit"]) ||
      user.isOwner;
    if (!gate)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const [cases, settings] = await Promise.all([
      prisma.disciplinaryCase.findMany({
        include: {
          user: { select: { id: true, name: true, employeeNumber: true } },
        },
        orderBy: { noticeIssuedAt: "desc" },
        take: 300,
      }),
      prisma.setting.findMany({
        where: {
          key: { in: ["disciplineHearingDays", "disciplineDecisionDays"] },
        },
      }),
    ]);
    const hearingDays = parseInt(
      settings.find((s) => s.key === "disciplineHearingDays")?.value || "7",
      10,
    );
    const decisionDays = parseInt(
      settings.find((s) => s.key === "disciplineDecisionDays")?.value || "7",
      10,
    );
    const now = Date.now();
    const enriched = cases.map((c) => {
      const hearingDue = c.noticeIssuedAt.getTime() + hearingDays * 86400000;
      const decisionBase = c.hearingHeldAt || c.hearingDate || c.noticeIssuedAt;
      const decisionDue = decisionBase.getTime() + decisionDays * 86400000;
      const hearingOverdue = c.stage === "NOTICE" && now > hearingDue;
      const decisionOverdue =
        (c.stage === "HEARING" || c.stage === "DECISION") && now > decisionDue;
      return {
        ...c,
        hearingDue: new Date(hearingDue),
        decisionDue: new Date(decisionDue),
        hearingOverdue,
        decisionOverdue,
        timeline: {
          notice: c.noticeIssuedAt,
          hearing: c.hearingHeldAt,
          decision: c.decidedAt,
          closed: c.closedAt,
        },
      };
    });
    const stats = {
      total: cases.length,
      notice: cases.filter((c) => c.stage === "NOTICE").length,
      hearing: cases.filter((c) => c.stage === "HEARING").length,
      decision: cases.filter((c) => c.stage === "DECISION").length,
      closed: cases.filter((c) => c.stage === "CLOSED").length,
      overdue: enriched.filter((c) => c.hearingOverdue || c.decisionOverdue)
        .length,
    };
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, employeeNumber: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({
      cases: enriched,
      stats,
      users,
      categories: CATEGORIES,
    });
  } catch (error) {
    console.error("GET /api/disciplinary error:", error);
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
    const { action, data } = body;
    if (!action || !data)
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );
    if (action !== "open-case")
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    const gate = await requireManagerLevel(user);
    if (!gate.ok)
      return NextResponse.json({ error: gate.error }, { status: 403 });
    const { userId, category, description, hearingDate } = data;
    if (!userId || !category || !description)
      return NextResponse.json(
        { error: "userId, category and description required" },
        { status: 400 },
      );
    if (!CATEGORIES.includes(category))
      return NextResponse.json(
        { error: `category must be one of ${CATEGORIES.join(", ")}` },
        { status: 400 },
      );
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target)
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    const number = await nextSeqNumber(
      "disciplinaryCase",
      "caseNumber",
      "DISC",
    );
    const record = await prisma.disciplinaryCase.create({
      data: {
        caseNumber: number,
        userId,
        category,
        description: description.trim(),
        hearingDate: hearingDate ? new Date(hearingDate) : null,
      },
    });
    await logAudit({
      actor,
      action: "DISCIPLINARY_OPENED",
      entityType: "DISCIPLINARY",
      entityId: record.id,
      details: `${number} · ${category} · ${target.name}`,
    });
    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error("POST /api/disciplinary error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
