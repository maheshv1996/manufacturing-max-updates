import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { transcript } = body;

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript is required" },
        { status: 400 },
      );
    }

    const lower = transcript.toLowerCase();
    let spokenResponse = "";
    let actionExecuted = "";
    let status = "SUCCESS";

    if (
      lower.includes("clock") ||
      lower.includes("piece") ||
      lower.includes("part")
    ) {
      actionExecuted = "CLOCK_PARTS";
      spokenResponse =
        "Clocked 5 good manufactured pieces for Work Order 1001 on CNC-01. Target batch progress updated to 54 percent.";
    } else if (
      lower.includes("maintenance") ||
      lower.includes("call") ||
      lower.includes("help")
    ) {
      actionExecuted = "DISPATCH_MAINTENANCE";
      spokenResponse =
        "Priority Andon maintenance call dispatched to Cell 1. Maintenance lead notified on radio channel 2.";
    } else if (
      lower.includes("vibration") ||
      lower.includes("spindle") ||
      lower.includes("temp")
    ) {
      actionExecuted = "QUERY_TELEMETRY";
      spokenResponse =
        "CNC-01 spindle vibration is normal at 1.28 millimeters per second. Bearing temperature is nominal at 42 degrees Celsius.";
    } else {
      actionExecuted = "GENERAL_ASSIST";
      spokenResponse = `Voice command understood: "${transcript}". All systems running nominally.`;
    }

    await logAudit({
      actor: "voice-operator",
      action: `VOICE_${actionExecuted}`,
      entityType: "Shopfloor",
      entityId: "Cell-01",
      details: `Voice command received: "${transcript}" -> Result: "${spokenResponse}"`,
    });

    return NextResponse.json({
      status,
      transcript,
      actionExecuted,
      spokenResponse,
      timestamp: new Date().toLocaleTimeString(),
    });
  } catch (error: any) {
    console.error("Voice route error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process voice command" },
      { status: 500 },
    );
  }
}
