import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";
import { startOfMonth, endOfMonth } from "date-fns";

export const maxDuration = 60;

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

// P25 — live metrics per operator: efficiency (standard-hours vs actual),
// quality (100 − scrap rate), attendance (present/(present+late) with LATE = 0.5)
export async function computeLiveMetrics(userId: string, period: string) {
  const [y, m] = period.split("-").map(Number);
  const from = startOfMonth(new Date(y, m - 1, 1));
  const to = endOfMonth(new Date(y, m - 1, 1));

  const [logs, attendance] = await Promise.all([
    prisma.productionLog.findMany({
      where: { operatorId: userId, startTime: { gte: from, lt: to } },
    }),
    prisma.attendanceLog.findMany({
      where: { userId, clockIn: { gte: from, lt: to } },
    }),
  ]);

  let good = 0;
  let scrap = 0;
  let standardSec = 0;
  let actualSec = 0;
  for (const l of logs) {
    good += l.goodQuantity || 0;
    scrap += l.scrapQuantity || 0;
    actualSec += l.endTime
      ? Math.max(0, (l.endTime.getTime() - l.startTime.getTime()) / 1000)
      : 0;
  }
  // standard hours: good qty × 60s standard per piece (SAM fallback when no time study)
  standardSec = good * 60;

  const efficiencyPct =
    actualSec > 0
      ? round1(Math.min(150, (standardSec / actualSec) * 100))
      : 85.0;
  const produced = good + scrap;
  const scrapRate = produced > 0 ? (scrap / produced) * 100 : 4.5;
  const qualityPct = round1(Math.max(0, 100 - scrapRate));
  const present = attendance.filter((a) => a.status === "PRESENT").length;
  const late = attendance.filter((a) => a.status === "LATE").length;
  const attendancePct =
    present + late > 0
      ? round1(((present + 0.5 * late) / (present + late)) * 100)
      : 95.0;

  const score = round1(
    efficiencyPct * 0.4 + qualityPct * 0.4 + attendancePct * 0.2,
  );
  return {
    efficiencyPct,
    qualityPct,
    attendancePct,
    score,
    goodUnits: good,
    scrapUnits: scrap,
    attendanceLogs: present + late,
  };
}

export async function GET(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const period =
      searchParams.get("period") || new Date().toISOString().slice(0, 7);

    const operators = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { name: { in: ["Operator", "OPERATOR"] } },
      },
      select: { id: true, name: true, employeeNumber: true },
      orderBy: { name: "asc" },
    });
    const stored = await prisma.performanceAppraisal.findMany({
      where: { period },
      select: {
        userId: true,
        status: true,
        managerRating: true,
        managerComments: true,
        reviewedByName: true,
        reviewedAt: true,
      },
    });
    const storedByUser = new Map(stored.map((s) => [s.userId, s]));

    const rows = [];
    for (const op of operators) {
      const live = await computeLiveMetrics(op.id, period);
      const s = storedByUser.get(op.id);
      rows.push({ ...op, ...live, stored: s || null });
    }
    rows.sort((a, b) => b.score - a.score);

    return NextResponse.json({ period, rows, storedCount: stored.length });
  } catch (error) {
    console.error("GET /api/appraisals error:", error);
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
  if (!(await canAny(user, ["people.edit"])))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { action, data } = body;
    if (!action || !data)
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );

    if (action === "review") {
      const { userId, period, rating, comments } = data;
      const r = Number(rating);
      if (!userId || !period || !(r >= 1 && r <= 5))
        return NextResponse.json(
          { error: "userId, period and rating (1–5) required" },
          { status: 400 },
        );
      const mgr = await requireManagerLevel(user);
      if (!mgr.ok)
        return NextResponse.json(
          { error: "Manager level required" },
          { status: 403 },
        );

      const live = await computeLiveMetrics(userId, period);
      const appraisal = await prisma.performanceAppraisal.upsert({
        where: { userId_period: { userId, period } },
        update: {
          efficiencyPct: live.efficiencyPct,
          qualityPct: live.qualityPct,
          attendancePct: live.attendancePct,
          score: live.score,
          managerRating: r,
          managerComments: comments || null,
          status: "REVIEWED",
          reviewedByName: user.name || "System",
          reviewedAt: new Date(),
        },
        create: {
          userId,
          period,
          efficiencyPct: live.efficiencyPct,
          qualityPct: live.qualityPct,
          attendancePct: live.attendancePct,
          score: live.score,
          managerRating: r,
          managerComments: comments || null,
          status: "REVIEWED",
          reviewedByName: user.name || "System",
          reviewedAt: new Date(),
        },
      });
      await logAudit({
        actor: user.name || "System",
        action: "APPRAISAL_REVIEWED",
        entityType: "APPRAISAL",
        entityId: appraisal.id,
        details: `${period} — score ${live.score}, rating ${r}${comments ? ` (${comments.slice(0, 60)})` : ""}`,
      });
      return NextResponse.json({ appraisal }, { status: 201 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/appraisals error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
