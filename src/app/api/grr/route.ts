import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { headers } from "next/headers";
import { computeGrr } from "@/lib/grr";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [studies, tools] = await Promise.all([
      prisma.gageRnrStudy.findMany({
        include: {
          tool: {
            select: {
              id: true,
              name: true,
              serialNumber: true,
              toolType: true,
            },
          },
        },
        orderBy: { conductedAt: "desc" },
      }),
      prisma.calibratedTool.findMany({
        select: { id: true, name: true, serialNumber: true, toolType: true },
        orderBy: { name: "asc" },
      }),
    ]);
    // Live-recompute statistics from stored raw measurements
    const enriched = studies.map((s) => {
      const raw = Array.isArray(s.measurements)
        ? (s.measurements as any[])
        : [];
      const result = computeGrr(raw as any);
      return { ...s, result };
    });
    return NextResponse.json({ studies: enriched, tools });
  } catch (error: any) {
    console.error("GET /api/grr error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Gage R&R studies" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const headerList = await headers();
    const userName = headerList.get("x-user-name") || "System";

    if (body.entity === "delete") {
      const { id } = body.data || {};
      await prisma.gageRnrStudy.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    // Create / update study. measurements: [{ appraiser, part, trial, value }]
    const { id, toolId, appraisers, parts, trials, measurements, notes } =
      body.data || {};
    if (!toolId)
      return NextResponse.json({ error: "toolId required" }, { status: 400 });
    const raw = Array.isArray(measurements) ? measurements : [];
    const result = computeGrr(raw);

    if (id) {
      const study = await prisma.gageRnrStudy.update({
        where: { id },
        data: {
          toolId,
          appraisers: Number(appraisers) || 3,
          parts: Number(parts) || 10,
          trials: Number(trials) || 3,
          measurements: raw,
          ev: result.ev,
          av: result.av,
          grr: result.grr,
          partVar: result.partVar,
          totalVar: result.totalVar,
          grrPct: result.grrPct,
          ndc: result.ndc,
          verdict: result.verdict,
          notes: notes || null,
        },
      });
      await logAudit({
        actor: userName,
        action: "GRR_UPDATED",
        entityType: "GRR",
        entityId: study.id,
        details: `Gage R&R ${study.studyNumber}: %GRR ${result.grrPct}% (${result.verdict})`,
      });
      return NextResponse.json({ success: true, item: study, result });
    }

    const count = await prisma.gageRnrStudy.count();
    const studyNumber = `GRR-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, "0")}`;
    const study = await prisma.gageRnrStudy.create({
      data: {
        studyNumber,
        toolId,
        appraisers: Number(appraisers) || 3,
        parts: Number(parts) || 10,
        trials: Number(trials) || 3,
        measurements: raw,
        ev: result.ev,
        av: result.av,
        grr: result.grr,
        partVar: result.partVar,
        totalVar: result.totalVar,
        grrPct: result.grrPct,
        ndc: result.ndc,
        verdict: result.verdict,
        conductedBy: userName,
        notes: notes || null,
      },
    });
    await logAudit({
      actor: userName,
      action: "GRR_CREATED",
      entityType: "GRR",
      entityId: study.id,
      details: `Gage R&R ${studyNumber} on tool — %GRR ${result.grrPct}% (${result.verdict})`,
    });
    return NextResponse.json({ success: true, item: study, result });
  } catch (error: any) {
    console.error("POST /api/grr error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
