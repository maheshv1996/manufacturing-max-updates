import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";

export async function GET(request: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);

    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    // If requesting leaves for a specific user, check permissions
    if (userId && userId !== user.id) {
      if (!can(user, "people.view") && !can(user, "people.edit")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const targetUserId = userId || user.id;

    const leaves = await prisma.leaveRequest.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(leaves);
  } catch (error) {
    console.error("Error fetching leaves:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);

    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, fromDate, toDate, days, reason } = body;

    if (!type || !fromDate || !toDate || !days || !reason) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        userId: user.id,
        type: type,
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
        days,
        reason: reason,
        status: "PENDING",
      },
    });
    await logAudit({ actor: "system", action: "LEAVE_REQUEST_SUBMITTED", entityType: "LeaveRequest", details: "Employee leave request submitted" });

    await prisma.auditLog.create({
      data: {
        action: "LEAVE_APPLIED",
        entityType: "LeaveRequest",
        entityId: leave.id,
        details: JSON.stringify({ type: type, days }),
        actor: user.name,
      },
    });

    return NextResponse.json(leave, { status: 201 });
  } catch (error) {
    console.error("Error applying leave:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
