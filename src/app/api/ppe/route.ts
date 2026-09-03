import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";
import { nextSeqNumber } from "@/lib/seqNumbers";

export const maxDuration = 60;

const PPE_CATEGORIES = [
  "HELMET",
  "SAFETY_SHOES",
  "SAFETY_GLASSES",
  "GLOVES",
  "RESPIRATOR",
  "EARPLUGS",
  "FACE_SHIELD",
  "HARNESS",
  "APRON",
  "OTHER",
];

export async function GET(_req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const gate =
      canAny(user, ["ehs.view", "ehs.edit", "system.edit"]) || user.isOwner;
    if (!gate)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const [issues, users] = await Promise.all([
      prisma.ppeIssue.findMany({
        include: {
          user: { select: { id: true, name: true, employeeNumber: true } },
        },
        orderBy: { issuedAt: "desc" },
        take: 500,
      }),
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, employeeNumber: true },
        orderBy: { name: "asc" },
      }),
    ]);
    const byUser: Record<
      string,
      { name: string; issues: number; active: number; categories: string[] }
    > = {};
    issues.forEach((i) => {
      const key = i.userId;
      const entry = (byUser[key] ||= {
        name: i.user.name || "—",
        issues: 0,
        active: 0,
        categories: [],
      });
      entry.issues += i.quantity;
      if (!i.returnedAt) {
        entry.active += i.quantity;
        if (!entry.categories.includes(i.category))
          entry.categories.push(i.category);
      }
    });
    const stats = {
      totalIssues: issues.length,
      itemsIssued: issues.reduce((s, i) => s + i.quantity, 0),
      activeItems: issues
        .filter((i) => !i.returnedAt)
        .reduce((s, i) => s + i.quantity, 0),
      employeesCovered: Object.keys(byUser).length,
    };
    return NextResponse.json({
      issues,
      users,
      byUser: Object.values(byUser).sort((a, b) => b.issues - a.issues),
      stats,
      categories: PPE_CATEGORIES,
    });
  } catch (error) {
    console.error("GET /api/ppe error:", error);
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
  const actor = user.name || "Admin";
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
    const canEdit =
      user.isOwner ||
      (await requireManagerLevel(user)).ok ||
      canAny(user, ["ehs.edit"]);
    if (!canEdit)
      return NextResponse.json(
        { error: "Requires manager or ehs.edit" },
        { status: 403 },
      );

    let result: any;
    if (action === "create-issue") {
      const { userId, category, itemName, quantity, issuedAt, notes } = data;
      if (!userId || !category || !itemName)
        return NextResponse.json(
          { error: "userId, category and itemName required" },
          { status: 400 },
        );
      if (!PPE_CATEGORIES.includes(category))
        return NextResponse.json(
          { error: "Invalid PPE category" },
          { status: 400 },
        );
      const employee = await prisma.user.findUnique({ where: { id: userId } });
      if (!employee)
        return NextResponse.json(
          { error: "Employee not found" },
          { status: 404 },
        );
      const issueNumber = await nextSeqNumber("ppeIssue", "issueNumber", "PPE");
      result = await prisma.ppeIssue.create({
        data: {
          issueNumber,
          userId,
          category,
          itemName,
          quantity:
            quantity !== undefined && quantity !== null
              ? Math.max(1, parseInt(quantity, 10) || 1)
              : 1,
          issuedAt: issuedAt ? new Date(issuedAt) : new Date(),
          issuedBy: actor,
          notes: notes || null,
        },
      });
      await logAudit({
        actor,
        action: "PPE_ISSUED",
        entityType: "PPE_ISSUE",
        entityId: result.id,
        details: `${issueNumber} · ${category} · ${itemName} ×${result.quantity} → ${employee.name}`,
      });
    } else if (action === "return-issue") {
      const issue = await prisma.ppeIssue.findUnique({
        where: { id: data.id },
      });
      if (!issue)
        return NextResponse.json(
          { error: "Issue record not found" },
          { status: 404 },
        );
      if (issue.returnedAt)
        return NextResponse.json(
          { error: "Already returned" },
          { status: 400 },
        );
      result = await prisma.ppeIssue.update({
        where: { id: issue.id },
        data: {
          returnedAt: data.returnedAt ? new Date(data.returnedAt) : new Date(),
        },
      });
      await logAudit({
        actor,
        action: "PPE_RETURNED",
        entityType: "PPE_ISSUE",
        entityId: issue.id,
        details: `${issue.issueNumber} · ${issue.itemName}`,
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/ppe error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
