import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditTx } from "@/lib/audit";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";

export async function GET() {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ideas = await (prisma as any).idea.findMany({
      orderBy: [{ upvotes: "desc" }, { createdAt: "desc" }],
    });

    // Compute Shopfloor Lean Contributor Leaderboard
    const contributorMap: Record<
      string,
      { name: string; total: number; implemented: number; totalUpvotes: number }
    > = {};

    ideas.forEach((i: any) => {
      const name = i.submittedBy || "Anonymous Operator";
      if (!contributorMap[name]) {
        contributorMap[name] = {
          name,
          total: 0,
          implemented: 0,
          totalUpvotes: 0,
        };
      }
      contributorMap[name].total += 1;
      contributorMap[name].totalUpvotes += i.upvotes || 0;
      if (i.status === "IMPLEMENTED") {
        contributorMap[name].implemented += 1;
      }
    });

    const leaderboard = Object.values(contributorMap).sort(
      (a, b) =>
        b.implemented - a.implemented ||
        b.totalUpvotes - a.totalUpvotes ||
        b.total - a.total,
    );

    return NextResponse.json({ ideas, leaderboard });
  } catch (error: any) {
    console.error("GET /api/ideas error:", error);
    return NextResponse.json(
      { error: "Failed to fetch continuous improvement ideas" },
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

    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { title, description, category, submittedBy } = body;

    if (!title || !description || !category) {
      return NextResponse.json(
        { error: "Title, description, and category are required" },
        { status: 400 },
      );
    }

    const actor = user.name || submittedBy || "Operator";

    const idea = await prisma.$transaction(async (tx) => {
      const created = await (tx as any).idea.create({
        data: {
          title,
          description,
          category, // SAFETY | FIVES | CYCLE_TIME | ERGONOMICS
          submittedBy: actor,
          status: "SUBMITTED",
          upvotes: 1, // Auto upvote by submitter
        },
      });

      await logAuditTx(tx, {
        actor,
        action: "IDEA_CREATED",
        entityType: "Idea",
        entityId: created.id,
        details: `${title} · ${category} · ${actor}`,
      });

      return created;
    });

    return NextResponse.json({ success: true, idea });
  } catch (error: any) {
    console.error("POST /api/ideas error:", error);
    return NextResponse.json(
      { error: "Failed to submit continuous improvement idea" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const headerList = await headers();
    const user = getUserFromHeaders(headerList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, action, status } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Idea ID is required" },
        { status: 400 },
      );
    }

    const actor = user.name || headerList.get("x-user-name") || "Operator";

    if (action === "UPVOTE") {
      const updatedIdea = await prisma.$transaction(async (tx) => {
        const updated = await (tx as any).idea.update({
          where: { id },
          data: {
            upvotes: { increment: 1 },
          },
        });

        await logAuditTx(tx, {
          actor,
          action: "IDEA_UPVOTED",
          entityType: "Idea",
          entityId: id,
          details: `upvoted to ${updated.upvotes} by ${actor}`,
        });

        return updated;
      });

      return NextResponse.json({ success: true, idea: updatedIdea });
    }

    if (status) {
      if (
        !user.isOwner &&
        !can(user, "system.edit") &&
        !can(user, "ops.edit")
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const updatedIdea = await prisma.$transaction(async (tx) => {
        const existing = await (tx as any).idea.findUnique({ where: { id } });
        if (!existing) {
          throw new Error("NOT_FOUND:Idea not found");
        }

        const updated = await (tx as any).idea.update({
          where: { id },
          data: {
            status,
            adjustmentHistory: [
              ...((existing?.adjustmentHistory as any[]) || []),
              {
                action: `STATUS → ${status}`,
                by: actor,
                at: new Date().toISOString(),
                previousStatus: existing?.status || null,
              },
            ],
          },
        });

        await logAuditTx(tx, {
          actor,
          action: "IDEA_STATUS_CHANGED",
          entityType: "Idea",
          entityId: id,
          details: `status → ${status} (from ${existing.status}) by ${actor}`,
        });

        return updated;
      });

      return NextResponse.json({ success: true, idea: updatedIdea });
    }

    return NextResponse.json(
      { error: "Invalid action or status parameter" },
      { status: 400 },
    );
  } catch (error: any) {
    if (error?.message?.startsWith("NOT_FOUND:")) {
      return NextResponse.json(
        { error: error.message.replace("NOT_FOUND:", "") },
        { status: 404 },
      );
    }
    console.error("PATCH /api/ideas error:", error);
    return NextResponse.json(
      { error: "Failed to update idea" },
      { status: 500 },
    );
  }
}
