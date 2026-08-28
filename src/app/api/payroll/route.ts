import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";

const STRUCTURE_FIELDS = [
  "employeeName",
  "employeeCode",
  "designation",
  "basicPay",
  "hra",
  "specialAllowance",
  "conveyance",
  "otherAllowance",
  "pfPercent",
  "professionalTax",
  "notes",
];
const NUMERIC_FIELDS = new Set([
  "basicPay",
  "hra",
  "specialAllowance",
  "conveyance",
  "otherAllowance",
  "pfPercent",
  "professionalTax",
]);

function coerce(data: any): any {
  const out: any = {};
  for (const f of STRUCTURE_FIELDS) {
    if (data[f] === undefined) continue;
    const val = data[f];
    if (NUMERIC_FIELDS.has(f))
      out[f] = val === "" || val == null ? 0 : Number(val);
    else out[f] = val === "" ? null : val;
  }
  return out;
}

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !canAny(user, ["people.view", "system.view"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const [structures, payslips, runs] = await Promise.all([
      prisma.salaryStructure.findMany({ orderBy: { employeeName: "asc" } }),
      prisma.payslip.findMany({
        orderBy: [{ month: "desc" }, { generatedAt: "desc" }],
        include: {
          salaryStructure: {
            select: {
              employeeName: true,
              employeeCode: true,
              designation: true,
            },
          },
        },
        take: 500,
      }),
      prisma.payrollRun.findMany({ orderBy: { month: "desc" }, take: 24 }),
    ]);
    return NextResponse.json({ structures, payslips, runs });
  } catch (error) {
    console.error("GET /api/payroll error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !canAny(user, ["people.edit", "system.edit"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { entity, action, data } = body;
    if (!action || !data) {
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );
    }

    let result: any;

    // P23 — approval chain: DRAFT → APPROVED → LOCKED; post-lock corrections are overrides
    if (action === "approve-run" || action === "lock-run") {
      const month = String(data.month || "");
      if (!/^\d{4}-\d{2}$/.test(month))
        return NextResponse.json(
          { error: "Month must be YYYY-MM" },
          { status: 400 },
        );
      if (!data.reason)
        return NextResponse.json({ error: "reason required" }, { status: 400 });
      const mgr = await requireManagerLevel(user);
      if (!mgr.ok)
        return NextResponse.json(
          { error: "Manager level required" },
          { status: 403 },
        );
      let run = await prisma.payrollRun.findUnique({ where: { month } });
      if (!run)
        return NextResponse.json(
          { error: `No payroll run for ${month} — generate it first` },
          { status: 400 },
        );
      if (action === "approve-run") {
        if (run.status !== "DRAFT")
          return NextResponse.json(
            { error: `Run is ${run.status} — only DRAFT runs can be approved` },
            { status: 400 },
          );
        run = await prisma.payrollRun.update({
          where: { month },
          data: {
            status: "APPROVED",
            approvedBy: user.name || "System",
            approvedAt: new Date(),
          },
        });
        await logAudit({
          actor: user.name || "System",
          action: "PAYROLL_RUN_APPROVED",
          entityType: "PAYROLL",
          entityId: run.id,
          details: `${month} approved — ${data.reason.slice(0, 80)}`,
        });
      } else {
        if (run.status !== "APPROVED")
          return NextResponse.json(
            { error: `Run is ${run.status} — approve it before locking` },
            { status: 400 },
          );
        run = await prisma.payrollRun.update({
          where: { month },
          data: {
            status: "LOCKED",
            lockedBy: user.name || "System",
            lockedAt: new Date(),
          },
        });
        await logAudit({
          actor: user.name || "System",
          action: "PAYROLL_RUN_LOCKED",
          entityType: "PAYROLL",
          entityId: run.id,
          details: `${month} locked — ${data.reason.slice(0, 80)}`,
        });
      }
      return NextResponse.json({ run });
    }

    if (action === "override-payslip") {
      const { payslipId, month, reason, fields } = data;
      if (!payslipId || !reason || !fields)
        return NextResponse.json(
          { error: "payslipId, reason and fields required" },
          { status: 400 },
        );
      const mgr = await requireManagerLevel(user);
      if (!mgr.ok)
        return NextResponse.json(
          { error: "Manager level required" },
          { status: 403 },
        );
      const m = String(month || "");
      const run = m
        ? await prisma.payrollRun.findUnique({ where: { month: m } })
        : null;
      if (run && run.status !== "LOCKED" && run.status !== "APPROVED")
        return NextResponse.json(
          {
            error: `Run is ${run.status} — override requires a locked (or approved) run`,
          },
          { status: 400 },
        );
      const slip = await prisma.payslip.findUnique({
        where: { id: payslipId },
      });
      if (!slip)
        return NextResponse.json(
          { error: "Payslip not found" },
          { status: 404 },
        );
      const patch: any = {};
      for (const [k, v] of Object.entries(fields)) {
        if (
          [
            "grossPay",
            "pfDeduction",
            "ptDeduction",
            "netPay",
            "otHours",
            "otPay",
          ].includes(k)
        )
          patch[k] = Number(v);
      }
      const updated = await prisma.payslip.update({
        where: { id: payslipId },
        data: { ...patch, generatedAt: new Date() },
      });
      const corrections: any[] = (run?.corrections as any) || [];
      if (run) {
        await prisma.payrollRun.update({
          where: { month: m },
          data: {
            corrections: [
              ...corrections,
              {
                at: new Date().toISOString(),
                by: user.name || "System",
                note: reason,
                detail: JSON.stringify(patch),
                payslipId,
              },
            ],
          },
        });
      }
      await logAudit({
        actor: user.name || "System",
        action: "PAYROLL_OVERRIDE",
        entityType: "PAYROLL",
        entityId: payslipId,
        details: `${slip.month} ${reason.slice(0, 80)} ${JSON.stringify(patch)}`,
      });
      return NextResponse.json({ payslip: updated });
    }

    if (action === "generate") {
      const month = String(data.month || "");
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return NextResponse.json(
          { error: "Month must be YYYY-MM" },
          { status: 400 },
        );
      }
      const structures = await prisma.salaryStructure.findMany();
      // P9 — approved overtime flows into payroll: match OvertimeRequest.user →
      // salary structure by employeeNumber or name, pay at hourly rate = gross/208.
      const [monthStart, monthEnd] = [
        new Date(month + "-01T00:00:00Z"),
        new Date(month + "-01T00:00:00Z"),
      ];
      monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
      const approvedOt = await prisma.overtimeRequest.findMany({
        where: { status: "APPROVED", date: { gte: monthStart, lt: monthEnd } },
        include: { user: { select: { name: true, employeeNumber: true } } },
      });
      const otByUser = new Map<string, { hours: number }>();
      for (const o of approvedOt) {
        const key = o.user.employeeNumber || o.user.name || o.userId;
        otByUser.set(key, { hours: (otByUser.get(key)?.hours || 0) + o.hours });
      }
      let created = 0;
      for (const s of structures) {
        const gross =
          s.basicPay +
          s.hra +
          s.specialAllowance +
          s.conveyance +
          s.otherAllowance;
        const pfBase = Math.min(s.basicPay, 15000);
        const pf = Math.round((pfBase * (s.pfPercent || 12)) / 100);
        const pt = s.professionalTax || 0;
        const hourly = gross / 208;
        const otMatch = otByUser.get(s.employeeCode) ||
          otByUser.get(s.employeeName) || { hours: 0 };
        const otPay = Number((otMatch.hours * hourly * 1.5).toFixed(0)); // 1.5× statutory OT rate
        const grossWithOt = gross + otPay;
        const net = grossWithOt - pf - pt;
        await prisma.payslip.upsert({
          where: {
            salaryStructureId_month: { salaryStructureId: s.id, month },
          },
          update: {
            grossPay: grossWithOt,
            pfDeduction: pf,
            ptDeduction: pt,
            netPay: net,
            otHours: otMatch.hours,
            otPay,
            generatedAt: new Date(),
          },
          create: {
            salaryStructureId: s.id,
            month,
            grossPay: grossWithOt,
            pfDeduction: pf,
            ptDeduction: pt,
            netPay: net,
            otHours: otMatch.hours,
            otPay,
          },
        });
        created++;
      }
      result = {
        month,
        generated: created,
        otHoursApproved: [...otByUser.values()].reduce(
          (a, v) => a + v.hours,
          0,
        ),
      };
      // P23 — generating (or re-generating) a draft always (re)creates the run as DRAFT
      await prisma.payrollRun.upsert({
        where: { month },
        update: { status: "DRAFT", generatedByName: user.name || "System" },
        create: {
          month,
          status: "DRAFT",
          generatedByName: user.name || "System",
        },
      });
    } else if (entity === "salaryStructures") {
      const model = prisma.salaryStructure;
      if (action === "create") {
        result = await model.create({ data: coerce(data) });
      } else if (action === "update") {
        if (!data.id)
          return NextResponse.json({ error: "Missing id" }, { status: 400 });
        result = await model.update({
          where: { id: data.id },
          data: coerce(data),
        });
      } else if (action === "delete") {
        if (!data.id)
          return NextResponse.json({ error: "Missing id" }, { status: 400 });
        result = await model.delete({ where: { id: data.id } });
      } else {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
    }

    await logAudit({
      actor: user.name || "Admin",
      action: `${action.toUpperCase()}_PAYROLL`,
      entityType: (entity || "PAYROLL").toUpperCase(),
      entityId: result?.id || data?.id || "unknown",
      details: `${user.name || "Admin"} ${action} on payroll${action === "generate" ? ` for ${data.month}` : ""}`,
    });

    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/payroll error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
