import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";
import { nextSeqNumber } from "@/lib/seqNumbers";

export const maxDuration = 60;

// M30 — scorecard thresholds: our PPM >= 1000 or OTD < 90% is a poor scorecard.
export function scorecardVerdict(s: any) {
  const ppm = s.ppm !== null && s.ppm !== undefined ? Number(s.ppm) : null;
  const otp =
    s.otpPct !== null && s.otpPct !== undefined ? Number(s.otpPct) : null;
  if (ppm !== null && ppm >= 5000)
    return { flag: true, severity: "critical" as const, reason: `PPM ${ppm}` };
  if (ppm !== null && ppm >= 1000)
    return { flag: true, severity: "warning" as const, reason: `PPM ${ppm}` };
  if (otp !== null && otp < 90)
    return { flag: true, severity: "warning" as const, reason: `OTD ${otp}%` };
  if (otp !== null && otp < 70)
    return { flag: true, severity: "critical" as const, reason: `OTD ${otp}%` };
  return { flag: false };
}

export async function GET(_req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const gate =
      canAny(user, [
        "quality.view",
        "quality.edit",
        "commercial.view",
        "system.edit",
      ]) || user.isOwner;
    if (!gate)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const scorecards = await prisma.customerScorecard.findMany({
      orderBy: [{ period: "desc" }, { customerName: "asc" }],
      take: 500,
    });
    const withVerdict = scorecards.map((s) => ({
      ...s,
      verdict: scorecardVerdict(s),
    }));
    const withPpm = withVerdict.filter(
      (s) => s.ppm !== null && s.ppm !== undefined,
    );
    const withOtp = withVerdict.filter(
      (s) => s.otpPct !== null && s.otpPct !== undefined,
    );
    const year = new Date().getFullYear();
    const stats = {
      total: scorecards.length,
      thisYear: scorecards.filter((s) => s.period.startsWith(String(year)))
        .length,
      avgPpm: withPpm.length
        ? Math.round(
            withPpm.reduce((a, s) => a + Number(s.ppm), 0) / withPpm.length,
          )
        : null,
      avgOtp: withOtp.length
        ? Math.round(
            (withOtp.reduce((a, s) => a + Number(s.otpPct), 0) /
              withOtp.length) *
              10,
          ) / 10
        : null,
      flagged: withVerdict.filter((s) => s.verdict.flag).length,
      customers: new Set(scorecards.map((s) => s.customerName)).size,
      byPeriod: Object.entries(
        scorecards.reduce<
          Record<string, { count: number; ppmSum: number; otpSum: number }>
        >((acc, s) => {
          const p = (acc[s.period] ||= { count: 0, ppmSum: 0, otpSum: 0 });
          p.count++;
          if (s.ppm !== null && s.ppm !== undefined) p.ppmSum += Number(s.ppm);
          if (s.otpPct !== null && s.otpPct !== undefined)
            p.otpSum += Number(s.otpPct);
          return acc;
        }, {}),
      )
        .map(([period, v]) => ({
          period,
          count: v.count,
          avgPpm: v.count ? Math.round(v.ppmSum / v.count) : null,
          avgOtp: v.count ? Math.round((v.otpSum / v.count) * 10) / 10 : null,
        }))
        .sort((a, b) => b.period.localeCompare(a.period)),
    };
    return NextResponse.json({ scorecards: withVerdict, stats });
  } catch (error) {
    console.error("GET /api/scorecards error:", error);
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
    const canEdit =
      user.isOwner ||
      (await requireManagerLevel(user)).ok ||
      canAny(user, ["quality.edit", "commercial.edit"]);
    if (!canEdit)
      return NextResponse.json(
        { error: "Requires manager, quality.edit or commercial.edit" },
        { status: 403 },
      );

    let result: any;
    if (action === "create-scorecard") {
      const {
        customerName,
        period,
        ppm,
        otpPct,
        score,
        receivedAt,
        fileRef,
        notes,
      } = data;
      if (!customerName || !period)
        return NextResponse.json(
          { error: "customerName and period (YYYY-MM) required" },
          { status: 400 },
        );
      if (!/^\d{4}-\d{2}$/.test(period))
        return NextResponse.json(
          { error: "period must be YYYY-MM" },
          { status: 400 },
        );
      const scorecardNumber = await nextSeqNumber(
        "customerScorecard",
        "scorecardNumber",
        "SCC",
      );
      result = await prisma.customerScorecard.create({
        data: {
          scorecardNumber,
          customerName,
          period,
          ppm:
            ppm !== undefined && ppm !== null && ppm !== ""
              ? Number(ppm)
              : null,
          otpPct:
            otpPct !== undefined && otpPct !== null && otpPct !== ""
              ? Number(otpPct)
              : null,
          score:
            score !== undefined && score !== null && score !== ""
              ? Number(score)
              : null,
          receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
          fileRef: fileRef || null,
          notes: notes || null,
        },
      });
      await logAudit({
        actor,
        action: "SCORECARD_RECEIVED",
        entityType: "CUSTOMER_SCORECARD",
        entityId: result.id,
        details: `${scorecardNumber} · ${customerName} · ${period}${result.ppm !== null ? ` · PPM ${result.ppm}` : ""}${result.otpPct !== null ? ` · OTD ${result.otpPct}%` : ""}`,
      });
    } else if (action === "update-scorecard") {
      const s = await prisma.customerScorecard.findUnique({
        where: { id: data.id },
      });
      if (!s)
        return NextResponse.json(
          { error: "Scorecard not found" },
          { status: 404 },
        );
      const patch: any = {};
      if (data.customerName !== undefined)
        patch.customerName = data.customerName;
      if (data.period !== undefined) patch.period = data.period;
      if (data.ppm !== undefined)
        patch.ppm =
          data.ppm !== null && data.ppm !== "" ? Number(data.ppm) : null;
      if (data.otpPct !== undefined)
        patch.otpPct =
          data.otpPct !== null && data.otpPct !== ""
            ? Number(data.otpPct)
            : null;
      if (data.score !== undefined)
        patch.score =
          data.score !== null && data.score !== "" ? Number(data.score) : null;
      if (data.fileRef !== undefined) patch.fileRef = data.fileRef || null;
      if (data.notes !== undefined) patch.notes = data.notes || null;
      result = await prisma.customerScorecard.update({
        where: { id: s.id },
        data: patch,
      });
      await logAudit({
        actor,
        action: "SCORECARD_UPDATED",
        entityType: "CUSTOMER_SCORECARD",
        entityId: s.id,
        details: `${s.scorecardNumber} · ${result.customerName}`,
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/scorecards error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
