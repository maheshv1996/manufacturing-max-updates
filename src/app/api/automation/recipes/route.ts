import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// In-memory active recipe store
let recipeList = [
  {
    id: "rcp-01",
    name: "Spindle Thermal Runaway & Breakdown Dispatch",
    category: "SAFETY_MAINTENANCE",
    description:
      "Monitors spindle bearing temperatures via OPC-UA/MQTT. If temp > 52°C, auto-dispatches high priority maintenance request and logs audit event.",
    trigger: "Sensor: bearingTempC > 52.0 °C",
    action: "Action: Dispatch Breakdown Job + Play Acoustic Alarm",
    status: "ENABLED",
    triggersCount24h: 3,
    lastTriggered: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    tags: ["OPC-UA", "Maintenance", "Thermal", "Safety"],
  },
  {
    id: "rcp-02",
    name: "ISO 10816 Vibration Anomaly -> FAI Quality Flag",
    category: "QUALITY_METROLOGY",
    description:
      "Evaluates vibration velocity RMS on CNC milling axes. If vibration > 1.8 mm/s, flags active Work Order for mandatory First Article Metrology inspection.",
    trigger: "Sensor: vibrationMmSec > 1.8 mm/s",
    action: "Action: Set WO Quality Hold + Generate NCR Ticket",
    status: "ENABLED",
    triggersCount24h: 5,
    lastTriggered: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    tags: ["Vibration", "ISO 10816", "Quality", "FAI"],
  },
  {
    id: "rcp-03",
    name: "Shift Production Milestone Synth Victory Chime",
    category: "OPERATIONS_AUDIO",
    description:
      "When packed or manufactured good quantity reaches 100% of the Work Order lot size, dispatches an 880Hz acoustic victory synth chime to the shopfloor station.",
    trigger: "Counter: goodQuantity >= plannedQuantity",
    action: "Action: Web Audio Synth Chime (880Hz) + Log Shift Milestone",
    status: "ENABLED",
    triggersCount24h: 8,
    lastTriggered: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    tags: ["Audio Chime", "Packaging", "Gamification", "Shift"],
  },
  {
    id: "rcp-04",
    name: "Idle Machine Energy Saver (Coolant Pump Cutoff)",
    category: "ENERGY_SUSTAINABILITY",
    description:
      "Detects when CNC controller remains in IDLE state for longer than 30 minutes. Auto-turns off the 7.5kW high-pressure coolant pump.",
    trigger: "State: Machine IDLE > 30 minutes",
    action: "Action: Modbus Relay OFF + Operator Alert",
    status: "ENABLED",
    triggersCount24h: 2,
    lastTriggered: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    tags: ["Modbus", "Energy", "Coolant", "Sustainability"],
  },
  {
    id: "rcp-05",
    name: "CNC Tool Life Limit & Preset Counter",
    category: "TOOLING_WEAR",
    description:
      "Tracks active spindle machining minutes per end mill. Once tool run minutes reach 120 min, alerts the Tool Room to prep replacement insert.",
    trigger: "Timer: toolMachiningMinutes >= 120 min",
    action: "Action: Tool Room Preset Alert + Increment Wear Log",
    status: "DISABLED",
    triggersCount24h: 0,
    lastTriggered: null,
    tags: ["Tool Room", "CNC", "Tool Life", "Presets"],
  },
];

export async function GET() {
  return NextResponse.json({
    recipes: recipeList,
    stats: {
      totalRecipes: recipeList.length,
      enabledRecipes: recipeList.filter((r) => r.status === "ENABLED").length,
      totalTriggers24h: recipeList.reduce(
        (sum, r) => sum + r.triggersCount24h,
        0,
      ),
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { recipeId, status } = body;

    recipeList = recipeList.map((r) =>
      r.id === recipeId ? { ...r, status } : r,
    );

    await logAudit({
      actor: "automation-engineer",
      action: "AUTOMATION_RECIPE_TOGGLED",
      entityType: "AutomationRecipe",
      entityId: recipeId,
      details: `Changed recipe status to ${status}`,
    });

    return NextResponse.json({
      success: true,
      message: `Recipe updated to ${status}`,
    });
  } catch (error: any) {
    console.error("Toggle recipe error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update recipe" },
      { status: 500 },
    );
  }
}
