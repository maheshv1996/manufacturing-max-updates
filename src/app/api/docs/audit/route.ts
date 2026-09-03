import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { documentId, title, version, productName, operatorName, woNumber } =
      body;

    await logAudit({
      actor: operatorName || "Operator",
      action: "DRAWING_VIEWED",
      entityType: "DOCUMENT",
      entityId: documentId || "UNKNOWN",
      details: `Operator viewed '${title || "Drawing"}' (REV ${version || 1}) for product '${productName || "N/A"}' on Work Order ${woNumber || "N/A"}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error logging drawing view audit:", error);
    return NextResponse.json({ error: "Failed to log audit" }, { status: 500 });
  }
}
