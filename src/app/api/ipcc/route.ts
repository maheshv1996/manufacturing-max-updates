import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import { requireManagerLevel, validateReason } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";

export const maxDuration = 60;

/** Build a checklist run from the product's Control Plan rows (P10). */
async function generateRun(
  workOrderId: string,
  machineId: string,
  operator: any,
  processStep?: string,
) {
  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: { product: true },
  });
  if (!wo) return { error: "Work Order not found", status: 404 };

  // Existing OPEN run for this WO+machine → return it (dedupe).
  const existing = await prisma.ipccChecklistRun.findFirst({
    where: { workOrderId, machineId, status: "OPEN" },
    include: { checks: true },
  });
  if (existing) return { run: existing };

  const planRows = await prisma.controlPlan.findMany({
    where: { productId: wo.productId, status: "ACTIVE" },
    orderBy: { processStep: "asc" },
  });

  if (planRows.length === 0) {
    return {
      error:
        "No approved Control Plan checks exist for this product — ask Quality to add them.",
      status: 400,
    };
  }

  const seq = await prisma.ipccChecklistRun.count();
  const run = await prisma.ipccChecklistRun.create({
    data: {
      runNumber: `IPQC-${new Date().getFullYear()}-${String(seq + 1).padStart(4, "0")}`,
      workOrderId,
      machineId,
      operatorId: operator?.id || null,
      processStep: processStep || planRows[0].processStep || "General",
      checks: {
        create: planRows.map((p) => ({
          characteristic: p.characteristic,
          processStep: p.processStep,
          specMin: p.specMin,
          specMax: p.specMax,
          measurementMethod: p.measurementMethod,
          sampleSize: p.sampleSize,
          frequency: p.frequency,
          controlMethod: p.controlMethod,
        })),
      },
    },
    include: { checks: true },
  });

  await logAudit({
    actor: operator?.name || "Operator",
    action: "IPCC_CHECKLIST_STARTED",
    entityType: "IPCC_RUN",
    entityId: run.id,
    details: `${run.runNumber} · WO ${wo.woNumber} · ${planRows.length} checks from Control Plan`,
  });

  return { run };
}

/** Evaluate recorded values; any FAIL → auto-create an NCR draft. */
async function evaluateRun(
  runId: string,
  values: { checkId: string; value: string }[],
  operator: any,
) {
  const run = await prisma.ipccChecklistRun.findUnique({
    where: { id: runId },
    include: { checks: true, workOrder: { include: { product: true } } },
  });
  if (!run) return { error: "Run not found", status: 404 };
  if (run.status !== "OPEN")
    return { error: "Run already completed", status: 400 };

  let failedCount = 0;
  const failures: string[] = [];
  for (const v of values) {
    const check = run.checks.find((c) => c.id === v.checkId);
    if (!check) continue;
    const num =
      v.value === "" || v.value === null || v.value === undefined
        ? null
        : Number(v.value);
    let result = "PASS";
    let valueText: string | null = null;
    let measuredValue: number | null = null;
    if (num !== null && !isNaN(num)) {
      measuredValue = num;
      if (
        check.specMin !== null &&
        check.specMin !== undefined &&
        num < check.specMin
      )
        result = "FAIL";
      if (
        check.specMax !== null &&
        check.specMax !== undefined &&
        num > check.specMax
      )
        result = "FAIL";
    } else {
      // Attribute check (OK / NG) — no numeric spec
      valueText = v.value?.trim() || "OK";
      const upper = valueText.toUpperCase();
      if (
        upper === "NG" ||
        upper === "FAIL" ||
        upper === "BAD" ||
        upper === "REJECT"
      )
        result = "FAIL";
    }
    if (result === "FAIL") {
      failedCount++;
      failures.push(
        `${check.processStep || ""} ${check.characteristic} = ${measuredValue ?? valueText} (spec ${check.specMin ?? "—"}-${check.specMax ?? "—"})`,
      );
    }
    await prisma.ipccCheckResult.update({
      where: { id: check.id },
      data: {
        measuredValue,
        valueText,
        result,
        recordedAt: new Date(),
        recordedBy: operator?.name || "Operator",
      },
    });
  }

  let ncr = null;
  if (failedCount > 0) {
    // Auto NCR draft — the failed checks become a non-conformance.
    const ncrCount = await prisma.ncrReport.count();
    const defectCode = await prisma.defectCode.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
    ncr = await prisma.ncrReport.create({
      data: {
        ncrNumber: `IPQC-${new Date().getFullYear()}-${String(ncrCount + 1).padStart(4, "0")}`,
        workOrderId: run.workOrderId,
        productId: run.workOrder?.productId || null,
        quantity: Math.max(1, run.checks[0]?.sampleSize || 1),
        defectCodeId: defectCode?.id || null,
        severity: "HIGH",
        description: `IPQC check failed on ${run.workOrder?.woNumber}: ${failures.join("; ")}`,
        containmentAction: "Suspect product quarantined pending disposition.",
        raisedBy: operator?.name || "Operator",
      },
    });
    await logAudit({
      actor: operator?.name || "Operator",
      action: "IPCC_NCR_AUTO",
      entityType: "NCR",
      entityId: ncr.id,
      details: `Auto NCR ${ncr.ncrNumber} from IPQC run ${run.runNumber} — ${failures.join("; ")}`,
    });
  }

  const updated = await prisma.ipccChecklistRun.update({
    where: { id: runId },
    data: {
      status: failedCount > 0 ? "FAILED" : "PASSED",
      failedCount,
      ncrId: ncr?.id || null,
      completedAt: new Date(),
    },
    include: {
      checks: true,
      workOrder: { include: { product: true } },
      ncr: true,
    },
  });

  await logAudit({
    actor: operator?.name || "Operator",
    action: failedCount > 0 ? "IPCC_CHECKLIST_FAILED" : "IPCC_CHECKLIST_PASSED",
    entityType: "IPCC_RUN",
    entityId: runId,
    details: `${run.runNumber} · ${updated.checks.length} checks · ${failedCount} failed${ncr ? ` → NCR ${ncr.ncrNumber}` : ""}`,
  });

  return { run: updated, ncr, failures };
}

