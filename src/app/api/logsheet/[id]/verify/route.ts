import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAudit } from "@/lib/audit";
import { getUserFromHeaders } from "@/lib/permissions";
import { getSystemTotals } from "../../route";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const actorName =
    user?.name || headersList.get("x-user-name") || "Supervisor";

  try {
    const { id } = await params;
    const body = await request.json();
    const { decision, note } = body;

    if (!["VERIFIED", "REJECTED"].includes(decision)) {
      return NextResponse.json(
        { error: "decision must be VERIFIED or REJECTED" },
        { status: 400 },
      );
    }

    const sheet = await prisma.logsheet.findUnique({
      where: { id },
      include: { machine: { select: { code: true, name: true } } },
    });

    if (!sheet) {
      return NextResponse.json(
        { error: "Logsheet not found" },
        { status: 404 },
      );
    }

    const entries = (sheet.entries as any[]) || [];
    const sheetGood = entries
      .filter((e) => e.type === "GOOD")
      .reduce((s, e) => s + (Number(e.qty) || 0), 0);
    const sheetScrap = entries
      .filter((e) => e.type === "SCRAP")
      .reduce((s, e) => s + (Number(e.qty) || 0), 0);

    // Cross-check against system production logs for the same machine+shift+day
    const system = await getSystemTotals(
      sheet.machineId,
      sheet.shiftId,
      sheet.logDate,
    );
    const crossCheck = {
      sheetGood,
      sheetScrap,
      systemGood: system.good,
      systemScrap: system.scrap,
      goodMatches: sheetGood === system.good,
      scrapMatches: sheetScrap === system.scrap,
    };

    const updated = await prisma.logsheet.update({
      where: { id },
      data: {
        status: decision,
        verifiedBy: actorName,
        verifiedAt: new Date(),
        verificationNote: note || null,
      },
    });

    await logAudit({
      actor: actorName,
      action:
        decision === "VERIFIED" ? "LOGSHEET_VERIFIED" : "LOGSHEET_REJECTED",
      entityType: "Logsheet",
      entityId: id,
      details: `${sheet.machine.code} · ${sheet.logDate.toISOString().slice(0, 10)} · sheet ${crossCheck.sheetGood}g/${crossCheck.sheetScrap}s vs system ${crossCheck.systemGood}g/${crossCheck.systemScrap}s${note ? ` — ${note}` : ""}`,
    });

    return NextResponse.json({ success: true, logsheet: updated, crossCheck });
  } catch (error) {
    console.error(`Logsheet verify ${params} error:`, error);
    return NextResponse.json(
      { error: "Failed to verify logsheet" },
      { status: 500 },
    );
  }
}
