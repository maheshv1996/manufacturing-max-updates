import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAuditTx } from "@/lib/audit";

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !user.isOwner &&
    !canAny(user, ["quality.edit", "ops.edit", "system.edit"])
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { issueId } = body;

    if (!issueId) {
      return NextResponse.json({ error: "Missing issueId" }, { status: 400 });
    }

    const issue = await prisma.instrumentIssue.findUnique({
      where: { id: issueId },
      include: { calibratedTool: true },
    });
    if (!issue) {
      return NextResponse.json(
        { error: "Issue record not found" },
        { status: 404 },
      );
    }
    if (issue.returnedAt) {
      return NextResponse.json(
        { error: "This instrument was already returned" },
        { status: 409 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const rec = await tx.instrumentIssue.update({
        where: { id: issueId },
        data: {
          returnedAt: new Date(),
          returnedToName: user.name || "Crib Clerk",
        },
      });

      // Back to the lab cabinet (an EXPIRED instrument surfaces as QUARANTINE automatically).
      await tx.calibratedTool.update({
        where: { id: issue.calibratedToolId },
        data: { location: "LAB_CABINET", custodianName: null },
      });

      await logAuditTx(tx, {
        actor: user.name || "Crib Clerk",
        action: "INSTRUMENT_RETURNED",
        entityType: "CALIBRATED_TOOL",
        entityId: issue.calibratedToolId,
        details: `Returned ${issue.calibratedTool.name} (${issue.calibratedTool.serialNumber}) from ${issue.issuedToName}`,
      });

      return rec;
    });

    return NextResponse.json({ success: true, issue: updated });
  } catch (error) {
    console.error("POST /api/metrology/return error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
