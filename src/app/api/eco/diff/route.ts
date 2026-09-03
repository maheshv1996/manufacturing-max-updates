import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ecoId = searchParams.get("id");

    const [ecos, products] = await Promise.all([
      prisma.eco.findMany({
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.findMany({
        include: {
          bomLines: {
            include: { rawMaterial: true },
          },
          routingSteps: {
            include: { machine: true },
          },
        },
      }),
    ]);

    const activeEco = ecoId
      ? ecos.find((e) => e.id === ecoId) || ecos[0]
      : ecos[0];
    const targetProduct = products[0];

    // Build side-by-side visual diff model
    const diffData = {
      eco: activeEco
        ? {
            id: activeEco.id,
            ecoNumber: activeEco.ecoNumber,
            title: activeEco.title,
            status: activeEco.status,
            productSku:
              activeEco.effectivityValue ||
              targetProduct?.sku ||
              "PRD-AL-HOUSING",
            effectiveDate: activeEco.implementedAt || activeEco.createdAt,
            createdAt: activeEco.createdAt,
          }
        : {
            id: "eco-sample-1",
            ecoNumber: "ECO-2026-042",
            title: "Weight Optimization & Titanium Grade 5 Conversion",
            status: "APPROVED",
            productSku: targetProduct?.sku || "PRD-AL-HOUSING",
            effectiveDate: new Date(),
            createdAt: new Date(),
          },
      currentRevision: {
        rev: "Rev A",
        title: "Standard Aluminum Baseline",
        materialCost: 450,
        cycleTimeTotalMin: 14.5,
        bom: [
          {
            code: "AL-BILLET-6061",
            name: "Aluminum 6061-T6 Billet",
            qty: 1.5,
            unit: "kg",
            cost: 300,
            status: "REMOVED",
          },
          {
            code: "O-RING-NBR-70",
            name: "Nitrile O-Ring Ø25mm",
            qty: 2.0,
            unit: "pcs",
            cost: 30,
            status: "UNCHANGED",
          },
          {
            code: "HEX-BOLT-M6X20",
            name: "SS304 Hex Bolt M6x20",
            qty: 4.0,
            unit: "pcs",
            cost: 20,
            status: "MODIFIED",
          },
        ],
        routing: [
          {
            seq: 10,
            station: "CNC Turning",
            machine: "CNC-01",
            cycleTimeMin: 4.5,
            status: "MODIFIED",
          },
          {
            seq: 20,
            station: "CNC Milling",
            machine: "VMC-02",
            cycleTimeMin: 7.0,
            status: "MODIFIED",
          },
          {
            seq: 30,
            station: "Anodizing Line",
            machine: "ANOD-01",
            cycleTimeMin: 3.0,
            status: "REMOVED",
          },
        ],
      },
      proposedRevision: {
        rev: "Rev B",
        title: "Aerospace Titanium Ti-6Al-4V Conversion",
        materialCost: 920,
        cycleTimeTotalMin: 18.0,
        bom: [
          {
            code: "TI-BILLET-DIA80",
            name: "Titanium Ti-6Al-4V Grade 5 Billet",
            qty: 1.2,
            unit: "kg",
            cost: 720,
            status: "ADDED",
          },
          {
            code: "O-RING-NBR-70",
            name: "Nitrile O-Ring Ø25mm",
            qty: 2.0,
            unit: "pcs",
            cost: 30,
            status: "UNCHANGED",
          },
          {
            code: "HEX-BOLT-TI-M6X20",
            name: "Titanium Gr5 Bolt M6x20",
            qty: 4.0,
            unit: "pcs",
            cost: 170,
            status: "ADDED",
          },
        ],
        routing: [
          {
            seq: 10,
            station: "Heavy CNC Turning",
            machine: "CNC-01",
            cycleTimeMin: 6.0,
            status: "MODIFIED",
          },
          {
            seq: 20,
            station: "High-Speed 5-Axis Milling",
            machine: "5AX-01",
            cycleTimeMin: 9.5,
            status: "MODIFIED",
          },
          {
            seq: 30,
            station: "Vacuum Heat Treatment",
            machine: "SUB-HT",
            cycleTimeMin: 2.5,
            status: "ADDED",
          },
        ],
      },
      signatures: [
        {
          role: "Engineering Lead",
          name: "Mahesh Sharma (Design Authority)",
          status: "APPROVED",
          date: "2026-08-27",
        },
        {
          role: "Quality Assurance Lead",
          name: "Priya Nair (AS9100 Lead)",
          status: "APPROVED",
          date: "2026-08-28",
        },
        {
          role: "Production Operations Head",
          name: "Arun Patel (Plant Head)",
          status: "PENDING",
          date: null,
        },
      ],
    };

    return NextResponse.json({
      ecos,
      diffData,
    });
  } catch (error: any) {
    console.error("Failed to load ECO diff data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { ecoId, signerRole, signerName } = body;

    await logAudit({
      actor: signerName || "supervisor",
      action: "ECO_ELECTRONIC_SIGNATURE_APPLIED",
      entityType: "ECO",
      entityId: ecoId || "eco-main",
      details: `${signerRole} electronic sign-off approved by ${signerName || "Authorized Lead"}`,
    });

    return NextResponse.json({
      success: true,
      message: `Signature recorded for ${signerRole}`,
      signedAt: new Date(),
    });
  } catch (error: any) {
    console.error("Failed to sign ECO:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
