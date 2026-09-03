import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { effectiveLocation } from "@/lib/calibration";

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user.isOwner && !can(user, "system.edit") && !can(user, "ops.edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { calibratedToolId, issuedToName, expectedReturnAt, notes } = body;

    if (!calibratedToolId || !issuedToName || !expectedReturnAt) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const tool = await prisma.calibratedTool.findUnique({
      where: { id: calibratedToolId },
    });
    if (!tool) {
      return NextResponse.json(
        { error: "Calibrated tool not found" },
        { status: 404 },
      );
    }

    // Tool Crib enforcement: quarantined (EXPIRED) and retired instruments cannot be issued.
    const loc = effectiveLocation(tool);
    if (loc === "RETIRED") {
      return NextResponse.json(
        { error: "Retired instruments cannot be issued" },
        { status: 403 },
      );
    }
    if (loc === "QUARANTINE") {
      return NextResponse.json(
        {
          error: `Instrument ${tool.name} (${tool.serialNumber}) is in the out-of-calibration QUARANTINE cage and cannot be issued until recalibrated.`,
          code: "INSTRUMENT_QUARANTINED",
        },
        { status: 403 },
      );
    }

    const openIssue = await prisma.instrumentIssue.findFirst({
      where: { calibratedToolId, returnedAt: null },
    });
    if (openIssue) {
      return NextResponse.json(
        {
          error: `Already issued to ${openIssue.issuedToName} since ${new Date(openIssue.issuedAt).toLocaleString()}. Return it before re-issuing.`,
        },
        { status: 409 },
      );
    }

    const issue = await prisma.instrumentIssue.create({
      data: {
        calibratedToolId,
        issuedToName,
        issuedBy: user.name || "Crib Clerk",
        expectedReturnAt: new Date(expectedReturnAt),
        notes: notes || null,
      },
    });

    await prisma.calibratedTool.update({
      where: { id: calibratedToolId },
      data: { location: "WITH_OPERATOR", custodianName: issuedToName },
    });

    await logAudit({
      actor: user.name || "Crib Clerk",
      action: "INSTRUMENT_ISSUED",
      entityType: "CALIBRATED_TOOL",
      entityId: calibratedToolId,
      details: `Issued ${tool.name} (${tool.serialNumber}) to ${issuedToName}, expected return ${new Date(expectedReturnAt).toLocaleDateString()}`,
    });

    return NextResponse.json({ success: true, issue });
  } catch (error) {
    console.error("POST /api/metrology/issue error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
