import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
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
    const body = await request.json();
    const { title, description, category, submittedBy } = body;

    if (!title || !description || !category) {
      return NextResponse.json(
        { error: "Title, description, and category are required" },
        { status: 400 },
      );
    }

    const idea = await (prisma as any).idea.create({
      data: {
        title,
        description,
        category, // SAFETY | FIVES | CYCLE_TIME | ERGONOMICS
        submittedBy: submittedBy || "Operator",
        status: "SUBMITTED",
        upvotes: 1, // Auto upvote by submitter
      },
    });

    await logAudit({
      actor: submittedBy || "Operator",
      action: "IDEA_CREATED",
      entityType: "Idea",
      entityId: idea.id,
      details: `${title} · ${category} · ${submittedBy || "Operator"}`,
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
    const body = await request.json();
    const { id, action, status } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Idea ID is required" },
        { status: 400 },
      );
    }

    if (action === "UPVOTE") {
      const updatedIdea = await (prisma as any).idea.update({
        where: { id },
        data: {
          upvotes: { increment: 1 },
        },
      });

      await logAudit({
        actor: "system",
        action: "IDEA_UPVOTED",
        entityType: "Idea",
        entityId: id,
        details: `upvoted to ${updatedIdea.upvotes}`,
      });

      return NextResponse.json({ success: true, idea: updatedIdea });
    }

    if (status) {
      const existing = await (prisma as any).idea.findUnique({ where: { id } });
      const updatedIdea = await (prisma as any).idea.update({
        where: { id },
        data: {
          status,
          adjustmentHistory: [
            ...((existing?.adjustmentHistory as any[]) || []),
            {
              action: `STATUS → ${status}`,
              by: "system",
              at: new Date().toISOString(),
              previousStatus: existing?.status || null,
            },
          ],
        },
      });

      await logAudit({
        actor: "system",
        action: "IDEA_STATUS_CHANGED",
        entityType: "Idea",
        entityId: id,
        details: `status → ${status}`,
      });

      return NextResponse.json({ success: true, idea: updatedIdea });
    }

    return NextResponse.json(
      { error: "Invalid action or status parameter" },
      { status: 400 },
    );
  } catch (error: any) {
    console.error("PATCH /api/ideas error:", error);
    return NextResponse.json(
      { error: "Failed to update idea" },
      { status: 500 },
    );
  }
}
