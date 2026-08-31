import { prisma } from "./prisma";
import { getSettings } from "./settings";
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  startOfQuarter,
  subDays,
  endOfDay,
  subWeeks,
  subMonths,
} from "date-fns";

export type AnalystResponse = {
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
  _userId?: string,
): Promise<AnalystResponse> {
  const q = String(question || "").toLowerCase().trim();

  // 1. Robust Date Keyword Parsing
  let start = startOfMonth(new Date());
  let end = endOfDay(new Date());
  let dateText = "this month";

  if (/\btoday\b/.test(q)) {
    start = startOfDay(new Date());
    dateText = "today";
  } else if (/\byesterday\b/.test(q)) {
    start = startOfDay(subDays(new Date(), 1));
    end = endOfDay(subDays(new Date(), 1));
    dateText = "yesterday";
  } else if (/\bthis\s+week\b/.test(q)) {
    start = startOfWeek(new Date(), { weekStartsOn: 1 });
    dateText = "this week";
  } else if (/\blast\s+week\b/.test(q)) {
    start = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
    end = endOfDay(subDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 1));
    dateText = "last week";
  } else if (/\blast\s+month\b/.test(q)) {
    start = startOfMonth(subMonths(new Date(), 1));
    end = endOfDay(subDays(startOfMonth(new Date()), 1));
    dateText = "last month";
  } else if (/\bthis\s+quarter\b|\bquarter\b/.test(q)) {
    start = startOfQuarter(new Date());
    dateText = "this quarter";
  } else if (/\bytd\b|\bthis\s+year\b/.test(q)) {
    start = startOfYear(new Date());
    dateText = "this year";
  } else {
    const match = q.match(/\blast\s+(\d+)\s+days\b/);
    if (match && match[1]) {
      const days = parseInt(match[1], 10);
      if (Number.isFinite(days) && days > 0) {
        start = startOfDay(subDays(new Date(), days));
        dateText = `last ${days} days`;
      }
    }
  }

  // Consistent Plant Scoping
  const isAllPlants = !plantId || plantId === "ALL";
  const plantWhere = isAllPlants ? {} : { plantId };
  const machinePlantWhere = isAllPlants ? {} : { machine: { plantId } };

  // Fetch settings for dynamic costing
  const settings = await getSettings();

  // 1. OEE / Performance / Efficiency
  if (/\b(oee|performance|efficiency|productivity)\b/.test(q)) {
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
      const logs = m.productionLogs || [];
      const goodQty = logs.reduce((sum, l) => sum + (l.goodQuantity || 0), 0);
      const idealQty = logs.reduce((sum, l) => {
        if (!l.startTime) return sum;
        const endTime = l.endTime ? new Date(l.endTime) : new Date();
        const durationSecs = Math.max(0, (endTime.getTime() - new Date(l.startTime).getTime()) / 1000);
        const cycleTime = Number(m.idealCycleTimeSeconds) || 60;
        return sum + durationSecs / cycleTime;
      }, 0);

      totalIdeal += idealQty;
      totalActual += goodQty;
    });

    const oee = totalIdeal > 0 ? (totalActual / totalIdeal) * 100 : 0;

    return {
      title: `Plant Overall Equipment Effectiveness (OEE) — ${dateText}`,
      lines: [
        `Calculated factory-wide average OEE: **${oee.toFixed(1)}%**`,
        `Aggregated across ${machines.length} active machine centers.`,
      ],
      link: "/ops/floor",
      linkText: "View Live Shopfloor",
    };
  }

  // 2. Profit / Loss / Margins
  if (/\b(profit|loss|margins?|revenue|losing\s+money)\b/.test(q)) {
    const wos = await prisma.workOrder.findMany({
      where: {
        status: "COMPLETED",
        plannedEndDate: { gte: start, lte: end },
        ...plantWhere,
      },
      include: { quotations: true },
    });

    const rows: (string | number)[][] = [];
    wos.forEach((wo) => {
      const rev = Number(wo.quotedPrice) || 0;
      const cost = Number(wo.quotations[0]?.estimatedCost) || (rev > 0 ? rev * 0.8 : 0);
      const margin = rev - cost;
      if (margin < 0) {
        rows.push([
          wo.woNumber,
          `₹${rev.toLocaleString("en-IN")}`,
          `₹${cost.toLocaleString("en-IN")}`,
          `-₹${Math.abs(margin).toLocaleString("en-IN")}`,
        ]);
      }
    });

    return {
      title: `Profit & Margin Analysis (${dateText})`,
      lines: [
        rows.length > 0
          ? `Identified **${rows.length}** completed work orders that operated at negative margins.`
          : "All completed work orders operated at positive gross margins in this time horizon.",
      ],
      table:
        rows.length > 0
          ? {
              headers: ["Work Order", "Revenue", "Estimated Cost", "Net Margin"],
              rows: rows.slice(0, 20),
            }
          : undefined,
      link: "/reports/profitability",
      linkText: "Open Financial Profitability Report",
    };
  }

  // 3. Machine Downtime & Breakdown Cost
  if (/\b(downtime|breakdown|stoppage|idle)\b/.test(q) && /\b(cost|expensive|machine)\b/.test(q)) {
    const logs = await prisma.downtimeLog.findMany({
      where: {
        startTime: { gte: start, lte: end },
        ...machinePlantWhere,
      },
      include: { machine: true, reason: true },
    });

    const machineCosts: Record<string, { name: string; cost: number; minutes: number }> = {};
    const hourlyRate = Number((settings as any).defaultMachineHourlyRate) || 300;

    logs.forEach((l) => {
      const durationMins = Number(l.durationMinutes) || 0;
      const cost = (durationMins / 60) * hourlyRate;
      const mId = l.machineId;

      if (!machineCosts[mId]) {
        machineCosts[mId] = { name: l.machine?.name || "Machine", cost: 0, minutes: 0 };
      }
      machineCosts[mId].cost += cost;
      machineCosts[mId].minutes += durationMins;
    });

    const sorted = Object.values(machineCosts).sort((a, b) => b.cost - a.cost);

    return {
      title: `Machine Downtime Financial Impact (${dateText})`,
      lines: [
        sorted.length > 0
          ? `Top downtime cost center: **${sorted[0].name}** (₹${Math.round(sorted[0].cost).toLocaleString("en-IN")})`
          : "Zero unallocated machine downtime logs recorded in this period.",
      ],
      table:
        sorted.length > 0
          ? {
              headers: ["Machine", "Lost Time (Mins)", "Financial Impact"],
              rows: sorted.slice(0, 15).map((m) => [m.name, `${m.minutes} mins`, `₹${Math.round(m.cost).toLocaleString("en-IN")}`]),
            }
          : undefined,
      link: "/reports/downtime",
      linkText: "View Downtime Analysis",
    };
  }

  // 4. Receivables & Payments
  if (/\b(receivables?|unpaid|invoices?|payments?|debts?)\b/.test(q)) {
    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ["UNPAID", "PARTIAL"] },
        ...plantWhere,
      },
    });

    let totalOwed = 0;
    const rows: (string | number)[][] = [];

    invoices.forEach((inv) => {
      const owed = (inv.totalValue || 0) - (inv.paidAmount || 0);
      totalOwed += owed;
      const daysOverdue = inv.dueDate
        ? Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 3600 * 24))
        : 0;

      rows.push([
        inv.invoiceNumber,
        inv.customerName || "Client",
        `₹${owed.toLocaleString("en-IN")}`,
        daysOverdue > 0 ? `${daysOverdue} days` : "Current",
      ]);
    });

    return {
      title: "Accounts Receivable & Overdue Balances",
      lines: [
        `Identified **${invoices.length}** open invoices totaling **₹${totalOwed.toLocaleString("en-IN")}**.`,
      ],
      table:
        rows.length > 0
          ? {
              headers: ["Invoice #", "Customer", "Pending Amount", "Overdue Status"],
              rows: rows.slice(0, 15),
            }
          : undefined,
      link: "/reports/receivables",
      linkText: "View A/R Ledger",
    };
  }

  // 5. Energy Consumption
  if (/\b(energy|electricity|power|kwh)\b/.test(q)) {
    const readings = await prisma.energyReading.findMany({
      where: { date: { gte: start, lte: end } },
    });

    const totalCost = readings.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    const totalKwh = readings.reduce((sum, r) => sum + (r.totalKwh || 0), 0);

    return {
      title: `Factory Energy Consumption (${dateText})`,
      lines: [
        `Total electricity tariff cost: **₹${totalCost.toLocaleString("en-IN")}**`,
        `Total active power consumed: **${totalKwh.toLocaleString("en-IN")} kWh**`,
      ],
      link: "/maintenance/utilities",
      linkText: "View Power & Utilities",
    };
  }

  // 6. Quality / Scrap
  if (/\b(scrap|defects?|ncr|rejections?|ppm)\b/.test(q)) {
    const logs = await prisma.productionLog.findMany({
      where: {
        startTime: { gte: start, lte: end },
        ...machinePlantWhere,
      },
    });

    let good = 0;
    let scrap = 0;
    logs.forEach((l) => {
      good += l.goodQuantity || 0;
      scrap += l.scrapQuantity || 0;
    });

    const scrapPct = good + scrap > 0 ? (scrap / (good + scrap)) * 100 : 0;

    return {
      title: `Quality Conformance & Scrap Rate (${dateText})`,
      lines: [
        `Total Non-Conforming Scrap: **${scrap.toLocaleString("en-IN")} units**`,
        `Shopfloor scrap proportion: **${scrapPct.toFixed(2)}%**`,
      ],
      link: "/quality/escalations",
      linkText: "Open Quality Sentinel",
    };
  }

  // Fallback Assistant Guide
  return {
    title: "Aura Factory Intelligence Assistant",
    lines: [
      "I can analyze factory metrics across all plant operations. Try asking:",
      "- *What is our OEE this week?*",
      "- *Which work orders lost money this month?*",
      "- *Show costliest machine downtimes.*",
      "- *What are our outstanding receivables?*",
      "- *How much energy did we consume this quarter?*",
      "- *What is our scrap rate today?*",
    ],
  };
}
