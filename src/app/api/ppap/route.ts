import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

// AIAG PPAP 18-element checklist (production part approval process)
export const PPAP_ELEMENTS = [
  "Design Records",
  "Engineering Change Documents",
  "Customer Engineering Approval",
  "Design FMEA",
  "Process Flow Diagram",
  "Process FMEA",
  "Control Plan",
  "Measurement System Analysis Studies",
  "Dimensional Results",
  "Material / Performance Test Results",
  "Initial Process Studies",
  "Qualified Laboratory Documentation",
  "Appearance Approval Report",
  "Sample Production Parts",
  "Master Sample",
  "Checking Aids",
  "Customer-Specific Requirements",
  "Part Submission Warrant",
];

const PPAP_FIELDS = [
  "customerName",
  "revision",
  "submissionLevel",
  "status",
  "submittedAt",
  "dispositionAt",
  "dispositionBy",
  "notes",
];
const CP_FIELDS = [
  "revision",
  "status",
  "processStep",
  "characteristic",
  "specMin",
  "specMax",
  "measurementMethod",
  "sampleSize",
  "frequency",
  "controlMethod",
  "reactionPlan",
  "responsible",
  "notes",
];

export async function GET() {
  try {
    const [submissions, controlPlans, products] = await Promise.all([
      prisma.ppapSubmission.findMany({
        include: {
          product: { select: { sku: true, name: true } },
          elements: { orderBy: { elementNo: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.controlPlan.findMany({
        include: { product: { select: { sku: true, name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.findMany({
        select: { id: true, sku: true, name: true },
        orderBy: { sku: "asc" },
      }),
    ]);

    const enrichedSubs = submissions.map((s) => {
      const complete = s.elements.filter(
        (e) => e.status === "COMPLETE" || e.status === "N_A",
      ).length;
      const pct = s.elements.length
        ? Math.round((complete / s.elements.length) * 100)
        : 0;
      return { ...s, completionPct: pct };
    });

    return NextResponse.json({
      submissions: enrichedSubs,
      controlPlans,
      products,
      ppapElements: PPAP_ELEMENTS,
    });
  } catch (error: any) {
    console.error("GET /api/ppap error:", error);
    return NextResponse.json(
      { error: "Failed to fetch PPAP data" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const headerList = await headers();
    const userName = headerList.get("x-user-name") || "System";

    if (body.entity === "element") {
      const { ppapId, elementNo, status, notes } = body.data || {};
      if (!ppapId || !elementNo)
        return NextResponse.json(
          { error: "ppapId and elementNo required" },
          { status: 400 },
        );
      const existing = await prisma.ppapElement.findUnique({
        where: { ppapId_elementNo: { ppapId, elementNo: Number(elementNo) } },
      });
      const element = existing
        ? await prisma.ppapElement.update({
            where: { id: existing.id },
            data: { status, notes: notes ?? existing.notes },
          })
        : await prisma.ppapElement.create({
            data: {
              ppapId,
              elementNo: Number(elementNo),
              elementName:
                PPAP_ELEMENTS[Number(elementNo) - 1] || `Element ${elementNo}`,
              status,
              notes,
            },
          });
      return NextResponse.json({ success: true, item: element });
    }

    if (body.entity === "submit") {
      const { id } = body.data || {};
      const sub = await prisma.ppapSubmission.update({
        where: { id },
        data: { status: "SUBMITTED", submittedAt: new Date() },
      });
      await logAudit({
        actor: userName,
        action: "PPAP_SUBMITTED",
        entityType: "PPAP",
        entityId: sub.id,
        details: `PPAP ${sub.ppapNumber} submitted to ${sub.customerName || "customer"}`,
      });
      return NextResponse.json({ success: true, item: sub });
    }

    if (body.entity === "disposition") {
      const { id, disposition, notes } = body.data || {};
      const sub = await prisma.ppapSubmission.update({
        where: { id },
        data: {
          status: disposition === "APPROVED" ? "APPROVED" : "REJECTED",
          dispositionAt: new Date(),
          dispositionBy: userName,
          notes: notes || undefined,
        },
      });
      await logAudit({
        actor: userName,
        action: "PPAP_DISPOSITION",
        entityType: "PPAP",
        entityId: sub.id,
        details: `PPAP ${sub.ppapNumber} ${disposition} by ${userName}`,
      });
      return NextResponse.json({ success: true, item: sub });
    }

    if (body.entity === "controlPlan") {
      const { id, ...rest } = body.data || {};
      if (id) {
        const patch: any = {};
        for (const f of CP_FIELDS) {
          if (rest[f] !== undefined) patch[f] = rest[f] === "" ? null : rest[f];
        }
        for (const f of ["specMin", "specMax", "sampleSize"]) {
          if (rest[f] !== undefined && rest[f] !== "")
            patch[f] = Number(rest[f]);
        }
        const cp = await prisma.controlPlan.update({
          where: { id },
          data: patch,
        });
        return NextResponse.json({ success: true, item: cp });
      }
      const { productId, characteristic } = rest;
      if (!productId || !characteristic)
        return NextResponse.json(
          { error: "productId and characteristic required" },
          { status: 400 },
        );
      const count = await prisma.controlPlan.count();
      const planNumber = `CP-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, "0")}`;
      const data: any = { planNumber, productId, characteristic };
      for (const f of CP_FIELDS) {
        if (rest[f] !== undefined && rest[f] !== "") data[f] = rest[f];
      }
      for (const f of ["specMin", "specMax", "sampleSize"]) {
        if (rest[f] !== undefined && rest[f] !== "") data[f] = Number(rest[f]);
      }
      const cp = await prisma.controlPlan.create({ data });
      await logAudit({
        actor: userName,
        action: "CONTROL_PLAN_CREATED",
        entityType: "CONTROL_PLAN",
        entityId: cp.id,
        details: `Control Plan ${planNumber} — ${characteristic}`,
      });
      return NextResponse.json({ success: true, item: cp });
    }

    // PPAP submission create
    const { id, ...rest } = body.data || {};
    const { productId, customerName } = rest;
    if (!productId)
      return NextResponse.json(
        { error: "productId required" },
        { status: 400 },
      );
    if (id) {
      const patch: any = {};
      for (const f of PPAP_FIELDS) {
        if (rest[f] !== undefined) patch[f] = rest[f] === "" ? null : rest[f];
      }
      if (rest.submissionLevel !== undefined && rest.submissionLevel !== "")
        patch.submissionLevel = Number(rest.submissionLevel);
      for (const f of ["submittedAt", "dispositionAt"]) {
        if (rest[f]) patch[f] = new Date(rest[f]);
      }
      const sub = await prisma.ppapSubmission.update({
        where: { id },
        data: patch,
      });
      return NextResponse.json({ success: true, item: sub });
    }
    const count = await prisma.ppapSubmission.count();
    const ppapNumber = `PPAP-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, "0")}`;
    const sub = await prisma.ppapSubmission.create({
      data: {
        ppapNumber,
        productId,
        customerName: customerName || null,
        revision: rest.revision || "A",
        submissionLevel: rest.submissionLevel
          ? Number(rest.submissionLevel)
          : 3,
        status: rest.status || "DRAFT",
        notes: rest.notes || null,
        createdBy: userName,
      },
    });
    // Seed the 18 AIAG elements
    await prisma.ppapElement.createMany({
      data: PPAP_ELEMENTS.map((name, i) => ({
        ppapId: sub.id,
        elementNo: i + 1,
        elementName: name,
      })),
    });
    await logAudit({
      actor: userName,
      action: "PPAP_CREATED",
      entityType: "PPAP",
      entityId: sub.id,
      details: `PPAP ${ppapNumber} created for ${productId}`,
    });
    return NextResponse.json({ success: true, item: sub });
  } catch (error: any) {
    console.error("POST /api/ppap error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
