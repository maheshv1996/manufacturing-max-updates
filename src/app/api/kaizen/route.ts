import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = await prisma.improvementProject.findMany({
      include: {
        machine: { select: { name: true, code: true } },
        rcaRecord: true,
        actionItems: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(projects);
  } catch (err) {
    console.error("GET /api/kaizen error:", err);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
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
    const {
      title,
      description,
      type,
      ownerName,
      machineId,
      expectedAnnualSavings,
    } = body;

    if (!title || !type || !ownerName) {
      return NextResponse.json(
        { error: "title, type, and ownerName are required" },
        { status: 400 },
      );
    }

    const project = await prisma.improvementProject.create({
      data: {
        title,
        description: description || null,
        type,
        ownerName,
        machineId: machineId || null,
        expectedAnnualSavings: expectedAnnualSavings
          ? parseFloat(expectedAnnualSavings)
          : null,
        status: "OPEN",
        phase: "DEFINE",
      },
      include: {
        machine: { select: { name: true, code: true } },
        rcaRecord: true,
        actionItems: true,
      },
    });

    await logAudit({
      actor: ownerName,
      action: "KAIZEN_CREATED",
      entityType: "ImprovementProject",
      entityId: project.id,
      details: `${title} · ${type} · ${ownerName} · ${machineId ? "machine=" + machineId : "no machine"}`,
    });

    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    console.error("POST /api/kaizen error:", err);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 },
    );
  }
}
