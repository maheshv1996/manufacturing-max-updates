import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import { requireManagerLevel, validateReason } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";

export const maxDuration = 60;

/** Variance threshold per ABC class: A=0.5%, B=1%, C=2% (of system qty). */
export const ABC_THRESHOLD_PCT: Record<string, number> = { A: 0.5, B: 1, C: 2 };
const ABC_INTERVAL_DAYS: Record<string, number> = { A: 15, B: 45, C: 90 };

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [sessions, materials, inventoryTxs] = await Promise.all([
      prisma.cycleCountSession.findMany({
        include: {
          lines: { include: { rawMaterial: true }, orderBy: { id: "asc" } },
        },
        orderBy: { startedAt: "desc" },
        take: 100,
      }),
      prisma.rawMaterial.findMany({
        where: { isActive: true },
        orderBy: { sku: "asc" },
        take: 200,
      }),
      prisma.inventoryTransaction.findMany({
        where: { type: "ADJUST" },
        orderBy: { at: "desc" },
        take: 20,
      }),
    ]);

    // P15 — ABC classification from usage/value: A = top movers (by recent IN/OUT volume), fallback heuristic.
    const stats = {
      open: sessions.filter(
        (s) => s.status === "OPEN" || s.status === "COUNTING",
      ).length,
      pendingApproval: sessions.filter((s) => s.status === "PENDING_APPROVAL")
        .length,
      adjusted: sessions.filter((s) => s.status === "ADJUSTED").length,
      totalItems: materials.length,
      threshold: ABC_THRESHOLD_PCT,
      intervals: ABC_INTERVAL_DAYS,
    };
    return NextResponse.json({ sessions, materials, inventoryTxs, stats });
  } catch (error) {
    console.error("GET /api/cycle-count error:", error);
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

    if (action === "start") {
      // Create a counting session for one ABC class: snapshot system qty per item.
      const { abcClass, name, itemIds } = data;
      if (!abcClass || !["A", "B", "C"].includes(abcClass))
        return NextResponse.json(
          { error: "abcClass (A/B/C) required" },
          { status: 400 },
        );
      const where: any = { isActive: true };
      if (Array.isArray(itemIds) && itemIds.length) where.id = { in: itemIds };
      const materials = await prisma.rawMaterial.findMany({
        where,
        orderBy: { sku: "asc" },
        take: 200,
      });
      if (materials.length === 0)
        return NextResponse.json(
          { error: "No materials to count" },
          { status: 400 },
        );
      const seq = await prisma.cycleCountSession.count();
      const session = await prisma.cycleCountSession.create({
        data: {
          sessionNumber: `CC-${abcClass}-${new Date().getFullYear()}-${String(seq + 1).padStart(3, "0")}`,
          name: name || `${abcClass}-class cycle count`,
          abcClass,
          startedBy: user.name || "Stores",
          status: "COUNTING",
          lines: {
            create: materials.map((m) => ({
              rawMaterialId: m.id,
              systemQty: m.currentStock,
            })),
          },
        },
        include: { lines: { include: { rawMaterial: true } } },
      });
      await logAudit({
        actor: user.name || "Stores",
        action: "CYCLE_COUNT_STARTED",
        entityType: "CYCLE_COUNT",
        entityId: session.id,
        details: `${session.sessionNumber} · ${abcClass}-class · ${materials.length} items`,
      });
      return NextResponse.json({ success: true, session }, { status: 201 });
    }

    if (action === "record") {
      const { sessionId, values } = data;
      if (!sessionId || !Array.isArray(values))
        return NextResponse.json(
          { error: "sessionId and values required" },
          { status: 400 },
        );
      const session = await prisma.cycleCountSession.findUnique({
        where: { id: sessionId },
        include: { lines: true },
      });
      if (!session)
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 },
        );
      if (
        session.status === "PENDING_APPROVAL" ||
        session.status === "ADJUSTED" ||
        session.status === "CLOSED"
      ) {
        return NextResponse.json(
          { error: "Session already submitted" },
          { status: 400 },
        );
      }
      for (const v of values) {
        const line = session.lines.find((l) => l.id === v.lineId);
        if (!line) continue;
        const counted = Number(v.countedQty);
        const variance = counted - line.systemQty;
        const variancePct =
          line.systemQty > 0
            ? (Math.abs(variance) / line.systemQty) * 100
            : variance !== 0
              ? 100
              : 0;
        await prisma.cycleCountLine.update({
          where: { id: line.id },
          data: {
            countedQty: counted,
            variance,
            variancePct,
            countedBy: user.name || "Counter",
            countedAt: new Date(),
            status: "COUNTED",
            note: v.note || null,
          },
        });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "submit") {
      const { sessionId } = data;
      if (!sessionId)
        return NextResponse.json(
          { error: "sessionId required" },
          { status: 400 },
        );
      const session = await prisma.cycleCountSession.findUnique({
        where: { id: sessionId },
        include: { lines: true },
      });
      if (!session)
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 },
        );
      const unCounted = session.lines.filter((l) => l.countedQty === null);
      if (unCounted.length > 0)
        return NextResponse.json(
          { error: `${unCounted.length} line(s) not yet counted` },
          { status: 400 },
        );
      const threshold = ABC_THRESHOLD_PCT[session.abcClass] || 1;
      const bigVariance = session.lines.filter(
        (l) => (l.variancePct || 0) > threshold,
      );
      const updated = await prisma.cycleCountSession.update({
        where: { id: sessionId },
        data: {
          status: bigVariance.length > 0 ? "PENDING_APPROVAL" : "CLOSED",
        },
        include: { lines: true },
      });
      await logAudit({
        actor: user.name || "Stores",
        action:
          bigVariance.length > 0
            ? "CYCLE_COUNT_SUBMITTED_VARIANCE"
            : "CYCLE_COUNT_CLOSED",
        entityType: "CYCLE_COUNT",
        entityId: session.id,
        details: `${session.sessionNumber} · ${session.lines.length} lines · ${bigVariance.length} over ${threshold}% threshold → ${updated.status}`,
      });
      return NextResponse.json({
        success: true,
        session: updated,
        overThreshold: bigVariance.map((l) => ({
          id: l.id,
          sku: l.rawMaterialId,
          variancePct: l.variancePct,
        })),
      });
    }

    if (action === "approve" || action === "reject") {
      // Finance manager disposition — the supply→finance interlink.
      const gate = await requireManagerLevel(user);
      if (!gate.ok)
        return NextResponse.json({ error: gate.error }, { status: 403 });
      const reason = validateReason(data);
      if (!reason.ok)
        return NextResponse.json({ error: reason.error }, { status: 400 });
      const session = await prisma.cycleCountSession.findUnique({
        where: { id: data.id },
        include: { lines: { include: { rawMaterial: true } } },
      });
      if (!session)
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 },
        );
      if (session.status !== "PENDING_APPROVAL")
        return NextResponse.json(
          { error: "Only PENDING_APPROVAL sessions can be decided" },
          { status: 400 },
        );

      if (action === "reject") {
        const updated = await prisma.cycleCountSession.update({
          where: { id: data.id },
          data: {
            status: "CLOSED",
            approvalNote: `REJECTED: ${reason.reason}`,
            approvedBy: user.name || "Manager",
            approvedAt: new Date(),
          },
        });
        await logAudit({
          actor: user.name || "Manager",
          action: "CYCLE_COUNT_REJECTED",
          entityType: "CYCLE_COUNT",
          entityId: session.id,
          details: `${session.sessionNumber} — ${reason.reason}`,
        });
        return NextResponse.json({ success: true, session: updated });
      }

      // Approve → adjust stock per counted qty, post ADJUST transactions.
      for (const line of session.lines) {
        if (line.countedQty === null || line.countedQty === line.systemQty)
          continue;
        await prisma.rawMaterial.update({
          where: { id: line.rawMaterialId },
          data: { currentStock: line.countedQty },
        });
        await prisma.inventoryTransaction.create({
          data: {
            rawMaterialId: line.rawMaterialId,
            type: "ADJUST",
            qty: line.countedQty - line.systemQty,
            unitCost: line.rawMaterial.unitCost,
            batchNo: null,
            reference: session.sessionNumber,
            actorName: user.name || "Finance",
            adjustmentHistory: {
              reason: reason.reason,
              session: session.sessionNumber,
              from: line.systemQty,
              to: line.countedQty,
            },
          },
        });
      }
      const updated = await prisma.cycleCountSession.update({
        where: { id: data.id },
        data: {
          status: "ADJUSTED",
          approvedBy: user.name || "Finance Manager",
          approvedAt: new Date(),
          approvalNote: reason.reason,
        },
        include: { lines: true },
      });
      await logAudit({
        actor: user.name || "Finance Manager",
        action: "INVENTORY_ADJUSTED",
        entityType: "CYCLE_COUNT",
        entityId: session.id,
        details: `${session.sessionNumber} — ${session.lines.length} lines adjusted (${reason.reason})`,
      });
      return NextResponse.json({ success: true, session: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/cycle-count error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
