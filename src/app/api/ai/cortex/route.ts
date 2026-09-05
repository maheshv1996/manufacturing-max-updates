import { logAudit } from "@/lib/audit";
﻿import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AGENT_REGISTRY } from "../agents/route";

export const dynamic = "force-dynamic";

export interface ConflictScenario {
  id: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  departmentsInvolved: string[];
  description: string;
  options: {
    label: string;
    description: string;
    impactOee: string;
    impactCost: string;
    impactDelivery: string;
    agentRecommendation?: boolean;
    reasoning: string;
  }[];
}

export const SAMPLE_CONFLICTS: ConflictScenario[] = [
  {
    id: "conflict-rush-turbine",
    title: "Urgent 500-pc Aerospace Rush Order vs Line 1 Capacity Overload",
    severity: "CRITICAL",
    departmentsInvolved: ["Sales", "Production", "Supply Chain", "Quality"],
    description:
      "Sales committed delivery of 500x Titanium Turbine Blades in 5 days ($125,000 order). Line 1 5-Axis Mazak is already at 104% load, and on-hand Titanium 6Al-4V stock is 120 kg short.",
    options: [
      {
        label: "Master Brain Autonomous Orchestration (Recommended)",
        description:
          "Re-route 200 non-critical valve bodies to Line 2 (DMG Mori), issue expedited 24h air shipment for 150 kg Titanium from MIDHANI, and schedule Shift 2 overtime for certified Level-3 machinists.",
        impactOee: "+4.2%",
        impactCost: "+$1,850 (Expedited Freight)",
        impactDelivery: "100% On-Time ($125K Secured)",
        agentRecommendation: true,
        reasoning:
          "Preserves high-margin aerospace customer relationship while keeping shopfloor OEE balanced without breaching other client SLAs.",
      },
      {
        label: "Reject Rush Order & Maintain Current Schedule",
        description:
          "Refuse the expedited 5-day delivery window and offer standard 14-day lead time. Maintain current Line 1 schedule unchanged.",
        impactOee: "0.0%",
        impactCost: "$0 Extra",
        impactDelivery: "Lose $125K Rush Order",
        reasoning:
          "Zero shopfloor disruption, but forfeits high-margin revenue and risks customer churn to competitor.",
      },
      {
        label: "Halt All Active Jobs on Line 1 for Rush Order",
        description:
          "Prematurely stop active production on 3 other work orders to dedicate 100% of Line 1 capacity to the rush order.",
        impactOee: "-8.5%",
        impactCost: "+$6,400 (Downtime & Changeover)",
        impactDelivery: "3 Other Orders Slipped by 4 Days",
        reasoning:
          "Secures rush order, but triggers delivery penalty clauses and customer complaints on existing active contracts.",
      },
    ],
  },
  {
    id: "conflict-spindle-bearing",
    title: "Vibration Spindle Degradation vs High-Value Inconel Roughing Pass",
    severity: "HIGH",
    departmentsInvolved: ["Maintenance", "Production", "Finance"],
    description:
      "CNC-02 spindle bearing vibration RMS spiked to 4.82 mm/s (38.5 hrs RUL). A high-torque $45,000 Inconel Impeller job is scheduled to run on it today for 16 hours.",
    options: [
      {
        label: "Pre-emptive Overhaul in Shift 2 Window (Recommended)",
        description:
          "Clamp spindle feed-rate by 15% for the next 3 hours to protect tool geometry, then execute scheduled bearing overhaul during Shift 2 changeover (16:00-18:30) using allocated warehouse stock.",
        impactOee: "+6.8% (Prevents Seizure)",
        impactCost: "$820 (Planned PM)",
        impactDelivery: "On-Time (+1.5h shift catchup)",
        agentRecommendation: true,
        reasoning:
          "Prevents catastrophic $28,000 spindle replacement and 48-hour unplanned line stoppage while keeping the impeller batch on schedule.",
      },
      {
        label: "Run to Failure at Full Feed-Rate",
        description:
          "Do not interrupt the Inconel job. Run CNC-02 at 100% feed-rate and replace bearings only after mechanical failure.",
        impactOee: "-22.4%",
        impactCost: "$28,500 (Spindle Rebuild)",
        impactDelivery: "Line Down for 4 Days",
        reasoning:
          "High probability of catastrophic tool breakage, scrapped $45K Inconel casting, and emergency spindle replacement.",
      },
    ],
  },
];

