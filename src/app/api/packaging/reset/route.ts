import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { operatorId, reason } = body;

    // Log the shift reset in audit log
    await logAudit({
      actor: operatorId || "supervisor",
      action: "PACKAGING_SHIFT_RESET",
      entityType: "PackagingStation",
      entityId: "shift-counter",
      details: `Packaging shift counters reset. Reason: ${reason || "Regular shift changeover"}`,
    });

    return NextResponse.json({
      success: true,
      message: "Shift packaging counter has been reset.",
      resetAt: new Date(),
    });
  } catch (error: any) {
    console.error("Shift reset error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reset shift counters" },
      { status: 500 },
    );
  }
}
