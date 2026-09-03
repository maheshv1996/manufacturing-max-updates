import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { parseOr400 } from "@/lib/validate";

export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum(["checkout"]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "people.edit"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || user.id || "Gate";
    const { id } = await params;

    const body = await req.json();
    const parsed = parseOr400(actionSchema, body);
    if (!parsed.ok) return parsed.response;

    const visit = await prisma.visitorLog.findUnique({ where: { id } });
    if (!visit) {
      return NextResponse.json({ error: "Visit not found" }, { status: 404 });
    }
    if (visit.status !== "IN_SITE") {
      return NextResponse.json(
        { error: `Visitor is already ${visit.status.replace(/_/g, " ")}` },
        { status: 400 },
      );
    }

    const updated = await prisma.visitorLog.update({
      where: { id },
      data: { status: "CHECKED_OUT", checkOutAt: new Date() },
    });

    await logAudit({
      actor,
      action: "VISITOR_CHECKED_OUT",
      entityType: "VisitorLog",
      entityId: id,
      details: `${visit.visitorName} checked out`,
    });

    return NextResponse.json({ success: true, visitor: updated });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Visit not found" }, { status: 404 });
    }
    console.error("POST /api/people/visitors/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}