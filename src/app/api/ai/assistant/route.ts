import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { queryAuraLLM } from "@/lib/llmGateway";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { message, contextDomain } = body;

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    const sanitizedMessage = String(message).slice(0, 1000);

    // Fetch live factory context snapshot to feed into the LLM
    const [machines, activeWorkOrders, lowStockMaterials] = await Promise.all([
      prisma.machine.findMany({
        where: { isActive: true },
        select: { code: true, name: true, status: true },
        take: 8,
      }),
      prisma.workOrder.findMany({
        where: { status: { in: ["PLANNED", "IN_PROGRESS"] } },
        include: { product: true },
        take: 5,
      }),
      prisma.rawMaterial.findMany({
        where: { currentStock: { lte: 50 } },
        take: 5,
        select: { name: true, sku: true, currentStock: true, unit: true },
      }),
    ]);

    const liveFactoryContext = `LIVE FACTORY SNAPSHOT:
• Active Machines: ${machines.map((m) => `${m.code} (${m.name}): ${m.status}`).join(", ")}
• Active Work Orders: ${activeWorkOrders.map((w) => `${w.woNumber} (${w.product.name}) Qty: ${w.plannedQuantity}`).join(", ")}
• Low Stock Raw Materials: ${lowStockMaterials.map((m) => `${m.name} (${m.currentStock} ${m.unit})`).join(", ") || "None"}
• Context Domain: ${contextDomain || "Factory Master"}
`;

    // Query free LLM / Ollama / Gemini / Groq
    const result = await queryAuraLLM(sanitizedMessage, liveFactoryContext);

    await logAudit({
      actor: "system",
      action: "AI_ASSISTANT_QUERY",
      entityType: "AiAssistant",
      details: `Queried assistant in ${contextDomain || "Factory Master"}: "${sanitizedMessage.slice(0, 80)}"`,
    });

    return NextResponse.json({
      success: true,
      response: result.text,
      provider: result.provider,
      model: result.model,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
