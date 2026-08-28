import { NextRequest, NextResponse } from "next/server";

export interface AgentActionStep {
  stepIndex: number;
  thought: string;
  tool: string;
  toolInput: Record<string, any>;
  observation: string;
  status: "success" | "warning" | "error";
  latencyMs: number;
}

export interface AgentMissionResult {
  missionId: string;
  agentId: string;
  agentName: string;
  goal: string;
  status: "COMPLETED" | "FAILED" | "IN_PROGRESS";
  totalDurationMs: number;
  steps: AgentActionStep[];
  finalOutcome: string;
  kpisAffected: { label: string; value: string; change: string }[];
}

export const AGENT_REGISTRY = [
  {
    id: "agent-maintenance",
    name: "Spindle & Bearing Diagnostics Agent",
    role: "Predictive Maintenance & Reliability",
    description:
      "Autonomously correlates vibration RMS, thermal trends, and Weibull degradation curves to schedule pre-emptive PM orders before catastrophic mechanical seizure.",
    status: "STANDBY",
    avatarIcon: "Wrench",
    model: "Gemini 1.5 Pro (Industrial Domain Tuned)",
    tools: [
      "read_machine_telemetry",
      "calculate_weibull_rul",
      "query_spare_inventory",
      "dispatch_work_order",
    ],
    sampleMissions: [
      "Diagnose CNC-02 spindle thermal spike and generate pre-emptive overhaul order",
      "Audit 5-axis DMG Mori vibration harmonics for tool wear compensation",
    ],
  },
  {
    id: "agent-procurement",
    name: "Autonomous SCM Procurement Agent",
    role: "Supply Chain & Materials Replenishment",
    description:
      "Evaluates BOM explosion demands against current stock and active supplier lead times to issue automated purchase requisitions and vendor RFQs.",
    status: "STANDBY",
    avatarIcon: "Boxes",
    model: "Gemini 1.5 Pro (Supply Chain Logistics)",
    tools: [
      "inspect_stock_levels",
      "explode_bom_demand",
      "query_vendor_catalog",
      "generate_purchase_order",
    ],
    sampleMissions: [
      "Replenish Inconel 718 aerospace alloy billets to prevent Line 3 production halt",
      "Rebalance cutting insert tool inventory across Tool Crib A and Crib B",
    ],
  },
  {
    id: "agent-quality",
    name: "AS9102 Aerospace Quality Agent",
    role: "Compliance & 360° Genealogy",
    description:
      "Validates raw material melt lot chemical compositions, CMM characteristic dimensions (Form 3 FAI), and generates digital Certificates of Conformance.",
    status: "STANDBY",
    avatarIcon: "ShieldCheck",
    model: "Gemini 1.5 Pro (Aerospace Quality Assurance)",
    tools: [
      "audit_heat_lot_genealogy",
      "validate_cmm_tolerances",
      "check_subcontractor_challan",
      "issue_coc_certificate",
    ],
    sampleMissions: [
      "Perform AS9102 Rev C First Article Inspection on Titanium Turbine Blade Lot #TB-902",
      "Audit raw material chemical composition test certs for Salem Steel Heat #HT-7841",
    ],
  },
  {
    id: "agent-energy",
    name: "Plant Energy & Tariff Optimizer",
    role: "Sustainability & Peak Demand Shaving",
    description:
      "Monitors smart energy sub-meters, clamps idle machine power draw, and orchestrates energy-intensive roughing passes into lower-tariff night windows.",
    status: "STANDBY",
    avatarIcon: "Zap",
    model: "Gemini 1.5 Flash (Real-Time Energy Telemetry)",
    tools: [
      "read_energy_meters",
      "optimize_tariff_schedule",
      "clamp_idle_spindles",
      "calculate_carbon_metrics",
    ],
    sampleMissions: [
      "Shift 12 heavy roughing cycles on Mazak VCN to off-peak tariff window (22:00-06:00)",
      "Detect standby pneumatic air leaks and idle spindle waste on Line 1",
    ],
  },
];

