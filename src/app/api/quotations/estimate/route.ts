import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { calculateQuotationEstimate } from "@/lib/estimatingEngine";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    await logAudit({ actor: "system", action: "QUOTATION_ESTIMATED", entityType: "Quotation", details: "Quotation cost estimation generated" });
  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { lines, quotedPrice } = body;

    if (!lines || !Array.isArray(lines)) {
      return NextResponse.json(
        { error: "Lines array is required" },
        { status: 400 },
      );
    }

    const estimate = await calculateQuotationEstimate(lines, quotedPrice);
    return NextResponse.json({ estimate });
  } catch (error: any) {
    console.error("POST /api/quotations/estimate error:", error);
    return NextResponse.json(
      { error: "Failed to calculate estimate" },
      { status: 500 },
    );
  }
}
