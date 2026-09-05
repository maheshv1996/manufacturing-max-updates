import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !canAny(user, ["quality.edit", "ops.edit", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
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
    const actor = user.name || auditorName || "Auditor";

    const audit = await prisma.$transaction(async (tx) => {
      const created = await tx.fiveSAudit.create({
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

      await logAuditTx(tx, {
        actor,
        action: "5S_AUDIT_CREATED",
        entityType: "FiveSAudit",
        entityId: created.id,
        details: `${area} · ${auditorName} · ${totalPct}%`,
      });

      return created;
    });

    return NextResponse.json(audit);
  } catch (error: any) {
    console.error("Create 5S audit error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
