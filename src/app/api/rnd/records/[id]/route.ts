import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { actual, notes } = body;

    const record = await prisma.testRecord.findUnique({ where: { id } });
    if (!record) {
      return NextResponse.json(
        { error: "Test Record not found" },
        { status: 404 },
      );
    }

    // Evaluate PASS/FAIL if actual is provided
    let result = record.result;
    let actualToSave = record.actual;

    if (actual !== undefined) {
      if (actual === null || actual === "") {
        actualToSave = null;
        result = "PENDING";
      } else {
        const actualVal = parseFloat(actual);
        if (!isNaN(actualVal)) {
          actualToSave = actualVal;
          if (record.min !== null && record.max !== null) {
            result =
              actualVal >= record.min && actualVal <= record.max
                ? "PASS"
                : "FAIL";
          } else if (record.target !== null) {
            result = actualVal === record.target ? "PASS" : "FAIL";
          } else {
            // If no bounds provided, keep current result or let user manually override
          }
        }
      }
    }

    // Allow manual result override if passed in body
    if (body.result && ["PASS", "FAIL", "PENDING"].includes(body.result)) {
      result = body.result;
    }

    const updatedRecord = await prisma.testRecord.update({
      where: { id },
      data: {
        actual: actualToSave,
        result: result as any,
        notes: notes !== undefined ? notes : record.notes,
      },
    });

    await logAudit({
      actor: "system",
      action: "RND_TEST_RECORD_UPDATED",
      entityType: "TestRecord",
      entityId: id,
      details: `result → ${result} · actual=${actualToSave}`,
    });

    return NextResponse.json({ success: true, record: updatedRecord });
  } catch (error) {
    console.error(`PATCH /api/rnd/records/${id} error:`, error);
    return NextResponse.json(
      { error: "Failed to update test record" },
      { status: 500 },
    );
  }
}
