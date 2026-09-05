import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      !user.isOwner &&
      !can(user, "ops.edit") &&
      !can(user, "system.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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

    const actor = user.name || ownerName || "Operator";

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.improvementProject.create({
        data: {
          title,
          description: description || null,
          type,
          ownerName: actor,
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

      await logAuditTx(tx, {
        actor,
        action: "KAIZEN_CREATED",
        entityType: "ImprovementProject",
        entityId: created.id,
        details: `${title} · ${type} · ${actor} · ${machineId ? "machine=" + machineId : "no machine"}`,
      });

      return created;
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