export async function GET(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const workOrderId = searchParams.get("workOrderId");
  const machineId = searchParams.get("machineId");

  try {
    const where: any = {};
    if (workOrderId) where.workOrderId = workOrderId;
    if (machineId) where.machineId = machineId;
    const runs = await prisma.ipccChecklistRun.findMany({
      where,
      include: {
        checks: { orderBy: { id: "asc" } },
        workOrder: {
          select: { woNumber: true, product: { select: { name: true } } },
        },
        machine: { select: { name: true, code: true } },
        operator: { select: { name: true, employeeNumber: true } },
        ncr: { select: { ncrNumber: true, status: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 100,
    });
    const openCount = await prisma.ipccChecklistRun.count({
      where: { status: "OPEN" },
    });
    const failedPending = await prisma.ipccChecklistRun.count({
      where: { status: "FAILED" },
    });
    return NextResponse.json({ runs, openCount, failedPending });
  } catch (error) {
    console.error("GET /api/ipcc error:", error);
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
    const { action, data } = body;
    if (!action || !data)
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );

    if (action === "generate") {
      const { workOrderId, machineId, processStep } = data;
      if (!workOrderId || !machineId)
        return NextResponse.json(
          { error: "workOrderId and machineId required" },
          { status: 400 },
        );
      const out = await generateRun(workOrderId, machineId, user, processStep);
      if (out.error)
        return NextResponse.json({ error: out.error }, { status: out.status });
      return NextResponse.json({ success: true, run: out.run });
    }

    if (action === "record") {
      const { runId, values } = data;
      if (!runId || !Array.isArray(values) || values.length === 0) {
        return NextResponse.json(
          { error: "runId and recorded values required" },
          { status: 400 },
        );
      }
      const out = await evaluateRun(runId, values, user);
      if (out.error)
        return NextResponse.json({ error: out.error }, { status: out.status });
      return NextResponse.json({
        success: true,
        run: out.run,
        ncr: out.ncr,
        failures: out.failures || [],
      });
    }

    if (action === "review") {
      // Manager reviews a FAILED run from the SPC anomalies queue.
      const gate = await requireManagerLevel(user);
      if (!gate.ok)
        return NextResponse.json({ error: gate.error }, { status: 403 });
      const reason = validateReason(data);
      if (!reason.ok)
        return NextResponse.json({ error: reason.error }, { status: 400 });
      const run = await prisma.ipccChecklistRun.findUnique({
        where: { id: data.id },
      });
      if (!run)
        return NextResponse.json({ error: "Run not found" }, { status: 404 });
      if (run.status !== "FAILED")
        return NextResponse.json(
          { error: "Only FAILED runs need review" },
          { status: 400 },
        );
      const updated = await prisma.ipccChecklistRun.update({
        where: { id: data.id },
        data: {
          status: "REVIEWED",
          reviewedBy: user.name || "Manager",
          reviewedAt: new Date(),
          reviewNote: reason.reason,
        },
      });
      await logAudit({
        actor: user.name || "Manager",
        action: "IPCC_REVIEWED",
        entityType: "IPCC_RUN",
        entityId: run.id,
        details: `${run.runNumber} reviewed — ${reason.reason}`,
      });
      return NextResponse.json({ success: true, run: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/ipcc error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
