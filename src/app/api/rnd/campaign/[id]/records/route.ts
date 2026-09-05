import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logAuditTx } from "@/lib/audit";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { TestResult } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const reqHeaders = await headers();
    const user = getUserFromHeaders(reqHeaders);
    if (!user.isOwner && !canAny(user, ["engineering.edit", "quality.edit", "ops.edit", "system.edit"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { parameterName, unit, target, min, max, actual, notes } = body;

    if (!parameterName) {
      return NextResponse.json(
        { error: "parameterName is required" },
        { status: 400 },
      );
    }

    const campaign = await prisma.testCampaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Test Campaign not found" },
        { status: 404 },
      );
    }

    const actor = user.name || user.id || "Operator";

    // Auto PASS/FAIL evaluation
    let result: TestResult = TestResult.PENDING;
    if (actual !== undefined && actual !== null) {
      const actualVal = parseFloat(actual);
      if (!isNaN(actualVal)) {
        if (min !== undefined && max !== undefined) {
          result = actualVal >= min && actualVal <= max ? TestResult.PASS : TestResult.FAIL;
        } else if (target !== undefined) {
          result = actualVal === target ? TestResult.PASS : TestResult.FAIL;
        }
      }
    }

    const newRecord = await prisma.$transaction(async (tx) => {
      const created = await tx.testRecord.create({
        data: {
          campaignId: id,
          parameterName,
          unit: unit || null,
          target:
            target !== undefined && target !== "" ? parseFloat(target) : null,
          min: min !== undefined && min !== "" ? parseFloat(min) : null,
          max: max !== undefined && max !== "" ? parseFloat(max) : null,
          actual:
            actual !== undefined && actual !== "" ? parseFloat(actual) : null,
          result,
          testedBy: actor,
          testedAt: new Date(),
          notes: notes || null,
        },
      });

      await logAuditTx(tx, {
        actor,
        action: "RND_TEST_RECORD_CREATED",
        entityType: "TestRecord",
        entityId: created.id,
        details: `${parameterName} · ${result} · ${actor}`,
      });

      return created;
    });

    return NextResponse.json(
      { success: true, record: newRecord },
      { status: 201 },
    );
  } catch (error) {
    console.error(`POST /api/rnd/campaign/${id}/records error:`, error);
    return NextResponse.json(
      { error: "Failed to create test record" },
      { status: 500 },
    );
  }
}
