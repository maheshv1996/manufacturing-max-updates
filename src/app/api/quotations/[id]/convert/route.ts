import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { convertQuoteToWorkOrders } from "@/lib/quotations";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (
      !user.id ||
      (!user.isOwner && !canAny(user, ["commercial.edit", "ops.edit"]))
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || "Admin";

    const { id } = await params;

    // M15 — interlock: block conversion while a discount awaits manager approval
    const quote = await prisma.quotation.findUnique({
      where: { id },
      select: { id: true, discountApprovalStatus: true, status: true },
    });
    if (!quote) {
      return NextResponse.json(
        { error: "Quotation not found" },
        { status: 404 },
      );
    }
    if (quote.discountApprovalStatus === "PENDING_MANAGER") {
      return NextResponse.json(
        {
          error:
            "This quote has a discount above 5% awaiting manager approval. Convert only after the discount is approved or rejected.",
          code: "QUOTE_DISCOUNT_PENDING",
        },
        { status: 400 },
      );
    }

    const result = await convertQuoteToWorkOrders(id, actor);

    return NextResponse.json({
      message: "Quotation successfully converted to Work Order(s)",
      quotation: result.quotation,
      workOrders: result.workOrders,
    });
  } catch (error: any) {
    console.error("POST /api/quotations/[id]/convert error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to convert quotation" },
      { status: 400 },
    );
  }
}
