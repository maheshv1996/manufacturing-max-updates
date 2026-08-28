import { prisma } from "./prisma";
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  subDays,
  endOfDay,
  subWeeks,
  subMonths,
  format,
} from "date-fns";

type AnalystResponse = {
  title: string;
  lines: string[];
  table?: {
    headers: string[];
    rows: (string | number)[][];
  };
  link?: string;
  linkText?: string;
};

export async function analyzeQuery(
  question: string,
  plantId: string,
  _userId: string,
): Promise<AnalystResponse> {
  const q = question.toLowerCase();

  // Date parsing
  let start = startOfMonth(new Date());
  let end = endOfDay(new Date());
  let dateText = "this month";

  if (q.includes("today")) {
    start = startOfDay(new Date());
    dateText = "today";
  } else if (q.includes("yesterday")) {
    start = startOfDay(subDays(new Date(), 1));
    end = endOfDay(subDays(new Date(), 1));
    dateText = "yesterday";
  } else if (q.includes("this week")) {
    start = startOfWeek(new Date(), { weekStartsOn: 1 });
    dateText = "this week";
  } else if (q.includes("last week")) {
    start = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
    end = endOfDay(subDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 1));
    dateText = "last week";
  } else if (q.includes("last month")) {
    start = startOfMonth(subMonths(new Date(), 1));
    end = endOfDay(subDays(startOfMonth(new Date()), 1));
    dateText = "last month";
  } else {
    const match = q.match(/last (\d+) days/);
    if (match && match[1]) {
      const days = parseInt(match[1]);
      start = startOfDay(subDays(new Date(), days));
      dateText = `last ${days} days`;
    }
  }

  // Common where clause for plant
  const plantWhere = plantId === "ALL" ? {} : { plantId };

  // 1. OEE / Performance
  if (
    q.includes("oee") ||
    q.includes("performance") ||
    q.includes("efficiency")
  ) {
    const machines = await prisma.machine.findMany({
      where: { isActive: true, ...plantWhere },
      include: {
        productionLogs: {
          where: { startTime: { gte: start, lte: end } },
        },
      },
    });

    let totalIdeal = 0;
    let totalActual = 0;

    machines.forEach((m) => {
      const logs = m.productionLogs;
      const goodQty = logs.reduce((sum, l) => sum + l.goodQuantity, 0);
      const idealQty = logs.reduce((sum, l) => {
        const durationSecs =
          ((l.endTime || new Date()).getTime() - l.startTime.getTime()) / 1000;
        return sum + durationSecs / m.idealCycleTimeSeconds;
      }, 0);

      totalIdeal += idealQty;
      totalActual += goodQty;
    });

    const oee = totalIdeal > 0 ? (totalActual / totalIdeal) * 100 : 0;

    return {
      title: `Plant OEE for ${dateText}`,
      lines: [
        `Calculated average OEE: **${oee.toFixed(1)}%**`,
        `Based on ${machines.length} active machines.`,
      ],
      link: "/",
      linkText: "View Dashboard",
    };
  }

  // 2. Profit / Loss / Margins
  if (
    q.includes("lost money") ||
    q.includes("loss") ||
    q.includes("profit") ||
    q.includes("margin")
  ) {
    const wos = await prisma.workOrder.findMany({
      where: {
        status: "COMPLETED",
        plannedEndDate: { gte: start, lte: end },
        ...plantWhere,
      },
      include: { quotations: true },
    });

    const rows: any[] = [];
    wos.forEach((wo) => {
      const rev = wo.quotedPrice || 0;
      const cost = wo.quotations[0]?.estimatedCost || rev * 0.8;
      const margin = rev - cost;
      if (margin < 0) {
        rows.push([
          wo.woNumber,
          `₹${rev.toLocaleString()}`,
          `₹${cost.toLocaleString()}`,
          `₹${margin.toLocaleString()}`,
        ]);
      }
    });

    rows.sort((a, b) => {
      const mA = parseFloat(a[3].replace(/[₹,]/g, ""));
      const mB = parseFloat(b[3].replace(/[₹,]/g, ""));
      return mA - mB;
    });

    return {
      title: `Loss-Making Work Orders (${dateText})`,
      lines: [
        rows.length > 0
          ? `Found **${rows.length}** work orders that lost money.`
          : "No loss-making work orders found in this period.",
      ],
      table:
        rows.length > 0
          ? {
              headers: ["WO Number", "Revenue", "Cost", "Margin"],
              rows,
            }
          : undefined,
      link: "/reports/profitability",
      linkText: "View Profitability Report",
    };
  }

  // 3. Machine Cost (costliest machine)
  if (
    q.includes("machine") &&
    (q.includes("cost") || q.includes("money") || q.includes("expensive"))
  ) {
    const logs = await prisma.downtimeLog.findMany({
      where: {
        startTime: { gte: start, lte: end },
        machine: plantWhere,
      },
      include: { machine: true, reason: true },
    });

    const machineCosts: Record<
      string,
      { name: string; cost: number; reasons: Record<string, number> }
    > = {};

    logs.forEach((l) => {
      const durationMins = l.durationMinutes || 0;
      const cost = durationMins * 50; // Approximated downtime cost per minute
      const mId = l.machineId;
      if (!machineCosts[mId]) {
        machineCosts[mId] = { name: l.machine.name, cost: 0, reasons: {} };
      }
      machineCosts[mId].cost += cost;
      const rName = l.reason?.description || "Unknown";
      machineCosts[mId].reasons[rName] =
        (machineCosts[mId].reasons[rName] || 0) + cost;
    });

    const sortedMachines = Object.values(machineCosts).sort(
      (a, b) => b.cost - a.cost,
    );

    if (sortedMachines.length === 0) {
      return {
        title: `Costliest Machine (${dateText})`,
        lines: ["No downtime costs recorded in this period."],
      };
    }

    const topMachine = sortedMachines[0];
    const topReason = Object.entries(topMachine.reasons).sort(
      (a, b) => b[1] - a[1],
    )[0];

    return {
      title: `Costliest Machine (${dateText})`,
      lines: [
        `**${topMachine.name}** is the most expensive machine, costing **₹${topMachine.cost.toLocaleString()}** in downtime.`,
        `Top reason: **${topReason[0]}** (costing ₹${topReason[1].toLocaleString()})`,
      ],
      link: "/reports/machine-history",
      linkText: "View Machine History",
    };
  }

  // 4. Downtime / Stoppage
  if (q.includes("downtime") || q.includes("stoppage") || q.includes("stop")) {
    const logs = await prisma.downtimeLog.findMany({
      where: {
        startTime: { gte: start, lte: end },
        machine: plantWhere,
      },
      include: { reason: true },
    });

    const reasonMins: Record<string, number> = {};
    logs.forEach((l) => {
      const name = l.reason?.description || "Unknown";
      reasonMins[name] = (reasonMins[name] || 0) + (l.durationMinutes || 0);
    });

    const topReasons = Object.entries(reasonMins)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      title: `Top Downtime Reasons (${dateText})`,
      lines: [
        topReasons.length > 0
          ? "The primary reasons for stoppages were:"
          : "No downtime logged.",
      ],
      table:
        topReasons.length > 0
          ? {
              headers: ["Reason", "Minutes Lost"],
              rows: topReasons.map((r) => [r[0], r[1].toFixed(1)]),
            }
          : undefined,
      link: "/reports/pareto",
      linkText: "View Downtime Pareto",
    };
  }

  // 5. Best Operator / Champion
  if (
    q.includes("best operator") ||
    q.includes("champion") ||
    q.includes("top operator")
  ) {
    const logs = await prisma.productionLog.findMany({
      where: {
        startTime: { gte: start, lte: end },
        operatorId: { not: null },
        machine: plantWhere,
      },
      include: { operator: true, machine: true },
    });

    const opScores: Record<
      string,
      { name: string; good: number; scrap: number }
    > = {};
    logs.forEach((l) => {
      if (!l.operatorId) return;
      if (!opScores[l.operatorId]) {
        opScores[l.operatorId] = {
          name: l.operator?.name || "Unknown",
          good: 0,
          scrap: 0,
        };
      }
      opScores[l.operatorId].good += l.goodQuantity;
      opScores[l.operatorId].scrap += l.scrapQuantity;
    });

    const sorted = Object.values(opScores).sort((a, b) => b.good - a.good);
    if (sorted.length === 0) {
      return {
        title: `Top Operator (${dateText})`,
        lines: ["No production logged by operators."],
      };
    }

    const champ = sorted[0];
    return {
      title: `Operator Champion (${dateText})`,
      lines: [
        `**${champ.name}** is the top performer.`,
        `Produced **${champ.good}** good units with **${champ.scrap}** scrap units.`,
      ],
      link: "/people/leaderboard",
      linkText: "View Leaderboard",
    };
  }

  // 6. Late / Absent / Attendance
  if (q.includes("late") || q.includes("absent") || q.includes("attendance")) {
    const logs = await prisma.attendanceLog.findMany({
      where: {
        clockIn: { gte: start, lte: end },
        user: { homePlantId: plantId === "ALL" ? undefined : plantId },
      },
      include: { user: true },
    });

    const lates = logs.filter((l) => l.status === "LATE");

    return {
      title: `Attendance Issues (${dateText})`,
      lines: [`Recorded **${lates.length}** late arrivals.`],
      table:
        lates.length > 0
          ? {
              headers: ["Operator", "Date", "Status"],
              rows: lates.map((l) => [
                l.user.name,
                format(l.clockIn, "MMM dd, HH:mm"),
                "LATE",
              ]),
            }
          : undefined,
      link: "/reports/attendance",
      linkText: "View Attendance Report",
    };
  }

  // 7. Stock / Low / Reorder
  if (
    q.includes("stock") ||
    q.includes("low") ||
    q.includes("reorder") ||
    q.includes("material")
  ) {
    const materials = await prisma.rawMaterial.findMany({
      where: {
        isActive: true,
        ...plantWhere,
      },
    });

    const lowStock = materials.filter((m) => m.currentStock <= m.minStock);

    return {
      title: "Low Stock Alerts",
      lines: [
        lowStock.length > 0
          ? `Found **${lowStock.length}** materials below minimum stock levels.`
          : "All materials are well-stocked.",
      ],
      table:
        lowStock.length > 0
          ? {
              headers: ["SKU", "Name", "Current", "Min", "Shortage"],
              rows: lowStock.map((m) => [
                m.sku,
                m.name,
                `${m.currentStock} ${m.unit}`,
                `${m.minStock} ${m.unit}`,
                `${m.minStock - m.currentStock} ${m.unit}`,
              ]),
            }
          : undefined,
      link: "/system/admin?tab=inventory",
      linkText: "Manage Inventory",
    };
  }

  // 8. Overloaded / Capacity
  if (q.includes("overloaded") || q.includes("capacity")) {
    const activeWos = await prisma.workOrder.findMany({
      where: {
        status: { in: ["PLANNED", "IN_PROGRESS"] },
        ...plantWhere,
      },
    });

    const requiredHours = activeWos.reduce(
      (sum, wo) =>
        sum + (wo.plannedQuantity * (wo.cycleTimeSeconds || 60)) / 3600,
      0,
    );

    return {
      title: "Capacity & Workload",
      lines: [
        `Currently, there are **${activeWos.length}** open work orders.`,
        `Total estimated workload: **${requiredHours.toFixed(1)}** hours.`,
      ],
      link: "/ops/capacity",
      linkText: "View Capacity Planner",
    };
  }

  // 9. Owes / Payment / Receivable
  if (
    q.includes("owes") ||
    q.includes("payment") ||
    q.includes("receivable") ||
    q.includes("unpaid")
  ) {
    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ["UNPAID", "PARTIAL"] },
      },
    });

    let totalOwed = 0;
    const rows = invoices.map((inv) => {
      const owed = inv.totalValue - inv.paidAmount;
      totalOwed += owed;
      const daysOverdue = inv.dueDate
        ? Math.floor(
            (new Date().getTime() - inv.dueDate.getTime()) / (1000 * 3600 * 24),
          )
        : 0;
      return [
        inv.invoiceNumber,
        inv.customerName,
        `₹${owed.toLocaleString()}`,
        daysOverdue > 0 ? `${daysOverdue} days` : "Not due",
      ];
    });

    return {
      title: "Outstanding Receivables",
      lines: [
        `There are **${invoices.length}** outstanding invoices totaling **₹${totalOwed.toLocaleString()}**.`,
      ],
      table:
        rows.length > 0
          ? {
              headers: ["Invoice", "Customer", "Amount Owed", "Overdue"],
              rows,
            }
          : undefined,
      link: "/reports/receivables",
      linkText: "View A/R Report",
    };
  }

  // 10. Energy / Power
  if (
    q.includes("energy") ||
    q.includes("power") ||
    q.includes("electricity")
  ) {
    const readings = await prisma.energyReading.findMany({
      where: {
        date: { gte: start, lte: end },
      },
    });

    const totalCost = readings.reduce((sum, r) => sum + r.totalCost, 0);
    const totalKwh = readings.reduce((sum, r) => sum + r.totalKwh, 0);

    return {
      title: `Energy Consumption (${dateText})`,
      lines: [
        `Total energy cost: **₹${totalCost.toLocaleString()}**`,
        `Total consumption: **${totalKwh.toLocaleString()} kWh**`,
      ],
      link: "/system/admin?tab=energy",
      linkText: "View Energy Readings",
    };
  }

  // 11. Maintenance / Breakdown / PM
  if (
    q.includes("maintenance") ||
    q.includes("breakdown") ||
    q.includes("pm") ||
    q.includes("repair")
  ) {
    const openJobs = await prisma.maintenanceJob.findMany({
      where: {
        status: "OPEN",
        machine: plantWhere,
      },
      include: { machine: true },
    });

    return {
      title: "Maintenance Status",
      lines: [`There are **${openJobs.length}** open maintenance jobs.`],
      table:
        openJobs.length > 0
          ? {
              headers: ["Machine", "Type", "Priority", "Description"],
              rows: openJobs.map((j) => [
                j.machine.name,
                j.type,
                j.priority,
                j.description,
              ]),
            }
          : undefined,
      link: "/system/maintenance",
      linkText: "View Maintenance Hub",
    };
  }

  // 12. Scrap / Defect / Quality
  if (q.includes("scrap") || q.includes("defect") || q.includes("quality")) {
    const logs = await prisma.productionLog.findMany({
      where: {
        startTime: { gte: start, lte: end },
        machine: plantWhere,
      },
    });

    let good = 0;
    let scrap = 0;
    logs.forEach((l) => {
      good += l.goodQuantity;
      scrap += l.scrapQuantity;
    });

    const scrapPct = good + scrap > 0 ? (scrap / (good + scrap)) * 100 : 0;

    return {
      title: `Quality & Scrap (${dateText})`,
      lines: [
        `Total Scrap: **${scrap} units**`,
        `Scrap Percentage: **${scrapPct.toFixed(2)}%**`,
      ],
      link: "/ops/scrap",
      linkText: "View Scrap Management",
    };
  }

  // Fallback
  return {
    title: "I'm still learning!",
    lines: [
      "I didn't quite catch that. I can answer questions about:",
      "- **OEE** and factory performance",
      "- **Profit & Loss** margins",
      "- **Machine downtime** and costs",
      "- **Best operators** and champions",
      "- **Attendance** (late/absent)",
      "- **Low stock** and inventory",
      "- **Capacity** and overloaded machines",
      "- **Receivables** and outstanding payments",
      "- **Energy** costs",
      "- **Maintenance** and breakdowns",
      "- **Quality** and scrap",
    ],
  };
}
