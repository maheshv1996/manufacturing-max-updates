import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const operatorId = searchParams.get("operatorId");
    const month =
      searchParams.get("month") || new Date().toISOString().slice(0, 7); // "YYYY-MM"

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Fetch shifts, operators, active assignments
    const [
      shifts,
      operators,
      activeAssignments,
      todayLogs,
      pendingLeaves,
      activeLeavesToday,
    ] = await Promise.all([
      prisma.shift.findMany({ orderBy: { name: "asc" } }),
      prisma.user.findMany({
        where: { role: { name: "Operator" } },
        orderBy: { name: "asc" },
      }),
      prisma.assignment.findMany({
        where: { status: "ACTIVE" },
        include: { operator: true, shift: true, machine: true },
      }),
      prisma.attendanceLog.findMany({
        where: {
          clockIn: { gte: todayStart, lte: todayEnd },
        },
        include: { user: true, shift: true },
      }),
      prisma.leaveRequest.findMany({
        where: { status: "PENDING" },
        include: { user: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.leaveRequest.findMany({
        where: {
          status: "APPROVED",
          fromDate: { lte: todayEnd },
          toDate: { gte: todayStart },
        },
        include: { user: true },
      }),
    ]);

    // Build Today Shift Board
    const todayBoard = shifts.map((shift) => {
      // Find assignments for this shift
      const shiftAssignments = activeAssignments.filter(
        (a) => a.shiftId === shift.id,
      );

      // Find operators who clocked in for this shift today
      const shiftLogs = todayLogs.filter((l) => l.shiftId === shift.id);

      // Combine assigned operators & any extra clocked-in operators
      const operatorMap = new Map<string, any>();

      shiftAssignments.forEach((a) => {
        const isOnLeave = activeLeavesToday.find(
          (l) => l.userId === a.operatorId,
        );
        operatorMap.set(a.operatorId, {
          operatorId: a.operatorId,
          operatorName: a.operator?.name || "Operator",
          machineName: a.machine?.name,
          shiftId: shift.id,
          status: isOnLeave ? "ON_LEAVE" : "ABSENT", // default to absent or leave until log matched
          clockIn: null as Date | null,
          clockOut: null as Date | null,
        });
      });

      shiftLogs.forEach((l) => {
        const existing = operatorMap.get(l.userId);
        operatorMap.set(l.userId, {
          operatorId: l.userId,
          operatorName: l.user?.name || existing?.operatorName || "Operator",
          machineName: existing?.machineName,
          shiftId: shift.id,
          status: l.status, // "PRESENT" or "LATE"
          clockIn: l.clockIn,
          clockOut: l.clockOut,
        });
      });

      return {
        shift,
        operators: Array.from(operatorMap.values()),
      };
    });

    // Monthly Register processing if operatorId is selected
    let monthlyRegister: any[] = [];
    let monthlyTotals = {
      presentDays: 0,
      lateCount: 0,
      totalHours: 0,
    };
    let leaveBalancesObj = null;

    if (operatorId) {
      const [yearStr, monthStr] = month.split("-");
      const startDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
      const endDate = new Date(
        parseInt(yearStr),
        parseInt(monthStr),
        0,
        23,
        59,
        59,
        999,
      );

      const [logs, prodLogs, monthlyLeaves, allUserLeaves, settings] =
        await Promise.all([
          prisma.attendanceLog.findMany({
            where: {
              userId: operatorId,
              clockIn: { gte: startDate, lte: endDate },
            },
            include: { shift: true },
            orderBy: { clockIn: "asc" },
          }),
          prisma.productionLog.findMany({
            where: {
              operatorId,
              startTime: { gte: startDate, lte: endDate },
            },
            include: { machine: true },
          }),
          prisma.leaveRequest.findMany({
            where: {
              userId: operatorId,
              status: "APPROVED",
              fromDate: { lte: endDate },
              toDate: { gte: startDate },
            },
          }),
          prisma.leaveRequest.findMany({
            where: {
              userId: operatorId,
              status: "APPROVED",
            },
          }),
          prisma.setting.findMany(),
        ]);

      monthlyRegister = logs.map((log) => {
        const dateStr = new Date(log.clockIn).toISOString().slice(0, 10);

        // Hours present
        const end = log.clockOut ? new Date(log.clockOut) : new Date();
        const durationSec = Math.max(
          0,
          (end.getTime() - new Date(log.clockIn).getTime()) / 1000,
        );
        const hoursPresent = Number((durationSec / 3600).toFixed(1));

        // Find production logs on this date
        const dayProdLogs = prodLogs.filter(
          (p) => new Date(p.startTime).toISOString().slice(0, 10) === dateStr,
        );

        const totalGood = dayProdLogs.reduce(
          (sum, p) => sum + (p.goodQuantity || 0),
          0,
        );
        const avgCycleSec =
          dayProdLogs[0]?.machine?.idealCycleTimeSeconds || 60;

        let efficiencyPct = 0;
        if (hoursPresent > 0 && totalGood > 0) {
          efficiencyPct = Math.min(
            120,
            Number(
              (
                ((totalGood * avgCycleSec) / (hoursPresent * 3600)) *
                100
              ).toFixed(1),
            ),
          );
        }

        if (log.status === "PRESENT") monthlyTotals.presentDays++;
        if (log.status === "LATE") {
          monthlyTotals.presentDays++;
          monthlyTotals.lateCount++;
        }
        monthlyTotals.totalHours += hoursPresent;

        return {
          id: log.id,
          date: dateStr,
          shiftName: log.shift?.name || "Shift",
          clockIn: log.clockIn,
          clockOut: log.clockOut,
          hoursPresent,
          goodUnits: totalGood,
          efficiencyPct,
          status: log.status,
        };
      });

      monthlyTotals.totalHours = Number(monthlyTotals.totalHours.toFixed(1));

      // Inject leave days into the monthly register
      monthlyLeaves.forEach((leave) => {
        let current = new Date(
          Math.max(leave.fromDate.getTime(), startDate.getTime()),
        );
        const end = new Date(
          Math.min(leave.toDate.getTime(), endDate.getTime()),
        );

        while (current <= end) {
          const dateStr = current.toISOString().slice(0, 10);
          if (!monthlyRegister.find((r) => r.date === dateStr)) {
            monthlyRegister.push({
              id: `leave-${leave.id}-${dateStr}`,
              date: dateStr,
              shiftName: "-",
              clockIn: null,
              clockOut: null,
              hoursPresent: 0,
              goodUnits: 0,
              efficiencyPct: 0,
              status: "ON_LEAVE",
            });
          }
          current.setDate(current.getDate() + 1);
        }
      });
      monthlyRegister.sort((a, b) => a.date.localeCompare(b.date));

      // Calculate leave balances
      const clStr = settings.find((s) => s.key === "clPerYear")?.value;
      const slStr = settings.find((s) => s.key === "slPerYear")?.value;
      const plStr = settings.find((s) => s.key === "plPerYear")?.value;

      const clPerYear: number = clStr ? parseInt(clStr, 10) : 12;
      const slPerYear: number = slStr ? parseInt(slStr, 10) : 8;
      const plPerYear: number = plStr ? parseInt(plStr, 10) : 12;

      let clTaken = 0,
        slTaken = 0,
        plTaken = 0;
      allUserLeaves.forEach((l) => {
        if (l.type === "CL") clTaken += l.days;
        if (l.type === "SL") slTaken += l.days;
        if (l.type === "PL") plTaken += l.days;
      });

      leaveBalancesObj = {
        cl: {
          total: clPerYear,
          taken: clTaken,
          remaining: clPerYear - clTaken,
        },
        sl: {
          total: slPerYear,
          taken: slTaken,
          remaining: slPerYear - slTaken,
        },
        pl: {
          total: plPerYear,
          taken: plTaken,
          remaining: plPerYear - plTaken,
        },
      };
    }

    return NextResponse.json({
      todayBoard,
      operators,
      monthlyRegister,
      monthlyTotals,
      pendingLeaves,
      activeLeavesToday,
      leaveBalances: leaveBalancesObj,
    });
  } catch (error: any) {
    console.error("Failed to fetch attendance data:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
