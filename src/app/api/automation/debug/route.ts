import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = Date.now();
    const eventLogs = [
      {
        id: "evt-9041",
        flowName: "Spindle Thermal Runaway Protection",
        trigger: "MQTT In: CNC-01/processValue/bearingTempC",
        topic: "Apex/Plant-1/CNC-01/bearingTempC",
        payload: { value: 54.2, unit: "°C", quality: "GOOD_192" },
        condition: "bearingTempC > 52.0 °C (TRUE)",
        actionTaken: "ACTION_MAINTENANCE_DISPATCHED",
        actionDetails: "Logged High Priority Breakdown Job for CNC-01",
        status: "SUCCESS",
        latencyMs: 3.8,
        timestamp: new Date(now - 1000 * 25).toISOString(),
      },
      {
        id: "evt-9040",
        flowName: "ISO 10816 Vibration Quality Gate",
        trigger: "MQTT In: CNC-02/processValue/vibrationMmSec",
        topic: "Apex/Plant-1/CNC-02/vibrationMmSec",
        payload: { value: 1.94, unit: "mm/s", quality: "GOOD_192" },
        condition: "vibrationMmSec > 1.8 mm/s (TRUE)",
        actionTaken: "ACTION_QUALITY_NCR_FLAGGED",
        actionDetails:
          "Work Order #WO-1002 flagged for FAI Metrology verification",
        status: "SUCCESS",
        latencyMs: 5.1,
        timestamp: new Date(now - 1000 * 90).toISOString(),
      },
      {
        id: "evt-9039",
        flowName: "Shift Production Target Synth Chime",
        trigger: "Count In: CNC-01/count/goodParts",
        topic: "Apex/Plant-1/CNC-01/count/goodParts",
        payload: { value: 150, target: 150, shift: "A" },
        condition: "goodParts >= target (TRUE)",
        actionTaken: "ACTION_AUDIO_SYNTH_PLAYED",
        actionDetails: "880Hz victory chime dispatched to shopfloor speaker",
        status: "SUCCESS",
        latencyMs: 2.4,
        timestamp: new Date(now - 1000 * 240).toISOString(),
      },
      {
        id: "evt-9038",
        flowName: "Idle Machine Energy Saver",
        trigger: "State In: VMC-01/state",
        topic: "Apex/Plant-1/VMC-01/state",
        payload: { state: "IDLE", idleMinutes: 32 },
        condition: "idleMinutes > 30 min (TRUE)",
        actionTaken: "ACTION_COOLANT_PUMP_OFF",
        actionDetails: "Turned off high-pressure coolant pump to save 7.5kW",
        status: "SUCCESS",
        latencyMs: 4.2,
        timestamp: new Date(now - 1000 * 600).toISOString(),
      },
    ];

    return NextResponse.json({
      events: eventLogs,
      stats: {
        totalEventsToday: 1420,
        actionsTriggeredToday: 18,
        avgLatencyMs: 3.9,
      },
    });
  } catch (error: any) {
    console.error("Failed to load automation debug events:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
