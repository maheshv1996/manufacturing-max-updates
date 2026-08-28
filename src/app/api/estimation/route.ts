import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";

export const maxDuration = 60;

// Default labour rate (₹/hr) — can be overridden per request.
const DEFAULT_LABOUR_RATE = 600;
const DEFAULT_MARGIN_PCT = 25;

export async function GET(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    !user.isOwner &&
    !canAny(user, [
      "commercial.view",
      "engineering.view",
      "ops.view",
      "system.view",
    ])
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    if (!productId)
      return NextResponse.json(
        { error: "productId required" },
        { status: 400 },
      );
    const qty = Math.max(1, Number(searchParams.get("qty")) || 100);
    const labourRate =
      Number(searchParams.get("labourRate")) || DEFAULT_LABOUR_RATE;
    const marginPct =
      Number(searchParams.get("marginPct")) || DEFAULT_MARGIN_PCT;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        routingSteps: {
          include: { operation: true, machine: true },
          orderBy: { seq: "asc" },
        },
        bomLines: { include: { rawMaterial: true } },
      },
    });
    if (!product)
      return NextResponse.json({ error: "Product not found" }, { status: 404 });

    // Cycle time from engineering routings
    const operations = product.routingSteps.map((s) => ({
      seq: s.seq,
      operation: s.operation?.name || `Op ${s.seq}`,
      machine: s.machine?.name || "—",
      cycleSeconds: Number(s.standardCycleTimeSeconds || 0),
      setupMinutes: Number(s.setupTimeMin || 0),
    }));
    const cycleSecondsTotal = operations.reduce(
      (a, o) => a + o.cycleSeconds,
      0,
    );
    const setupMinutesTotal = operations.reduce(
      (a, o) => a + o.setupMinutes,
      0,
    );
    const cycleHoursPerUnit = cycleSecondsTotal / 3600;
    const setupHoursPerUnit = setupMinutesTotal / 60 / Math.max(1, qty); // setup amortised over the lot

    // Material cost from BOM (engineering feed) with product cost fallback
    const bomMaterialCost = product.bomLines.reduce(
      (a, l) => a + (l.qtyPerUnit || 0) * (l.rawMaterial.unitCost || 0),
      0,
    );
    const materialCostPerUnit = Math.max(
      bomMaterialCost,
      product.materialCostPerUnit || 0,
    );

    // Tooling cost: engineering-registered tooling (product field or linked
    // fixture procurement cost), amortised over the lot.
    const fixture = await prisma.fixture.findFirst({
      where: { productId: product.id },
    });
    const toolingCostTotal = Number(
      product.toolingCost ?? fixture?.procurementCost ?? 0,
    );
    const toolingPerUnit = qty > 0 ? toolingCostTotal / qty : 0;

    const labourCostPerUnit =
      (cycleHoursPerUnit + setupHoursPerUnit) * labourRate;
    const manufacturingCost =
      labourCostPerUnit + materialCostPerUnit + toolingPerUnit;
    const suggestedUnitPrice = Number(
      (manufacturingCost * (1 + marginPct / 100)).toFixed(2),
    );

    return NextResponse.json({
      product: { id: product.id, sku: product.sku, name: product.name },
      qty,
      labourRate,
      marginPct,
      operations,
      totals: {
        cycleSecondsTotal,
        setupMinutesTotal,
        cycleHoursPerUnit: Number(cycleHoursPerUnit.toFixed(4)),
        setupHoursPerUnit: Number(setupHoursPerUnit.toFixed(4)),
      },
      cost: {
        labourCostPerUnit: Number(labourCostPerUnit.toFixed(2)),
        materialCostPerUnit: Number(materialCostPerUnit.toFixed(2)),
        bomMaterialCost: Number(bomMaterialCost.toFixed(2)),
        toolingCostTotal: Number(toolingCostTotal.toFixed(2)),
        toolingPerUnit: Number(toolingPerUnit.toFixed(2)),
        manufacturingCost: Number(manufacturingCost.toFixed(2)),
      },
      suggestedUnitPrice,
      suggestedSubtotal: Number((suggestedUnitPrice * qty).toFixed(2)),
    });
  } catch (error) {
    console.error("GET /api/estimation error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
