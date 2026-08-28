import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

let plcIO = {
  digitalInputs: [
    {
      tag: "DI_01",
      name: "Part_Present_Photoeye",
      location: "Infeed Conveyor",
      state: true,
      desc: "Opto-reflective sensor detecting raw billet",
    },
    {
      tag: "DI_02",
      name: "Safety_Door_Interlock",
      location: "CNC Enclosure",
      state: true,
      desc: "Dual magnetic safety switch",
    },
    {
      tag: "DI_03",
      name: "Coolant_Pressure_OK",
      location: "Pump Station",
      state: true,
      desc: "Pressure switch closed at > 15 bar",
    },
    {
      tag: "DI_04",
      name: "Emergency_Stop_Healthy",
      location: "Operator Console",
      state: true,
      desc: "NC safety relay loop closed",
    },
    {
      tag: "DI_05",
      name: "Tool_Clamp_Confirmed",
      location: "Spindle Drawbar",
      state: true,
      desc: "Proximity sensor verifying BT40 locked",
    },
  ],
  digitalOutputs: [
    {
      tag: "DO_01",
      name: "Spindle_Run_Enable",
      location: "CNC Servo Drive",
      state: true,
      desc: "Safety output enabling inverter stage",
    },
    {
      tag: "DO_02",
      name: "Coolant_Solenoid_Valve",
      location: "Hydraulic Manifold",
      state: true,
      desc: "24V solenoid commanding through-spindle flow",
    },
    {
      tag: "DO_03",
      name: "Robot_Cycle_Trigger",
      location: "Fanuc I/O Interface",
      state: false,
      desc: "Triggers unloading sequence when cycle finishes",
    },
    {
      tag: "DO_04",
      name: "Stack_Light_Green_Run",
      location: "Machine Tower Light",
      state: true,
      desc: "Illuminates green indicator on shop floor",
    },
    {
      tag: "DO_05",
      name: "Stack_Light_Red_Alarm",
      location: "Machine Tower Light",
      state: false,
      desc: "Illuminates red indicator on fault/trip",
    },
  ],
  analogInputs: [
    {
      tag: "AI_01",
      name: "Spindle_Current_Draw",
      signal: "4-20 mA",
      value: 14.2,
      unit: "A",
      range: "0 - 30 A",
    },
    {
      tag: "AI_02",
      name: "Vibration_Accelerometer",
      signal: "0-10 V",
      value: 2.4,
      unit: "V",
      range: "0 - 5 mm/s",
    },
    {
      tag: "AI_03",
      name: "Bearing_Thermocouple_K",
      signal: "mV",
      value: 43.5,
      unit: "°C",
      range: "0 - 100 °C",
    },
  ],
};

function evaluatePlcLogic() {
  const di01 =
    plcIO.digitalInputs.find((i) => i.tag === "DI_01")?.state ?? true;
  const di02 =
    plcIO.digitalInputs.find((i) => i.tag === "DI_02")?.state ?? true;
  const di03 =
    plcIO.digitalInputs.find((i) => i.tag === "DI_03")?.state ?? true;
  const di04 =
    plcIO.digitalInputs.find((i) => i.tag === "DI_04")?.state ?? true;
  const di05 =
    plcIO.digitalInputs.find((i) => i.tag === "DI_05")?.state ?? true;

  const isSafeAndReady = di01 && di02 && di03 && di04 && di05;

  // Update Outputs based on virtual ladder rungs
  plcIO.digitalOutputs = plcIO.digitalOutputs.map((out) => {
    if (out.tag === "DO_01") return { ...out, state: isSafeAndReady };
    if (out.tag === "DO_02") return { ...out, state: isSafeAndReady };
    if (out.tag === "DO_04") return { ...out, state: isSafeAndReady };
    if (out.tag === "DO_05") return { ...out, state: !isSafeAndReady };
    return out;
  });
}

export async function GET() {
  evaluatePlcLogic();
  return NextResponse.json({
    plcState: "RUN_MODE",
    scanCycleTimeMs: 1.2,
    io: plcIO,
    ladderRungs: [
      {
        rungNo: 1,
        title: "Master Safety & Spindle Run Enable",
        expression:
          "DI_01(Part) & DI_02(Door) & DI_03(Coolant) & DI_04(E-Stop) & DI_05(Clamp) => DO_01(Spindle) & DO_02(Coolant) & DO_04(Green Light)",
        state: plcIO.digitalOutputs.find((o) => o.tag === "DO_01")?.state
          ? "ENERGIZED"
          : "DE-ENERGIZED",
      },
      {
        rungNo: 2,
        title: "Fault Interlock & Tower Red Beacon",
        expression: "!(DI_02 & DI_04) => DO_05(Red Alarm Beacon)",
        state: plcIO.digitalOutputs.find((o) => o.tag === "DO_05")?.state
          ? "ENERGIZED"
          : "DE-ENERGIZED",
      },
    ],
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tag, state } = body;

    plcIO.digitalInputs = plcIO.digitalInputs.map((inp) =>
      inp.tag === tag ? { ...inp, state: Boolean(state) } : inp,
    );

    evaluatePlcLogic();

    return NextResponse.json({
      success: true,
      message: `Toggled ${tag} to ${state}`,
      io: plcIO,
    });
  } catch (error: any) {
    console.error("Toggle PLC IO error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update PLC IO" },
      { status: 500 },
    );
  }
}
