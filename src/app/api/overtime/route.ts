import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import { requireManagerLevel, validateReason } from "@/lib/managerGate";
import { logAuditTx } from "@/lib/audit";

export const maxDuration = 60;

export async function GET(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const isManager = user.isOwner || (await requireManagerLevel(user)).ok;
    // Workers see their own requests; managers/owners see everything.
    const where =
      isManager && userId ? { userId } : isManager ? {} : { userId: user.id };
    const requests = await prisma.overtimeRequest.findMany({
      where,
      include: { user: { select: { name: true, employeeNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const pending = await prisma.overtimeRequest.count({
      where: { status: "PENDING" },
    });
    return NextResponse.json({ requests, pending, isManager });
  } catch (error) {
    console.error("GET /api/overtime error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action, data } = body;
    if (!action || !data)
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );
    let result: any;

    if (action === "request") {
      const { date, hours, reason } = data;
      if (!date || !hours || !reason)
        return NextResponse.json(
          { error: "date, hours and reason required" },
          { status: 400 },
        );
      const h = Number(hours);
      if (!(h > 0 && h <= 24))
        return NextResponse.json(
          { error: "hours must be between 0 and 24" },
          { status: 400 },
        );
      result = await prisma.$transaction(async (tx) => {
        const created = await tx.overtimeRequest.create({
          data: {
            userId: user.id,
            date: new Date(date),
            hours: h,
            reason,
            status: "PENDING",
          },
        });
        await logAuditTx(tx, {
          actor: user.name || "Operator",
          action: "OT_REQUESTED",
          entityType: "OVERTIME",
          entityId: created.id,
          details: `${h}h on ${date} — ${reason.slice(0, 80)}`,
        });
        return created;
      });
    } else if (action === "approve" || action === "reject") {
      const gate = await requireManagerLevel(user);
      if (!gate.ok)
        return NextResponse.json({ error: gate.error }, { status: 403 });
      const reason = validateReason(data);
      if (!reason.ok)
        return NextResponse.json({ error: reason.error }, { status: 400 });
      const ot = await prisma.overtimeRequest.findUnique({
        where: { id: data.id },
        include: { user: true },
      });
      if (!ot)
        return NextResponse.json(
          { error: "Request not found" },
          { status: 404 },
        );
      if (ot.status !== "PENDING")
        return NextResponse.json(
          { error: "Request already decided" },
          { status: 400 },
        );
      result = await prisma.$transaction(async (tx) => {
        const updated = await tx.overtimeRequest.update({
          where: { id: data.id },
          data: {
            status: action === "approve" ? "APPROVED" : "REJECTED",
            approvedByName: user.name || "Manager",
            approvedAt: new Date(),
            note: reason.reason,
          },
        });
        await logAuditTx(tx, {
          actor: user.name || "Admin",
          action: action === "approve" ? "OT_APPROVED" : "OT_REJECTED",
          entityType: "OVERTIME",
          entityId: ot.id,
          details: `${ot.user?.name || ot.userId}: ${ot.hours}h on ${ot.date.toISOString().slice(0, 10)} (${reason.reason})`,
        });
        return updated;
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/overtime error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
