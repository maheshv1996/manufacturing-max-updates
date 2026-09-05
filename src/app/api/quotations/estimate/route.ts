import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { calculateQuotationEstimate } from "@/lib/estimatingEngine";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      !user.isOwner &&
      !canAny(user, ["commercial.view", "commercial.edit", "ops.view", "ops.edit", "system.edit"])
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const lines = body.lines;
    const quotedPrice = typeof body.quotedPrice === "number" ? body.quotedPrice : undefined;

    if (!lines || !Array.isArray(lines)) {
      return NextResponse.json(
        { error: "Lines array is required" },
        { status: 400 },
      );
    }

    const estimate = await calculateQuotationEstimate(lines, quotedPrice);
    const actor = user.name || user.id || "Estimator";

    await logAudit({
      actor,
      action: "QUOTATION_ESTIMATED",
      entityType: "Quotation",
      details: `Quotation cost estimation generated for ${lines.length} lines`,
    });

    return NextResponse.json({ estimate });
  } catch (error: unknown) {
    console.error("POST /api/quotations/estimate error:", error);
    return NextResponse.json(
      { error: "Failed to calculate estimate" },
      { status: 500 },
    );
  }
}
