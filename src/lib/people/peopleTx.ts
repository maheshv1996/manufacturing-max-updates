/**
 * C7-3 — Typed people/payroll transaction adapters.
 * Mutations run the pure engine first and only then write,
 * inside one `$transaction`, with in-tx audit rows.
 */

import type { PrismaClient, Prisma } from "@prisma/client";
import { notFound, validation } from "../core/errors";
import { buildAuditEvent, type AuditEventInput } from "../core/audit";
import { validateEmployee, type ValidateEmployeeInput } from "./employees";
import { computeAttendance, type AttendanceLog } from "./attendance";
import { transitionLeave } from "./leaves";
import { computeMonthlyPayroll } from "./payroll";

type Tx = Prisma.TransactionClient;

async function audit(tx: Tx, input: AuditEventInput): Promise<void> {
  const ev = buildAuditEvent(input);
  await tx.auditLog.create({
    data: {
      actor: ev.actor,
      action: ev.action,
      entityType: ev.entityType,
      entityId: ev.entityId,
      details: ev.details ?? "",
      at: ev.at,
    },
  });
}

export interface PeopleActor {
  id: string;
  name?: string;
}

function toAttendanceLog(row: {
  userId: string;
  clockIn: Date;
  clockOut: Date | null;
  status: "PRESENT" | "LATE";
}): AttendanceLog {
  return {
    userId: row.userId,
    clockIn: row.clockIn,
    clockOut: row.clockOut,
    status: row.status,
  };
}

export async function createEmployee(
  db: PrismaClient,
  actor: PeopleActor,
  input: ValidateEmployeeInput,
): Promise<void> {
  const result = validateEmployee(input);
  if (result.tag === "err") {
    throw validation(result.error.map((e) => `${e.field}: ${e.message}`).join("; "));
  }

  await db.$transaction(async (tx) => {
    const created = await tx.employee.create({
      data: {
        employeeNumber: input.employeeNumber,
        name: input.name,
        designation: input.designation ?? null,
        department: input.department ?? null,
        panNumber: input.panNumber ?? null,
        aadhaarNumber: input.aadhaarNumber ?? null,
        pfUan: input.pfUan ?? null,
        esiNumber: input.esiNumber ?? null,
        createdBy: actor.id,
      },
    });

    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "Employee",
      entityId: created.id,
      action: "CREATE",
      details: `Created employee ${created.employeeNumber}`,
    });
  });
}

export async function computeAttendanceStats(
  logs: { userId: string; clockIn: Date; clockOut: Date | null; status: "PRESENT" | "LATE" }[],
  userId: string,
  year: number,
  month: number,
) {
  const attendanceLogs = logs.map(toAttendanceLog);
  const result = computeAttendance(attendanceLogs, userId, year, month);
  if (result.tag === "err") throw validation(result.error);
  return result.value;
}

export async function approveLeave(
  db: PrismaClient,
  actor: PeopleActor,
  leaveId: string,
  note?: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const leave = await tx.leaveRequest.findUnique({ where: { id: leaveId } });
    if (!leave) throw notFound("Leave not found");

    const result = transitionLeave(leave.status, "APPROVE", note);
    if (result.tag === "err") throw validation(result.error);

    const updated = await tx.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: "APPROVED",
        approvedById: actor.id,
        approvedAt: new Date(),
        note: note ?? leave.note,
      },
    });

    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "LeaveRequest",
      entityId: leaveId,
      action: "APPROVE",
      details: `Approved leave ${updated.id}`,
    });
  });
}

export async function rejectLeave(
  db: PrismaClient,
  actor: PeopleActor,
  leaveId: string,
  note?: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const leave = await tx.leaveRequest.findUnique({ where: { id: leaveId } });
    if (!leave) throw notFound("Leave not found");

    const result = transitionLeave(leave.status, "REJECT", note);
    if (result.tag === "err") throw validation(result.error);

    const updated = await tx.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: "REJECTED",
        approvedById: actor.id,
        approvedAt: new Date(),
        note: note ?? leave.note,
      },
    });

    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "LeaveRequest",
      entityId: leaveId,
      action: "REJECT",
      details: `Rejected leave ${updated.id}`,
    });
  });
}