export async function GET() {
  try {
    const [machines, workOrders, usersCount] = await Promise.all([
      prisma.machine.findMany({ select: { id: true, code: true, name: true, status: true } }),
      prisma.workOrder.findMany({ where: { status: "IN_PROGRESS" } }),
      prisma.user.count(),
    ]);

    return NextResponse.json({
      status: "ok",
      cortexState: {
        activeAgentsCount: AGENT_REGISTRY.length,
        systemHealth: "OPTIMAL",
        neuralLoad: "14.2%",
        agents: AGENT_REGISTRY,
        conflicts: SAMPLE_CONFLICTS,
        onlineMachinesCount: machines.filter((m) => m.status === "RUNNING").length,
        totalMachinesCount: machines.length,
        activeWorkOrdersCount: workOrders.length,
        totalUsersCount: usersCount,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action, payload } = body;

    if (action === "resolve_conflict") {
      const { conflictId, optionIndex } = payload || {};
      const conflict = SAMPLE_CONFLICTS.find((c) => c.id === conflictId) || SAMPLE_CONFLICTS[0];
      const selectedOption = conflict.options[optionIndex] || conflict.options[0];

      await logAudit({
        actor: "system",
        action: "AI_CORTEX_CONFLICT_RESOLVED",
        entityType: "AiCortex",
        entityId: conflictId,
        details: `Resolved conflict ${conflictId}: ${selectedOption.label}`,
      });

      return NextResponse.json({
        status: "ok",
        resolution: {
          conflictId,
          executedAt: new Date().toISOString(),
          decision: selectedOption.label,
          outcome: selectedOption.description,
          impactSummary: {
            oee: selectedOption.impactOee,
            cost: selectedOption.impactCost,
            delivery: selectedOption.impactDelivery,
          },
          telemetryDispatches: [
            { agent: "Line Balancer", action: "Dynamic queue re-routed on CNC-04" },
            { agent: "SCM Procurement", action: "PO-SCM-2026-0419 issued for 150 kg Titanium 6Al-4V" },
            { agent: "Skills Matcher", action: "Shift 2 Level-3 Machinist M. Sharma assigned" },
          ],
        },
      });
    }

    if (action === "simulate_what_if") {
      const { addMachines = 0, addShifts = 0, rawMaterialPriceHikePct = 0, nightTariffShiftHours = 0 } = payload;

      const baseMonthlyRevenue = 485000;
      const baseMonthlyCost = 315000;

      const capacityMultiplier = 1 + (addMachines * 0.18) + (addShifts * 0.42);
      const simulatedRevenue = Math.round(baseMonthlyRevenue * capacityMultiplier);
      const simulatedCost = Math.round(
        (baseMonthlyCost * capacityMultiplier * (1 + (rawMaterialPriceHikePct / 100) * 0.35)) -
        (nightTariffShiftHours * 148 * 26)
      );
      const simulatedProfit = simulatedRevenue - simulatedCost;
      const baseProfit = baseMonthlyRevenue - baseMonthlyCost;
      const profitDelta = simulatedProfit - baseProfit;
      const simulatedOee = Math.min(94.5, 87.4 + (addShifts > 0 ? 3.2 : 0) + (addMachines > 0 ? 1.8 : 0));

      return NextResponse.json({
        status: "ok",
        simulation: {
          parameters: payload,
          forecast: {
            monthlyRevenue: simulatedRevenue,
            monthlyCost: simulatedCost,
            monthlyProfit: simulatedProfit,
            profitDelta,
            projectedOee: `${simulatedOee.toFixed(1)}%`,
            annualizedRoiGained: profitDelta * 12,
            paybackMonths: addMachines > 0 ? Number(((addMachines * 180000) / Math.max(1, profitDelta)).toFixed(1)) : 0,
          },
          strategicInsights: [
            addMachines > 0 ? `Adding ${addMachines} CNC machining centers unlocks +$${(simulatedRevenue - baseMonthlyRevenue).toLocaleString()}/mo in untapped aerospace contracts.` : null,
            addShifts > 0 ? `Activating Shift ${2 + addShifts} spreads fixed overhead across 42% more machine hours.` : null,
            nightTariffShiftHours > 0 ? `Shifting ${nightTariffShiftHours}h/day to night tariff saves $${(nightTariffShiftHours * 148 * 26).toLocaleString()}/mo in utility costs.` : null,
          ].filter(Boolean),
        },
      });
    }

    return NextResponse.json({ status: "error", message: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}
