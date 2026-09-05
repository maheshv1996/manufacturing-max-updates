import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel } from "@/lib/managerGate";
import { logAudit, logAuditTx } from "@/lib/audit";
import { autoPostToGL } from "@/lib/glPosting";
import { toPaise } from "@/lib/money";

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
  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.isOwner && !canAny(user, ["people.edit", "system.edit"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
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
        run = await prisma.$transaction(async (tx) => {
          const updated = await tx.payrollRun.update({
            where: { month },
            data: {
              status: "APPROVED",
              approvedBy: user.name || "System",
              approvedAt: new Date(),
            },
          });
          await logAuditTx(tx, {
            actor: user.name || "System",
            action: "PAYROLL_RUN_APPROVED",
            entityType: "PAYROLL",
            entityId: updated.id,
            details: `${month} approved — ${data.reason.slice(0, 80)}`,
          });
          return updated;
        });

        // GL auto-post: monthly salary voucher (accrual) —
        //   Dr 5080 Salaries & Wages = Σ gross(+OT) + bonus + arrears − LOP
        //   Cr 2030 Statutory Dues  = Σ (PF + ESI + PT)
        //   Cr 2050 Wages Payable   = Σ net pay
        const sums = await (prisma as any).payslip.aggregate({
          where: { month },
          _sum: {
            grossPay: true,
            pfDeduction: true,
            ptDeduction: true,
            esiDeduction: true,
            netPay: true,
            bonus: true,
            arrears: true,
            lopDeduction: true,
          },
        });
        const s = sums._sum || {};
        const statu = (s.pfDeduction || 0) + (s.esiDeduction || 0) + (s.ptDeduction || 0);
        const netSum = s.netPay || 0;
        const expense =
          (s.grossPay || 0) + (s.bonus || 0) + (s.arrears || 0) - (s.lopDeduction || 0);
        if (netSum > 0.01) {
          const glLines: any[] = [
            {
              accountCode: "5080",
              debit: Math.round(expense * 100) / 100,
              narration: `Payroll ${month} — net ${Math.round(netSum)} + statutory ${Math.round(statu)}`,
            },
          ];
          if (statu > 0.01)
            glLines.push({
              accountCode: "2030",
              credit: Math.round(statu * 100) / 100,
              narration: "PF / ESI / PT statutory dues",
            });
          glLines.push({
            accountCode: "2050",
            credit: Math.round(netSum * 100) / 100,
            narration: "Net wages payable (bank transfer)",
          });
          await autoPostToGL({
            source: "VOUCHER",
            sourceId: run.id,
            memo: `Payroll run ${month} approved — salaries & wages accrual`,
            createdBy: user.name || "System",
            date: run.approvedAt || new Date(),
            lines: glLines,
          });
        }
      } else {
        if (run.status !== "APPROVED")
          return NextResponse.json(
            { error: `Run is ${run.status} — approve it before locking` },
            { status: 400 },
          );
        run = await prisma.$transaction(async (tx) => {
          const updated = await tx.payrollRun.update({
            where: { month },
            data: {
              status: "LOCKED",
              lockedBy: user.name || "System",
              lockedAt: new Date(),
            },
          });
          await logAuditTx(tx, {
            actor: user.name || "System",
            action: "PAYROLL_RUN_LOCKED",
            entityType: "PAYROLL",
            entityId: updated.id,
            details: `${month} locked — ${data.reason.slice(0, 80)}`,
          });
          return updated;
        });
      }
      return NextResponse.json({ run });
    }

    // P— payroll settlement: pays net wages and remits PF/ESI/PT statutory dues.
    // Accrual (posted at approval) reverses out — Dr Wages Payable + Statutory
    // Dues, Cr Bank — and a treasury outflow records the actual cash movement.
    if (action === "settle-run") {
      const month = String(data.month || "");
      if (!/^\d{4}-\d{2}$/.test(month))
        return NextResponse.json(
          { error: "Month must be YYYY-MM" },
          { status: 400 },
        );
      if (!data.reason)
        return NextResponse.json(
          { error: "reason required" },
          { status: 400 },
        );
      const mgr = await requireManagerLevel(user);
      if (!mgr.ok)
        return NextResponse.json(
          { error: "Manager level required" },
          { status: 403 },
        );
      const run = await prisma.payrollRun.findUnique({ where: { month } });
      if (!run)
        return NextResponse.json(
          { error: `No payroll run for ${month} — generate it first` },
          { status: 400 },
        );
      if (run.status !== "APPROVED" && run.status !== "LOCKED")
        return NextResponse.json(
          { error: `Run is ${run.status} — approve it before settling` },
          { status: 400 },
        );
      if (run.settledAt)
        return NextResponse.json(
          { error: `Run ${month} was already settled on ${run.settledAt.toISOString?.() || run.settledAt}` },
          { status: 400 },
        );

      const sums = await (prisma as any).payslip.aggregate({
        where: { month },
        _sum: {
          pfDeduction: true,
          ptDeduction: true,
          esiDeduction: true,
          netPay: true,
        },
      });
      const s = sums._sum || {};
      const netSum = s.netPay || 0;
      const statu = (s.pfDeduction || 0) + (s.esiDeduction || 0) + (s.ptDeduction || 0);
      if (netSum <= 0.01)
        return NextResponse.json(
          { error: `No net pay to settle for ${month}` },
          { status: 400 },
        );
      const total = Math.round((netSum + statu) * 100) / 100;
      const method = data.method || "Bank";

      const { treasury, settled } = await prisma.$transaction(async (tx) => {
        const tr = await tx.treasuryTransaction.create({
          data: {
            type: "OUTFLOW",
            account: "Main",
            amount: toPaise(total),
            reference: `Payroll-${month}`,
            category: "Payroll Settlement",
            notes: `${(data.reason || "").slice(0, 200)} — net ${Math.round(netSum)} + statutory ${Math.round(statu)}`,
          },
        });
        const st = await tx.payrollRun.update({
          where: { month },
          data: {
            status: "LOCKED",
            settledBy: user.name || "System",
            settledAt: new Date(),
          },
        });
        await logAuditTx(tx, {
          actor: user.name || "System",
          action: "PAYROLL_RUN_SETTLED",
          entityType: "PAYROLL",
          entityId: run.id,
          details: `${month} settled ${total} via ${method} (net ${Math.round(netSum)} + statutory ${Math.round(statu)}) — ${(data.reason || "").slice(0, 80)}`,
        });
        return { treasury: tr, settled: st };
      });

      await autoPostToGL({
        source: "PAYMENT",
        sourceId: treasury.id,
        memo: `Payroll settlement ${month} — net wages + PF/ESI/PT remittance`,
        createdBy: user.name || "System",
        date: settled.settledAt || new Date(),
        lines: [
          {
            accountCode: "2050",
            debit: Math.round(netSum * 100) / 100,
            narration: `Net wages paid ${month}`,
          },
          ...(statu > 0.01
            ? [
                {
                  accountCode: "2030",
                  debit: Math.round(statu * 100) / 100,
                  narration: "PF / ESI / PT remitted to authorities",
                },
              ]
            : []),
          {
            accountCode: "1020",
            credit: total,
            narration: `Bank — ${method}`,
          },
        ],
      });

      return NextResponse.json({
        settled: { ...settled, settledAmount: total },
      });
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
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.payslip.update({
          where: { id: payslipId },
          data: { ...patch, generatedAt: new Date() },
        });
        const corrections: any[] = (run?.corrections as any) || [];
        if (run) {
          await tx.payrollRun.update({
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
        await logAuditTx(tx, {
          actor: user.name || "System",
          action: "PAYROLL_OVERRIDE",
          entityType: "PAYROLL",
          entityId: payslipId,
          details: `${slip.month} ${reason.slice(0, 80)} ${JSON.stringify(patch)}`,
        });
        return u;
      });
      return NextResponse.json({ payslip: updated });
    }

    if (action === "adjust-payslip") {
      // Draft-run adjustments: LOP days / bonus / arrears per payslip, recomputed with deductions.
      const { payslipId, month, lopDays, bonus, arrears, reason } = data;
      if (!payslipId)
        return NextResponse.json(
          { error: "payslipId required" },
          { status: 400 },
        );
      const m = String(month || "");
      if (m) {
        const run = await prisma.payrollRun.findUnique({ where: { month: m } });
        if (run && run.status === "LOCKED")
          return NextResponse.json(
            { error: "Run is LOCKED — use override-payslip for locked runs" },
            { status: 400 },
          );
      }
      const slip = await prisma.payslip.findUnique({
        where: { id: payslipId },
        include: { salaryStructure: true },
      });
      if (!slip)
        return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
      const s = slip.salaryStructure;
      const gross =
        s.basicPay + s.hra + s.specialAllowance + s.conveyance + s.otherAllowance;
      const pf = Math.round(
        (Math.min(s.basicPay, 15000) * (s.pfPercent || 12)) / 100,
      );
      const pt = s.professionalTax || 0;
      const esi = gross <= 21000 ? Math.round(gross * 0.0075) : 0;
      const lopD = Math.round((gross / 30) * (Number(lopDays) || 0));
      const b = Number(bonus) || 0;
      const ar = Number(arrears) || 0;
      const net =
        gross + (slip.otPay || 0) + b + ar - pf - pt - esi - lopD;
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.payslip.update({
          where: { id: payslipId },
          data: {
            esiDeduction: esi,
            lopDays: Number(lopDays) || 0,
            lopDeduction: lopD,
            bonus: b,
            arrears: ar,
            netPay: net,
            generatedAt: new Date(),
          },
        });
        await logAuditTx(tx, {
          actor: user.name || "System",
          action: "PAYSLIP_ADJUSTED",
          entityType: "PAYROLL",
          entityId: payslipId,
          details: `${slip.month} LOP ${Number(lopDays) || 0}d / bonus ${b} / arrears ${ar} — ${(reason || "adjustment").slice(0, 80)}`,
        });
        return u;
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
      // Optional per-employee adjustments keyed by employeeCode: { "1001": 2 }
      const lopByCode: Record<string, number> = data.lopByCode || {};
      const bonusByCode: Record<string, number> = data.bonusByCode || {};
      const arrearsByCode: Record<string, number> = data.arrearsByCode || {};
      let created = 0;
      await prisma.$transaction(async (tx) => {
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
          const esi = gross <= 21000 ? Math.round(gross * 0.0075) : 0;
          const hourly = gross / 208;
          const otMatch = otByUser.get(s.employeeCode) ||
            otByUser.get(s.employeeName) || { hours: 0 };
          const otPay = Number((otMatch.hours * hourly * 1.5).toFixed(0));
          const lopDays = Number(lopByCode[s.employeeCode] || 0) || 0;
          const lopDeduction = Math.round((gross / 30) * lopDays);
          const bonus = Number(bonusByCode[s.employeeCode] || 0) || 0;
          const arrears = Number(arrearsByCode[s.employeeCode] || 0) || 0;
          const grossWithOt = gross + otPay;
          const net = grossWithOt + bonus + arrears - pf - pt - esi - lopDeduction;
          await tx.payslip.upsert({
            where: {
              salaryStructureId_month: { salaryStructureId: s.id, month },
            },
            update: {
              grossPay: grossWithOt,
              pfDeduction: pf,
              ptDeduction: pt,
              esiDeduction: esi,
              lopDays,
              lopDeduction,
              bonus,
              arrears,
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
              esiDeduction: esi,
              lopDays,
              lopDeduction,
              bonus,
              arrears,
              netPay: net,
              otHours: otMatch.hours,
              otPay,
            },
          });
          created++;
        }
        await tx.payrollRun.upsert({
          where: { month },
          update: { status: "DRAFT", generatedByName: user.name || "System" },
          create: {
            month,
            status: "DRAFT",
            generatedByName: user.name || "System",
          },
        });
        await logAuditTx(tx, {
          actor: user.name || "Admin",
          action: "GENERATE_PAYROLL",
          entityType: "PAYROLL",
          entityId: month,
          details: `${user.name || "Admin"} generated payroll for ${month} (${created} payslips)`,
        });
      });
      result = {
        month,
        generated: created,
        otHoursApproved: [...otByUser.values()].reduce(
          (a, v) => a + v.hours,
          0,
        ),
      };
    } else if (entity === "salaryStructures") {
      if (action === "create") {
        result = await prisma.$transaction(async (tx) => {
          const res = await tx.salaryStructure.create({ data: coerce(data) });
          await logAuditTx(tx, {
            actor: user.name || "Admin",
            action: "CREATE_SALARY_STRUCTURE",
            entityType: "SALARY_STRUCTURE",
            entityId: res.id,
            details: `Created salary structure for ${res.employeeName} (${res.employeeCode})`,
          });
          return res;
        });
      } else if (action === "update") {
        if (!data.id)
          return NextResponse.json({ error: "Missing id" }, { status: 400 });
        result = await prisma.$transaction(async (tx) => {
          const res = await tx.salaryStructure.update({
            where: { id: data.id },
            data: coerce(data),
          });
          await logAuditTx(tx, {
            actor: user.name || "Admin",
            action: "UPDATE_SALARY_STRUCTURE",
            entityType: "SALARY_STRUCTURE",
            entityId: res.id,
            details: `Updated salary structure for ${res.employeeName} (${res.employeeCode})`,
          });
          return res;
        });
      } else if (action === "delete") {
        if (!data.id)
          return NextResponse.json({ error: "Missing id" }, { status: 400 });
        result = await prisma.$transaction(async (tx) => {
          const res = await tx.salaryStructure.delete({ where: { id: data.id } });
          await logAuditTx(tx, {
            actor: user.name || "Admin",
            action: "DELETE_SALARY_STRUCTURE",
            entityType: "SALARY_STRUCTURE",
            entityId: data.id,
            details: `Deleted salary structure ${data.id}`,
          });
          return res;
        });
      } else {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
    }

    if (entity !== "salaryStructures" && action !== "generate") {
      await logAudit({
        actor: user.name || "Admin",
        action: `${action.toUpperCase()}_PAYROLL`,
        entityType: (entity || "PAYROLL").toUpperCase(),
        entityId: result?.id || data?.id || "unknown",
        details: `${user.name || "Admin"} ${action} on payroll`,
      });
    }

    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/payroll error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
