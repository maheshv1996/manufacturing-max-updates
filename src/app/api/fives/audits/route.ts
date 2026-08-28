import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { area, auditorName, notes, scores } = body; // scores: [{ itemId, score }]

    if (!area || !auditorName || !scores || scores.length === 0) {
      return NextResponse.json(
        { error: "Area, auditor name, and item scores are required." },
        { status: 400 },
      );
    }

    const totalPoints = scores.reduce(
      (sum: number, s: any) => sum + (Number(s.score) || 0),
      0,
    );
    const maxPossiblePoints = scores.length * 5;
    const totalPct = Number(
      ((totalPoints / maxPossiblePoints) * 100).toFixed(1),
    );

    const audit = await prisma.fiveSAudit.create({
      data: {
        area: area.trim(),
        auditorName: auditorName.trim(),
        date: new Date(),
        totalPct,
        notes: notes ? notes.trim() : null,
        scores: {
          createMany: {
            data: scores.map((s: any) => ({
              itemId: s.itemId,
              score: Number(s.score),
            })),
          },
        },
      },
      include: {
        scores: {
          include: { item: true },
        },
      },
    });

    await logAudit({
      actor: "system",
      action: "5S_AUDIT_CREATED",
      entityType: "FiveSAudit",
      entityId: audit.id,
      details: `${area} · ${auditorName} · ${totalPct}%`,
    });

    return NextResponse.json(audit);
  } catch (error: any) {
    console.error("Create 5S audit error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
