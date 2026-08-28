import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const [machinesCount, workOrdersCount] = await Promise.all([
    prisma.machine.count({ where: { isActive: true } }),
    prisma.workOrder.count({
      where: { status: { in: ["PLANNED", "IN_PROGRESS", "COMPLETED"] } },
    }),
  ]);

  const executiveReport = {
    reportTitle:
      "Apex Aerospace Manufacturing — Executive Monthly Performance Briefing",
    reportingPeriod: "August 2026",
    generatedAt: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    executiveSummary:
      "Plant 1 achieved an overall equipment effectiveness (OEE) of 87.4% with zero critical safety incidents. Aerospace AS9102 First Article Inspection compliance stands at 99.6% across all aerospace work orders. Predictive maintenance algorithms successfully prevented 36 hours of catastrophic spindle downtime on CNC-02.",
    keyMetrics: [
      {
        label: "Gross Revenue Realized",
        value: "$1,420,000",
        target: "$1,500,000",
        change: "+12.4% MoM",
        status: "ON_TRACK",
      },
      {
        label: "Composite Plant OEE",
        value: "87.4%",
        target: "85.0%",
        change: "+2.4% vs target",
        status: "EXCEEDED",
      },
      {
        label: "AS9102 Quality Yield",
        value: "99.6%",
        target: "99.0%",
        change: "+0.6% vs target",
        status: "EXCEEDED",
      },
      {
        label: "Scrap & Defect Cost",
        value: "1.4%",
        target: "< 2.0%",
        change: "-0.4% reduction",
        status: "EXCEEDED",
      },
      {
        label: "Predictive Downtime Saved",
        value: "36 hrs",
        target: "> 20 hrs",
        change: "$72,000 Saved",
        status: "EXCEEDED",
      },
      {
        label: "OTIF Customer Delivery",
        value: "98.4%",
        target: "98.0%",
        change: "On-time flight spares",
        status: "ON_TRACK",
      },
    ],
    marginWaterfall: [
      { stage: "Gross Billing Revenue", amount: 1420000, pct: 100 },
      {
        stage: "Direct Raw Materials (Ti-6Al-4V)",
        amount: -480000,
        pct: -33.8,
      },
      { stage: "CNC Machining Power & Labor", amount: -290000, pct: -20.4 },
      { stage: "Carbide Tooling & Inserts", amount: -85000, pct: -6.0 },
      { stage: "Subcontracting & Anodizing", amount: -65000, pct: -4.6 },
      { stage: "Net Plant Contribution Margin", amount: 500000, pct: 35.2 },
    ],
    departmentScorecard: [
      {
        department: "Production & MES",
        health: "94%",
        owner: "PPC Head",
        status: "GREEN",
        highlight: `${workOrdersCount} Work Orders processed with 145s average cycle time.`,
      },
      {
        department: "Quality (QA/QC)",
        health: "99%",
        owner: "Quality Director",
        status: "GREEN",
        highlight:
          "AS9102 FAI ballooning fully digitalized with 0 customer escapes.",
      },
      {
        department: "Maintenance & Reliability",
        health: "91%",
        owner: "Plant Engineer",
        status: "GREEN",
        highlight: `${machinesCount} machines monitored via ISO 10816 vibration IoT sensors.`,
      },
      {
        department: "Supply Chain & Logistics",
        health: "88%",
        owner: "SCM Head",
        status: "YELLOW",
        highlight:
          "Titanium mill lead times stabilizing; MRP auto-requisitions live.",
      },
    ],
  };

  return NextResponse.json(executiveReport);
}