export async function GET() {
  return NextResponse.json({
    status: "ok",
    agents: AGENT_REGISTRY,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agentId, goal } = body;

    const agent =
      AGENT_REGISTRY.find((a) => a.id === agentId) || AGENT_REGISTRY[0];

    // Generate specialized autonomous step traces based on agent type
    let steps: AgentActionStep[] = [];
    let finalOutcome = "";
    let kpisAffected = [];

    if (agent.id === "agent-maintenance") {
      steps = [
        {
          stepIndex: 1,
          thought: `I need to query live sensor telemetry on the designated machine to inspect vibration RMS and bearing thermal trends.`,
          tool: "read_machine_telemetry",
          toolInput: {
            machineId: "CNC-02",
            sampleWindow: "24h",
            metrics: ["vibration_rms", "bearing_temp"],
          },
          observation: `Machine CNC-02 reported vibration RMS of 4.82 mm/s (Warning Threshold: 4.5 mm/s) and bearing temp of 48.6°C (+12°C above baseline).`,
          status: "warning",
          latencyMs: 142,
        },
        {
          stepIndex: 2,
          thought: `The vibration and thermal trends indicate bearing cage micro-fracturing. I will execute Weibull degradation analysis to determine Remaining Useful Life (RUL).`,
          tool: "calculate_weibull_rul",
          toolInput: {
            machineId: "CNC-02",
            failureMode: "spindle_bearing_fatigue",
            confidenceInterval: 0.95,
          },
          observation: `Weibull shape parameter β=2.84 (wear-out phase). Estimated RUL is 38.5 operating hours before catastrophic spindle seizure.`,
          status: "success",
          latencyMs: 215,
        },
        {
          stepIndex: 3,
          thought: `We have 38.5 hours remaining. Let me query spare parts inventory in ERP for SKF 7014 Angular Contact Bearings.`,
          tool: "query_spare_inventory",
          toolInput: { partNumber: "SKF-7014-ACD-P4A", requiredQty: 2 },
          observation: `SKF-7014-ACD-P4A: 4 units currently in stock at Bin M-04 (Warehouse 1). Status: Available immediately.`,
          status: "success",
          latencyMs: 98,
        },
        {
          stepIndex: 4,
          thought: `Spare parts are in stock. I will dispatch an autonomous Priority 1 Maintenance Work Order and reserve the bearings.`,
          tool: "dispatch_work_order",
          toolInput: {
            machineId: "CNC-02",
            type: "PREDICTIVE_REPLACEMENT",
            priority: "URGENT",
            allocatedParts: ["SKF-7014-ACD-P4A x 2"],
            scheduledWindow: "Today 16:00 - 18:30 (Shift 2 Changeover)",
          },
          observation: `Work Order WO-MNT-2026-0884 successfully created. Assigned to Lead Maintenance Technician. Bearings allocated.`,
          status: "success",
          latencyMs: 180,
        },
      ];
      finalOutcome = `Autonomous mission complete. Detected early spindle bearing fatigue on CNC-02 (38.5 hrs RUL remaining). Automatically allocated 2x SKF-7014 bearings from Warehouse 1 and dispatched Work Order WO-MNT-2026-0884 for Shift 2 changeover. Estimated downtime avoided: 18.5 hours ($4,625).`;
      kpisAffected = [
        {
          label: "Unplanned Downtime Avoided",
          value: "18.5 hrs",
          change: "-100%",
        },
        { label: "Estimated Savings", value: "$4,625", change: "+100%" },
        { label: "Machine Health Index", value: "98.2%", change: "+14.5%" },
      ];
    } else if (agent.id === "agent-procurement") {
      steps = [
        {
          stepIndex: 1,
          thought: `I will analyze on-hand stock vs minimum safety buffer levels for active production work orders.`,
          tool: "inspect_stock_levels",
          toolInput: { category: "RAW_AEROSPACE_ALLOY", safetyBufferDays: 14 },
          observation: `Inconel 718 Bar Stock (Dia 65mm): On-hand 82 kg. Minimum safety threshold is 250 kg. Stock deficit: 168 kg.`,
          status: "warning",
          latencyMs: 110,
        },
        {
          stepIndex: 2,
          thought: `I must explode active BOMs for Turbine Casing assembly WO-8921 to calculate exact net demand over the next 10 production days.`,
          tool: "explode_bom_demand",
          toolInput: {
            workOrderId: "WO-8921",
            assembly: "TURBINE_CASING_REV_D",
          },
          observation: `Net raw material requirement: 320 kg required by Day 6. Impending stockout in 3.2 days if not ordered today.`,
          status: "warning",
          latencyMs: 165,
        },
        {
          stepIndex: 3,
          thought: `I will query pre-approved aerospace material vendors (MIDHANI, Salem Special Steels, Carpenter Tech) for live pricing and expedited lead time.`,
          tool: "query_vendor_catalog",
          toolInput: {
            materialSpec: "AMS-5662 Inconel 718",
            requiredQtyKg: 400,
          },
          observation: `Vendor MIDHANI: $68.50/kg, Lead Time 48h (Air Express). Vendor Carpenter: $71.20/kg, Lead Time 72h. MIDHANI selected as optimal.`,
          status: "success",
          latencyMs: 230,
        },
        {
          stepIndex: 4,
          thought: `I will generate Purchase Order PO-SCM-2026-0419 to MIDHANI for 400 kg AMS-5662 Inconel 718 with mandatory AS9100 mill cert requirement.`,
          tool: "generate_purchase_order",
          toolInput: {
            vendor: "MIDHANI Hyderabad",
            items: [
              {
                spec: "AMS-5662 Inconel 718 Dia 65mm",
                qtyKg: 400,
                unitPrice: 68.5,
              },
            ],
            totalCost: 27400,
            deliveryDeadline: "48h Expedited",
            requiredCertificates: [
              "EN 10204 3.1",
              "Chemical & Tensile Test Report",
            ],
          },
          observation: `Purchase Order PO-SCM-2026-0419 issued and transmitted via EDI. Electronic confirmation received.`,
          status: "success",
          latencyMs: 195,
        },
      ];
      finalOutcome = `Autonomous mission complete. Prevented impending raw material stockout on Turbine Casing line. Auto-evaluated vendor quotes and issued PO-SCM-2026-0419 to MIDHANI for 400 kg Inconel 718 ($27,400) with 48h air delivery and EN 10204 3.1 certification.`;
      kpisAffected = [
        { label: "Line Stoppage Avoided", value: "3.5 days", change: "-100%" },
        { label: "Procurement Lead Time", value: "48 hrs", change: "-60%" },
        {
          label: "Price Variance vs Budget",
          value: "-3.8%",
          change: "Favorable",
        },
      ];
    } else if (agent.id === "agent-quality") {
      steps = [
        {
          stepIndex: 1,
          thought: `I will audit the chemical and mechanical test certs for raw material melt heat lot #HT-7841 against aerospace AMS-4928 spec.`,
          tool: "audit_heat_lot_genealogy",
          toolInput: {
            heatNumber: "HT-7841",
            alloy: "Ti-6Al-4V Grade 5",
            targetSpec: "AMS-4928",
          },
          observation: `Tensile Strength: 985 MPa (Min 895 MPa - PASS). Elongation: 14.2% (Min 10% - PASS). Hydrogen Content: 85 ppm (Max 125 ppm - PASS).`,
          status: "success",
          latencyMs: 135,
        },
        {
          stepIndex: 2,
          thought: `Now inspecting Zeiss CMM coordinate measurement data for 32 characteristic dimensions on First Article Batch #FA-092.`,
          tool: "validate_cmm_tolerances",
          toolInput: {
            batchId: "FA-092",
            partNumber: "AERO-BRKT-902",
            cmmDataset: "ZEISS_PRISMO_RUN_4",
          },
          observation: `32/32 dimensions within ±0.008mm drawing tolerance. Critical hole true position: ⌀0.012mm (Tolerance ⌀0.025mm - PASS). CpK = 1.84.`,
          status: "success",
          latencyMs: 290,
        },
        {
          stepIndex: 3,
          thought: `Verifying subcontracting surface treatment Delivery Challan and Nadcap passivation certificate.`,
          tool: "check_subcontractor_challan",
          toolInput: {
            challanId: "DC-2026-0042",
            process: "AMS-2700 Method 1 Type II Passivation",
            vendor: "SurTech Nadcap",
          },
          observation: `Nadcap Certificate #ND-8891 valid through Dec 2027. Salt spray corrosion test (336 hrs) passed with 0 pitting.`,
          status: "success",
          latencyMs: 140,
        },
        {
          stepIndex: 4,
          thought: `All 3 AS9102 FAI Forms (1, 2, 3) are satisfied. Digitally signing Certificate of Conformance CoC-2026-0912 with cryptographic QA signature.`,
          tool: "issue_coc_certificate",
          toolInput: {
            partNumber: "AERO-BRKT-902",
            batchQty: 25,
            faiRev: "AS9102 Rev C",
            qaSignatureHash: "0x9a8f23b901ec...SIGNED",
          },
          observation: `Certificate of Conformance CoC-2026-0912 issued and synced to Customer Compliance Portal.`,
          status: "success",
          latencyMs: 175,
        },
      ];
      finalOutcome = `Autonomous mission complete. Full AS9102 Rev C First Article verification passed for Batch #FA-092. Verified Ti-6Al-4V heat certs, 32 CMM tolerances (CpK 1.84), Nadcap passivation, and digitally sealed CoC-2026-0912. Batch approved for immediate aerospace delivery.`;
      kpisAffected = [
        { label: "AS9102 FAI Pass Rate", value: "100%", change: "+0.4%" },
        { label: "Process Capability (CpK)", value: "1.84", change: "+0.22" },
        { label: "QA Audit Cycle Time", value: "4.2 mins", change: "-85%" },
      ];
    } else {
      // Energy agent
      steps = [
        {
          stepIndex: 1,
          thought: `I will read real-time smart power meter telemetry across all 8 machining workcells to identify standby power leaks.`,
          tool: "read_energy_meters",
          toolInput: {
            subMeters: ["MTR-LINE-1", "MTR-LINE-2", "MTR-LINE-3"],
            windowMinutes: 60,
          },
          observation: `Line 1 Workcells idling at 14.8 kW aggregate idle draw (hydraulic coolers and spindle chiller running continuously with no active job).`,
          status: "warning",
          latencyMs: 120,
        },
        {
          stepIndex: 2,
          thought: `I will execute an automated PLC sleep command to clamp auxiliary hydraulic pump and chiller idle power on Mazak VCN-01.`,
          tool: "clamp_idle_spindles",
          toolInput: {
            machineId: "CNC-01",
            targetState: "ECO_STANDBY",
            rampDownTimeSec: 15,
          },
          observation: `Idle draw reduced from 14.8 kW to 1.2 kW. Baseline power savings: 13.6 kW/hr.`,
          status: "success",
          latencyMs: 190,
        },
        {
          stepIndex: 3,
          thought: `Evaluating tomorrow's state grid tariff structure (Peak: $0.18/kWh 14:00-18:00 vs Off-Peak: $0.06/kWh 22:00-06:00).`,
          tool: "optimize_tariff_schedule",
          toolInput: {
            heavyJobs: [
              "WO-9012 (Heavy Inconel Milling)",
              "WO-9015 (Titanium Hogout)",
            ],
          },
          observation: `Shifted 6.5 hours of high-torque roughing passes from 15:00 peak slot to 23:00 off-peak night slot. Estimated tariff savings: $148.20/day.`,
          status: "success",
          latencyMs: 155,
        },
        {
          stepIndex: 4,
          thought: `Calculating cumulative daily Scope 2 carbon emissions reduction.`,
          tool: "calculate_carbon_metrics",
          toolInput: { totalKwhSaved: 215, gridEmissionFactorKgPerKwh: 0.72 },
          observation: `Daily CO₂ emissions reduced by 154.8 kg CO₂e. Monthly projected carbon abatement: 4.64 metric tons.`,
          status: "success",
          latencyMs: 95,
        },
      ];
      finalOutcome = `Autonomous mission complete. Clamped 13.6 kW/hr idle standby waste on Line 1 and rescheduled 6.5 hours of heavy roughing cycles to off-peak tariff window. Generated 215 kWh daily energy savings ($4,446/mo) and abated 4.64 tons CO₂e.`;
      kpisAffected = [
        { label: "Daily Energy Saved", value: "215 kWh", change: "+18.4%" },
        {
          label: "Electricity Cost Savings",
          value: "$4,446 / mo",
          change: "-28.2%",
        },
        { label: "Carbon Abatement", value: "4.64 tons CO₂", change: "+100%" },
      ];
    }

    const totalDurationMs =
      steps.reduce((acc, s) => acc + s.latencyMs, 0) + 350;

    const missionResult: AgentMissionResult = {
      missionId: `MSN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      agentId: agent.id,
      agentName: agent.name,
      goal: goal || agent.sampleMissions[0],
      status: "COMPLETED",
      totalDurationMs,
      steps,
      finalOutcome,
      kpisAffected,
    };

    return NextResponse.json({
      status: "ok",
      mission: missionResult,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 500 },
    );
  }
}
