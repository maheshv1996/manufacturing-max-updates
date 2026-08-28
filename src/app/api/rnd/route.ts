import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      where: { projectType: "RND" },
      include: {
        workOrders: {
          include: {
            testCampaigns: {
              include: {
                records: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const enrichedProjects = projects.map((project: any) => {
      let totalCost = 0;
      let totalTests = 0;
      let passedTests = 0;
      let iterationsCount = project.workOrders?.length || 0;

      project.workOrders?.forEach((wo: any) => {
        wo.testCampaigns?.forEach((tc: any) => {
          totalCost += tc.testCostRupees || 0;
          tc.records?.forEach((tr: any) => {
            totalTests++;
            if (tr.result === "PASS") passedTests++;
          });
        });
      });

      const passRate =
        totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : null;

      return {
        id: project.id,
        name: project.name,
        code: project.code,
        clientName: project.clientName,
        status: project.status,
        iterationsCount,
        totalCost,
        passRate,
        description: project.description,
      };
    });

    return NextResponse.json({ projects: enrichedProjects });
  } catch (error) {
    console.error("GET /api/rnd error:", error);
    return NextResponse.json(
      { error: "Failed to fetch R&D projects" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, clientName, description } = body;

    if (!name || !clientName) {
      return NextResponse.json(
        { error: "Project name and client name are required" },
        { status: 400 },
      );
    }

    const projectCode = `RND-${Date.now().toString().slice(-6)}`;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);

    const newProject = await prisma.project.create({
      data: {
        name,
        code: projectCode,
        clientName,
        description,
        targetCompletionDate: targetDate,
        projectType: "RND",
        status: "OPEN",
      },
    });

    await logAudit({
      actor: "system",
      action: "RND_CREATED",
      entityType: "PROJECT",
      entityId: newProject.id,
      details: `${projectCode} · ${name} · ${clientName}`,
    });

    return NextResponse.json(
      { success: true, project: newProject },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/rnd error:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 },
    );
  }
}
