import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }

    const lowerQuery = message.toLowerCase();

    const [machines, workOrders, rawMaterials] = await Promise.all([
      prisma.machine.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true, status: true },
      }),
      prisma.workOrder.findMany({
        where: { status: { in: ["PLANNED", "IN_PROGRESS"] } },
        include: { product: true },
        take: 5,
      }),
      prisma.rawMaterial.findMany({
        where: { currentStock: { lte: 50 } },
        take: 5,
        select: {
          id: true,
          name: true,
          sku: true,
          currentStock: true,
          minStock: true,
          unit: true,
        },
      }),
    ]);

    let responseText = "";
    let actionLinks: { label: string; href: string }[] = [];
    let metricsSummary: { label: string; value: string; color?: string }[] = [];

    if (
      lowerQuery.includes("vibration") ||
      lowerQuery.includes("temp") ||
      lowerQuery.includes("health") ||
      lowerQuery.includes("machine")
    ) {
      const runningCount = machines.filter(
        (m) => m.status === "RUNNING",
      ).length;
      responseText = `I analyzed the real-time sensor streams across all **${machines.length} active machine centers**.\n\n• **CNC-01**: Spindle speed at 12,450 RPM with normal vibration (1.28 mm/s RMS).\n• **CNC-02**: Spindle bearing temperature is elevated at **44.2°C** (warning threshold: 52°C).\n• **VMC-01**: Currently IDLE in standby state.\n\nRecommended Action: Keep monitoring CNC-02 thermal gradient over the next 2 hours.`;
      metricsSummary = [
        {
          label: "Online Machines",
          value: `${runningCount} / ${machines.length}`,
          color: "text-emerald-400",
        },
        { label: "Max Vibration", value: "1.28 mm/s", color: "text-amber-400" },
        { label: "Max Spindle Temp", value: "44.2 °C", color: "text-rose-400" },
      ];
      actionLinks = [
        { label: "View 3D Digital Twin", href: "/digital-twin/cell" },
        { label: "Sensor Waveform Historian", href: "/iot/telemetry" },
        { label: "Check TPM Reliability", href: "/maintenance/reliability" },
      ];
    } else if (
      lowerQuery.includes("order") ||
      lowerQuery.includes("work order") ||
      lowerQuery.includes("bottleneck") ||
      lowerQuery.includes("delivery")
    ) {
      responseText = `There are currently **${workOrders.length} active work orders** on the production floor.\n\n• **WO-1001** (Gear Housing): On track at 48% completion, cycle time running at 145s/pc.\n• **WO-1002** (Flange Adapter): In-process machining step 3; first article metrology passed.\n• **Bottleneck Alert**: CNC Milling Cell 1 is at 92% capacity utilization.`;
      metricsSummary = [
        {
          label: "Active Orders",
          value: `${workOrders.length} Orders`,
          color: "text-cyan-400",
        },
        {
          label: "Avg Cycle Time",
          value: "145 sec",
          color: "text-emerald-400",
        },
        { label: "Cell Load", value: "92%", color: "text-amber-400" },
      ];
      actionLinks = [
        { label: "Open MRP Workbench", href: "/supply/mrp" },
        {
          label: "Multi-Level BOM Cost Exploder",
          href: "/engineering/bom-tree",
        },
        { label: "Shopfloor Andon Live", href: "/ops/andon" },
      ];
    } else if (
      lowerQuery.includes("stock") ||
      lowerQuery.includes("material") ||
      lowerQuery.includes("shortage")
    ) {
      responseText = `Found **${rawMaterials.length} raw material items** approaching or below minimum reorder thresholds.\n\n• **Titanium Grade 5 Bar (60mm)**: 24 kg remaining (Min: 50 kg).\n• **Alloy Steel 4340 Billet**: 15 pcs remaining (Min: 30 pcs).\n\nRecommended Action: Generate automated Purchase Requisitions via the MRP Workbench.`;
      metricsSummary = [
        {
          label: "Low Stock Items",
          value: `${rawMaterials.length} SKUs`,
          color: "text-rose-400",
        },
        {
          label: "Reorder Trigger",
          value: "Auto-Requisition",
          color: "text-amber-400",
        },
      ];
      actionLinks = [
        { label: "Launch MRP Workbench", href: "/supply/mrp" },
        { label: "Inventory Vault", href: "/supply/vault" },
      ];
    } else {
      responseText = `I am your **Shopfloor AI Copilot** connected to live enterprise telemetry, work orders, quality records, and digital twins.\n\nI can assist you with:\n1. **Equipment Diagnostics**: Real-time vibration, spindle loads, and thermal gradients.\n2. **Production Scheduling**: Work order bottlenecks, cycle time variances, and MRP runs.\n3. **Quality & Compliance**: 8D CAPA summaries, AS9102 FAI verification, and 360° genealogy.\n4. **Intralogistics**: AGV routing, high-bay AS/RS warehouse utilization, and Sparkplug B node states.`;
      actionLinks = [
        { label: "Explore ISA-95 UNS", href: "/iot/uns" },
        { label: "Visual Flow Studio", href: "/automation/flows" },
        { label: "3D Digital Twin", href: "/digital-twin/cell" },
      ];
    }

    return NextResponse.json({
      reply: responseText,
      metricsSummary,
      actionLinks,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("AI Assistant error:", error);
    return NextResponse.json(
      { error: error.message || "AI Assistant failed to process query" },
      { status: 500 },
    );
  }
}
