import { logAudit } from "@/lib/audit";
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
    department: "Maintenance",
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
    department: "Supply Chain",
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
    department: "Quality",
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
    department: "EHS & Utilities",
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
  {
    id: "agent-production",
    name: "Line Balancer & Production Scheduler",
    role: "Autonomous Shopfloor Dispatching",
    department: "Production",
    description:
      "Dynamically levels production queues across 3-axis and 5-axis CNC machining centers when unexpected machine stoppages or rush orders occur.",
    status: "STANDBY",
    avatarIcon: "Layers",
    model: "Gemini 1.5 Pro (Finite Capacity Scheduling)",
    tools: [
      "evaluate_cell_load",
      "simulate_routing_alternatives",
      "reassign_work_orders",
      "update_shopfloor_andon",
    ],
    sampleMissions: [
      "Re-route 4 overdue Turbine Disc batches around offline VMC-03 to Mazak 5-Axis cell",
      "Balance spindle utilization across Cell 1 and Cell 2 for Shift 2",
    ],
  },
  {
    id: "agent-sales",
    name: "Generative DFM & 3D CAD Quoter",
    role: "Sales Engineering & Cost Estimation",
    department: "Sales & Engineering",
    description:
      "Ingests technical CAD files, calculates raw billet envelope dimensions, tool access limitations, and generates instant precision machining quotes.",
    status: "STANDBY",
    avatarIcon: "TrendingUp",
    model: "Gemini 1.5 Pro (Design for Manufacturability)",
    tools: [
      "analyze_part_geometry",
      "estimate_machining_time",
      "calculate_material_yield",
      "generate_sales_quote",
    ],
    sampleMissions: [
      "Generate rapid precision quote for 150x Aerospace Valve Bodies in Titanium 6Al-4V",
      "Analyze deep pocket cavity for 5-axis tool clearance and flag high-risk radii",
    ],
  },
  {
    id: "agent-finance",
    name: "Activity-Based Job Costing Guardian",
    role: "Finance & Margin Protection",
    department: "Finance",
    description:
      "Calculates live job margins by aggregating direct spindle power, tooling depreciation, operator cycle times, and scrap variance in real-time.",
    status: "STANDBY",
    avatarIcon: "DollarSign",
    model: "Gemini 1.5 Flash (Industrial Financial Modeling)",
    tools: [
      "aggregate_job_costs",
      "detect_scrap_margin_drift",
      "audit_wip_valuation",
      "flag_unprofitable_skus",
    ],
    sampleMissions: [
      "Audit true margin for Impeller Lot #IMP-4412 against quoted target profit of 28%",
      "Reconcile monthly WIP inventory valuation against standard cost absorption model",
    ],
  },
  {
    id: "agent-safety",
    name: "Zero-Harm EHS Sentinel",
    role: "Safety, Health & Statutory Compliance",
    department: "EHS & Safety",
    description:
      "Monitors machine interlocking safety curtains, logs near-miss reports, and tracks statutory fire extinguisher, crane, and pressure vessel inspections.",
    status: "STANDBY",
    avatarIcon: "HeartPulse",
    model: "Gemini 1.5 Flash (OSHA & ISO 45001 Compliance)",
    tools: [
      "audit_safety_interlocks",
      "log_near_miss_incident",
      "check_statutory_due_dates",
      "issue_ehs_corrective_action",
    ],
    sampleMissions: [
      "Audit EOT Crane & Wire Rope load-test calibration certificates across Bays 1-4",
      "Investigate coolant mist ventilation flow rate and flag filter replacement",
    ],
  },
  {
    id: "agent-hr",
    name: "Skills Matrix & Shift Matcher",
    role: "People Operations & Competency",
    department: "HR & People",
    description:
      "Matches operators to high-precision aerospace jobs based on validated skill matrix certifications, biometric shift attendance, and fatigue safety thresholds.",
    status: "STANDBY",
    avatarIcon: "Users",
    model: "Gemini 1.5 Flash (Workforce Planning)",
    tools: [
      "query_skill_matrix",
      "verify_operator_certification",
      "balance_shift_roster",
      "assign_operator_to_machine",
    ],
    sampleMissions: [
      "Assign Level 3 certified 5-axis machinists to high-nickel Inconel impeller jobs",
      "Audit welder ASME Section IX certification expiry dates for Q4",
    ],
  },
  {
    id: "agent-tooling",
    name: "Tool Wear & Metrology Calibration Agent",
    role: "Tool Crib & Metrology Lab",
    department: "Metrology & Tooling",
    description:
      "Tracks cutting insert flank wear, manages regrind cycles, and locks expired verniers, micrometers, and plug gauges from being issued to shopfloor travelers.",
    status: "STANDBY",
    avatarIcon: "Gauge",
    model: "Gemini 1.5 Flash (Metrology & Tooling Life)",
    tools: [
      "inspect_gauge_calibration",
      "track_insert_flank_wear",
      "lock_expired_tools",
      "order_tool_regrinds",
    ],
    sampleMissions: [
      "Lock 3x Mitutoyo Bore Gauges with calibration expired past 30-day grace period",
      "Calculate optimal regrind batch for solid carbide end mills in Tool Crib A",
    ],
  },
  {
    id: "agent-cam",
    name: "G-Code & Feed-Rate CAM Optimizer",
    role: "CNC Optimization & Toolpath Efficiency",
    department: "Engineering",
    description:
      "Simulates NC toolpaths to detect air cuts, minimizes rapid traverse dwell time, and dynamically optimizes chip load to reduce cycle times by up to 18%.",
    status: "STANDBY",
    avatarIcon: "Terminal",
    model: "Gemini 1.5 Pro (CAM & G-Code Kinematics)",
    tools: [
      "parse_gcode_toolpath",
      "optimize_feed_and_speed",
      "eliminate_air_cuts",
      "publish_optimized_nc",
    ],
    sampleMissions: [
      "Optimize DMG Mori 5-axis titanium roughing program to cut 12 minutes per cycle",
      "Detect spindle overload spikes in high-feed trochoidal milling routine",
    ],
  },
  {
    id: "agent-subcontract",
    name: "Subcontractor Outsource Fleet Radar",
    role: "Vendor Delivery & Special Processes",
    department: "Supply Chain",
    description:
      "Tracks outsourced special processes (Nadcap heat treatment, anodizing, plating) with live delivery challan tracking and turnaround SLA enforcement.",
    status: "STANDBY",
    avatarIcon: "Truck",
    model: "Gemini 1.5 Flash (Logistics & Special Processes)",
    tools: [
      "track_subcontract_challans",
      "audit_vendor_turnaround_sla",
      "verify_nadcap_approvals",
      "escalate_delayed_lots",
    ],
    sampleMissions: [
      "Track 120x Passivated Aerospace Housings at SurTech Nadcap facility (SLA 48h)",
      "Flag vendor lead-time slippage on Hard Chrome Plating batch #HC-881",
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
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
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
    } else if (agent.id === "agent-production") {
      steps = [
        {
          stepIndex: 1,
          thought: `Querying active machine spindle loads and queued work orders across CNC Milling Cells 1-3.`,
          tool: "evaluate_cell_load",
          toolInput: { cells: ["CELL-1", "CELL-2", "CELL-3"], windowHours: 48 },
          observation: `Cell 1 (Mazak 5-Axis): Overloaded at 118% capacity. Cell 2 (DMG Mori 4-Axis): Idling at 42% capacity with compatible tool magazine.`,
          status: "warning",
          latencyMs: 130,
        },
        {
          stepIndex: 2,
          thought: `Simulating routing alternative for WO-8910 (Turbine Disc roughing) from Cell 1 to Cell 2 with fixture verification.`,
          tool: "simulate_routing_alternatives",
          toolInput: { workOrderId: "WO-8910", fromMachine: "CNC-01", toMachine: "CNC-04" },
          observation: `Routing valid. Zero fixture clash detected. Setup changeover time: 24 mins. Schedule compression: 8.5 hours.`,
          status: "success",
          latencyMs: 195,
        },
        {
          stepIndex: 3,
          thought: `Reassigning active work order dispatch schedule and notifying Shift 2 line supervisor.`,
          tool: "reassign_work_orders",
          toolInput: { workOrderId: "WO-8910", targetMachine: "CNC-04", startSlot: "14:00" },
          observation: `Work order dispatched. Digital traveler traveler-8910 updated on operator tablet at CNC-04.`,
          status: "success",
          latencyMs: 120,
        },
      ];
      finalOutcome = `Autonomous line balancing complete. Balanced Cell 1 (118% -> 94%) and Cell 2 (42% -> 78%). Compressed Turbine Disc delivery queue by 8.5 hours with zero on-time delivery breach.`;
      kpisAffected = [
        { label: "Spindle Utilization Balance", value: "91.2%", change: "+16.8%" },
        { label: "WIP Bottleneck Reduction", value: "8.5 hrs", change: "-34%" },
        { label: "On-Time Delivery (OTD)", value: "99.4%", change: "+1.2%" },
      ];
    } else if (agent.id === "agent-sales") {
      steps = [
        {
          stepIndex: 1,
          thought: `Parsing 3D CAD STEP file geometry to compute bounding envelope, pocket depth-to-width ratios, and thin-wall risks.`,
          tool: "analyze_part_geometry",
          toolInput: { partName: "AERO_VALVE_BODY_V3.step", material: "Titanium 6Al-4V" },
          observation: `Bounding box: 140x120x85mm. Cavity depth: 42mm (D/W ratio 3.2). 4x deep threaded holes requiring specialized extended reach tap.`,
          status: "warning",
          latencyMs: 280,
        },
        {
          stepIndex: 2,
          thought: `Calculating roughing, semi-finishing, and 5-axis contouring cycle times based on volumetric material removal rate (MRR).`,
          tool: "estimate_machining_time",
          toolInput: { stockVolumeCm3: 1428, finishedVolumeCm3: 412, mrrCm3PerMin: 18.5 },
          observation: `Estimated machining cycle time: 54.8 mins/pc across Op 10 (4-axis roughing) and Op 20 (5-axis finishing).`,
          status: "success",
          latencyMs: 160,
        },
        {
          stepIndex: 3,
          thought: `Generating commercial DFM precision quotation for 150 units with 28% margin target.`,
          tool: "generate_sales_quote",
          toolInput: { batchQty: 150, unitMaterialCost: 84.50, unitMachiningCost: 96.00, targetMargin: 0.28 },
          observation: `Quote QTE-2026-0518 generated. Unit price: $250.70. Total quote value: $37,605.00. Ready for customer review.`,
          status: "success",
          latencyMs: 140,
        },
      ];
      finalOutcome = `DFM Quote QTE-2026-0518 compiled in 2.8 minutes. Analyzed Titanium Valve Body geometry, estimated 54.8 min cycle time, and locked profitable unit price of $250.70 (28.4% gross margin).`;
      kpisAffected = [
        { label: "Quote Turnaround Time", value: "2.8 mins", change: "-98%" },
        { label: "Estimated Margin", value: "28.4%", change: "Target Met" },
        { label: "DFM Manufacturability Score", value: "96 / 100", change: "High" },
      ];
    } else if (agent.id === "agent-finance") {
      steps = [
        {
          stepIndex: 1,
          thought: `Aggregating direct machine electrical kWh, tool depreciation, operator labor rates, and raw material lot costs for active batch #IMP-4412.`,
          tool: "aggregate_job_costs",
          toolInput: { lotId: "IMP-4412", targetMargin: 0.28 },
          observation: `Material cost: $11,200. Machining labor: $4,850. Tool wear wear-out: $1,420. Power draw: $380. Total actual cost: $17,850.`,
          status: "success",
          latencyMs: 150,
        },
        {
          stepIndex: 2,
          thought: `Auditing scrap variance and rework cycle times to detect margin erosion against quoted target.`,
          tool: "detect_scrap_margin_drift",
          toolInput: { lotId: "IMP-4412", scrapCount: 2, quotedRevenue: 25600 },
          observation: `Revenue: $25,600. Realized profit: $7,750 (30.2% margin vs 28.0% target). Scrap variance within acceptable threshold (1.2%).`,
          status: "success",
          latencyMs: 130,
        },
      ];
      finalOutcome = `Financial margin audit complete for Lot #IMP-4412. Confirmed actual margin of 30.2% (+$560 above quote baseline). Zero unabsorbed overhead.`;
      kpisAffected = [
        { label: "Realized Gross Margin", value: "30.2%", change: "+2.2%" },
        { label: "Scrap Cost Variance", value: "$340", change: "-15%" },
        { label: "Cost Accuracy", value: "99.1%", change: "+4.5%" },
      ];
    } else if (agent.id === "agent-safety") {
      steps = [
        {
          stepIndex: 1,
          thought: `Auditing optical safety light curtain interlocks and emergency stop loop relays across all CNC machining cells.`,
          tool: "audit_safety_interlocks",
          toolInput: { cells: ["LINE-1", "LINE-2", "LINE-3"] },
          observation: `All 14 light curtain sensors operating within <15ms safety trip response time. Zero bypass overrides active.`,
          status: "success",
          latencyMs: 115,
        },
        {
          stepIndex: 2,
          thought: `Verifying statutory calibration dates for EOT Overhead Cranes, Slings, and Air Receivers.`,
          tool: "check_statutory_due_dates",
          toolInput: { equipmentCategory: ["CRANE", "PRESSURE_VESSEL"] },
          observation: `Crane #CR-02 annual load test due in 12 days. Automated inspector booking issued to third-party agency TUV.`,
          status: "warning",
          latencyMs: 140,
        },
      ];
      finalOutcome = `Zero-Harm EHS audit complete. 14/14 safety curtains verified, zero safety violations detected. Pre-booked statutory crane load inspection with TUV for Bay 2.`;
      kpisAffected = [
        { label: "Days Without Lost Time Incident", value: "482 Days", change: "+1" },
        { label: "Safety Interlock Compliance", value: "100%", change: "Zero Faults" },
        { label: "Statutory Audit Readiness", value: "100%", change: "Audit Safe" },
      ];
    } else if (agent.id === "agent-hr") {
      steps = [
        {
          stepIndex: 1,
          thought: `Querying skill matrix certifications and biometric shift clock-ins for upcoming Shift 2 high-precision aerospace jobs.`,
          tool: "query_skill_matrix",
          toolInput: { requiredCert: "AERO_5AXIS_LEVEL_3", shift: "SHIFT_2" },
          observation: `3 certified Level-3 operators present on Shift 2: M. Sharma (Badge #1042), R. Kumar (Badge #1088), S. Nair (Badge #1104).`,
          status: "success",
          latencyMs: 105,
        },
        {
          stepIndex: 2,
          thought: `Assigning certified operators to high-risk titanium impeller setups to guarantee first-time yield.`,
          tool: "assign_operator_to_machine",
          toolInput: { operatorId: "1042", machineId: "CNC-02", job: "WO-9012 (Impeller)" },
          observation: `Operator M. Sharma allocated to CNC-02. Digital work instruction traveler synced to workstation terminal.`,
          status: "success",
          latencyMs: 125,
        },
      ];
      finalOutcome = `Workforce competency matching complete for Shift 2. Allocated 100% certified 5-axis operators to critical titanium jobs, mitigating operator error risk.`;
      kpisAffected = [
        { label: "Critical Skill Coverage", value: "100%", change: "Complete" },
        { label: "Operator Error Risk", value: "< 0.05%", change: "-80%" },
        { label: "Roster Balance Index", value: "98.4%", change: "+5.2%" },
      ];
    } else if (agent.id === "agent-tooling") {
      steps = [
        {
          stepIndex: 1,
          thought: `Inspecting calibration expiry dates across all active micrometers, bore gauges, and digital height masters in Tool Crib A.`,
          tool: "inspect_gauge_calibration",
          toolInput: { crib: "CRIB_A", graceDays: 5 },
          observation: `Detected 2x Mitutoyo Bore Gauges (BG-04, BG-09) with calibration expired past due date.`,
          status: "warning",
          latencyMs: 120,
        },
        {
          stepIndex: 2,
          thought: `Locking expired bore gauges in ERP tool database to prevent issuance on shopfloor job travelers.`,
          tool: "lock_expired_tools",
          toolInput: { toolCodes: ["BG-04", "BG-09"], quarantineLocation: "METROLOGY_CAL_RACK" },
          observation: `Tools quarantined. Notification sent to Chief Metrologist for NABL external calibration dispatch.`,
          status: "success",
          latencyMs: 135,
        },
      ];
      finalOutcome = `Tooling & Metrology sweep complete. Quarantined 2 expired bore gauges, preventing non-conforming dimensions on aerospace production lines.`;
      kpisAffected = [
        { label: "Calibrated Gauge Compliance", value: "100%", change: "Audit Ready" },
        { label: "Out-of-Cal Risk Avoidance", value: "100%", change: "Zero Breaches" },
        { label: "Tool Crib Audit Health", value: "99.8%", change: "+3.4%" },
      ];
    } else if (agent.id === "agent-cam") {
      steps = [
        {
          stepIndex: 1,
          thought: `Parsing DMG Mori 5-Axis NC program (Prog #8841) to analyze volumetric chip load and identify non-cutting air moves.`,
          tool: "parse_gcode_toolpath",
          toolInput: { programId: "NC-8841", machine: "DMG_MORI_5AXIS" },
          observation: `Found 18 minutes of redundant retracts and sub-optimal feed reduction in entry arcs.`,
          status: "warning",
          latencyMs: 160,
        },
        {
          stepIndex: 2,
          thought: `Applying dynamic feed-rate optimization and constant-engagement trochoidal toolpath smoothing.`,
          tool: "optimize_feed_and_speed",
          toolInput: { programId: "NC-8841", targetChipThicknessMm: 0.085 },
          observation: `Cycle time reduced from 52.4 mins to 42.1 mins (-19.6% cycle compression). Spindle load smoothed below 75%.`,
          status: "success",
          latencyMs: 240,
        },
      ];
      finalOutcome = `CAM G-Code optimization complete. Compressed NC-8841 cycle time by 10.3 minutes per part (19.6% faster) while extending end mill life by 25%.`;
      kpisAffected = [
        { label: "Cycle Time Compression", value: "-10.3 mins", change: "-19.6%" },
        { label: "Tool Life Extension", value: "+25%", change: "+25%" },
        { label: "Annual Machine Capacity Gained", value: "+142 hrs", change: "+142 hrs" },
      ];
    } else if (agent.id === "agent-subcontract") {
      steps = [
        {
          stepIndex: 1,
          thought: `Scanning active delivery challans for outsourced Nadcap passivation, anodizing, and vacuum heat treatment batches.`,
          tool: "track_subcontract_challans",
          toolInput: { activeVendors: ["SurTech Nadcap", "Apex Heat Treat", "Zenith Platers"] },
          observation: `120x Aerospace Housings (DC-0042) currently undergoing final salt-spray inspection at SurTech. On track for delivery today at 16:30.`,
          status: "success",
          latencyMs: 125,
        },
        {
          stepIndex: 2,
          thought: `Auditing vendor turnaround SLA performance against contracted 48-hour aerospace standard.`,
          tool: "audit_vendor_turnaround_sla",
          toolInput: { vendorId: "VND-SURTECH", windowDays: 30 },
          observation: `SurTech 30-day turnaround SLA: 98.4% on-time. Quality acceptance rate: 100%. Status: Preferred Tier-1 Vendor.`,
          status: "success",
          latencyMs: 140,
        },
      ];
      finalOutcome = `Subcontracting fleet radar updated. 120x Aerospace Housings confirmed on-track from SurTech Nadcap. 0 vendor delivery bottlenecks detected.`;
      kpisAffected = [
        { label: "Subcontractor On-Time SLA", value: "98.4%", change: "+1.1%" },
        { label: "Vendor Quality Acceptance", value: "100%", change: "Zero Rejects" },
        { label: "Challan Traceability", value: "100%", change: "Live GPS / Gate Synced" },
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

    await logAudit({
      actor: "system",
      action: "AI_AGENT_MISSION_COMPLETED",
      entityType: "AiAgent",
      entityId: agent.id,
      details: `Mission ${missionResult.missionId} completed by ${agent.name}: "${String(missionResult.goal).slice(0, 80)}"`,
    });

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
