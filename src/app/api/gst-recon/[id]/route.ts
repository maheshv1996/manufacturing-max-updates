import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (
      !user.id ||
      (!user.isOwner && !canAny(user, ["finance.edit", "commercial.edit"]))
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || "Admin";

    const { id } = await params;
    const run = await prisma.gstReconRun.findUnique({ where: { id } });
    if (!run)
      return NextResponse.json({ error: "Run not found" }, { status: 404 });

    const body = await req.json();
    const { action } = body;

    if (action === "add-followup") {
      const note = (body.note || "").trim();
      if (!note)
        return NextResponse.json({ error: "note required" }, { status: 400 });
      const followUps = [
        ...(run.followUps as any[]),
        { at: new Date().toISOString(), by: actor, note },
      ];
      const updated = await prisma.gstReconRun.update({
        where: { id },
        data: { followUps },
      });
      await logAudit({
        actor,
        action: "GST_RECON_FOLLOWUP",
        entityType: "GST_RECON",
        entityId: id,
        details: `${run.period} — ${note.slice(0, 120)}`,
      });
      return NextResponse.json({ run: updated });
    }

    if (action === "resolve-row") {
      const { index, note } = body;
      const rows = run.rows as any[];
      const row = rows.find((r) => r.idx === index);
      if (!row)
        return NextResponse.json({ error: "Row not found" }, { status: 404 });
      if (row.status === "MATCHED")
        return NextResponse.json(
          { error: "Matched rows need no follow-up" },
          { status: 400 },
        );
      row.status = "RESOLVED";
      row.note = `${row.note ? row.note + " | " : ""}Resolved: ${(note || "").slice(0, 140)}`;
      const updatedRows = rows.map((r) => (r.idx === index ? row : r));
      const updated = await prisma.gstReconRun.update({
        where: { id },
        data: { rows: updatedRows },
      });
      await logAudit({
        actor,
        action: "GST_RECON_ROW_RESOLVED",
        entityType: "GST_RECON",
        entityId: id,
        details: `${run.period} ${row.invoiceNumber} → RESOLVED — ${(note || "").slice(0, 140)}`,
      });
      return NextResponse.json({ run: updated });
    }

    if (action === "close") {
      const updated = await prisma.gstReconRun.update({
        where: { id },
        data: { status: "CLOSED" },
      });
      await logAudit({
        actor,
        action: "GST_RECON_CLOSED",
        entityType: "GST_RECON",
        entityId: id,
        details: `${run.period} reconciled run closed`,
      });
      return NextResponse.json({ run: updated });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("PATCH /api/gst-recon/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update run" },
      { status: 500 },
    );
  }
}