export async function cancelLeave(
  db: PrismaClient,
  actor: PeopleActor,
  leaveId: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const leave = await tx.leaveRequest.findUnique({ where: { id: leaveId } });
    if (!leave) throw notFound("Leave not found");

    const result = transitionLeave(leave.status, "CANCEL");
    if (result.tag === "err") throw validation(result.error);

    const updated = await tx.leaveRequest.update({
      where: { id: leaveId },
      data: { status: "CANCELLED" },
    });

    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "LeaveRequest",
      entityId: leaveId,
      action: "CANCEL",
      details: `Cancelled leave ${updated.id}`,
    });
  });
}

export async function runPayrollForMonth(
  db: PrismaClient,
  actor: PeopleActor,
  year: number,
  month: number,
  employees: {
    employeeCode: string;
    employeeName: string;
    basicPay: number;
    hra: number;
    specialAllowance: number;
    conveyance: number;
    otherAllowance: number;
    pfPercent: number;
    professionalTax: number;
  }[],
  attendanceMap: Map<string, { presentDays: number; lateDays: number; workedHours: number; otHours: number; regularHours: number }>,
  settings: {
    otDailyThresholdHours: number;
    otMultiplier: number;
    laborRatePerHour: number;
    pfPercent: number;
    esiThreshold: number;
    professionalTax: number;
  },
): Promise<void> {
  const payrollResult = computeMonthlyPayroll(employees, attendanceMap, settings, year, month);
  if (payrollResult.tag === "err") throw validation(payrollResult.error);

  await db.$transaction(async (tx) => {
    const monthStr = `${year}-${String(month).padStart(2, "0")}`;

    const existing = await tx.payrollRun.findUnique({ where: { month: monthStr } });
    if (existing) {
      await tx.payrollRun.update({
        where: { month: monthStr },
        data: { status: "DRAFT", corrections: [] },
      });
    } else {
      await tx.payrollRun.create({
        data: { month: monthStr, status: "DRAFT" },
      });
    }

    for (const row of payrollResult.value.rows) {
      const emp = employees.find((e) => e.employeeCode === row.employeeCode);
      if (!emp) continue;

      let salaryStructure = await tx.salaryStructure.findUnique({
        where: { employeeCode: row.employeeCode },
      });

      if (!salaryStructure) {
        salaryStructure = await tx.salaryStructure.create({
          data: {
            employeeCode: row.employeeCode,
            employeeName: row.employeeName,
            basicPay: emp.basicPay,
            hra: emp.hra,
            specialAllowance: emp.specialAllowance,
            conveyance: emp.conveyance,
            otherAllowance: emp.otherAllowance,
            pfPercent: emp.pfPercent,
            professionalTax: emp.professionalTax,
          },
        });
      }

      await tx.payslip.upsert({
        where: {
          salaryStructureId_month: {
            salaryStructureId: salaryStructure.id,
            month: monthStr,
          },
        },
        create: {
          salaryStructureId: salaryStructure.id,
          month: monthStr,
          grossPay: row.grossPay,
          pfDeduction: row.pfDeduction,
          ptDeduction: row.ptDeduction,
          netPay: row.netPay,
          otHours: row.otHours,
          otPay: row.otPay,
          esiDeduction: row.esiDeduction,
          lopDays: row.lopDays,
          lopDeduction: row.lopDeduction,
        },
        update: {
          grossPay: row.grossPay,
          pfDeduction: row.pfDeduction,
          ptDeduction: row.ptDeduction,
          netPay: row.netPay,
          otHours: row.otHours,
          otPay: row.otPay,
          esiDeduction: row.esiDeduction,
          lopDays: row.lopDays,
          lopDeduction: row.lopDeduction,
        },
      });
    }

    await audit(tx, {
      actor: actor.name ?? actor.id,
      entityType: "PayrollRun",
      entityId: monthStr,
      action: "RUN",
      details: `Ran payroll for ${monthStr}`,
    });
  });
}
