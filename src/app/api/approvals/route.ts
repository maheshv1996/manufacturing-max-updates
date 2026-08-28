import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/permissions";
import { requireManagerLevel } from "@/lib/managerGate";

export const dynamic = "force-dynamic";

// Manager-only digest powering the Approvals + Team KPIs + Budget cards on
// department hubs. Workers never need this — their hubs show "My" queues.
export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  const gate = await requireManagerLevel(user);
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.error || "Forbidden" },
      { status: 403 },
    );
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    pendingLeaves,
    disputedCounts,
    openNcrs,
    submittedFais,
    pendingEscalations,
    presentToday,
    monthSpendRows,
    teamCount,
  ] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { status: "PENDING" },
      include: { user: { select: { name: true, employeeNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    (prisma as any).shiftCount.count({ where: { status: "DISPUTED" } }),
    prisma.ncrReport.count({ where: { status: "OPEN" } }),
    prisma.faiReport.count({ where: { status: "SUBMITTED" } }),
    (prisma as any).escalation.count({ where: { status: "OPEN" } }),
    prisma.attendanceLog.count({
      where: { clockIn: { gte: todayStart }, clockOut: null },
    }),
    (prisma as any).treasuryTransaction.findMany({
      where: { type: "OUTFLOW", date: { gte: monthStart } },
      select: { amount: true },
    }),
    prisma.user.count({ where: { isActive: true, role: { isNot: null } } }),
  ]);

  const monthSpend = monthSpendRows.reduce(
    (s: number, t: any) => s + (t.amount || 0),
    0,
  );

  return NextResponse.json({
    level: "MANAGER",
    approvals: {
      pendingLeaves: pendingLeaves.map((l: any) => ({
        id: l.id,
        name: l.user?.name || "Unknown",
        employeeNumber: l.user?.employeeNumber || "",
        type: l.type,
        days: l.days,
        from: l.fromDate,
        reason: l.reason,
      })),
      pendingLeaveCount: pendingLeaves.length,
      disputedCounts,
      openNcrs,
      submittedFais,
      pendingEscalations,
    },
    team: {
      presentToday,
      teamCount,
      attendanceRate:
        teamCount > 0 ? Math.round((presentToday / teamCount) * 100) : 0,
      openNcrs,
    },
    budget: {
      monthSpend,
      monthLabel: monthStart.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      }),
    },
  });
}
