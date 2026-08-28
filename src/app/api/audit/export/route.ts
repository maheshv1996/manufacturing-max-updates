import { getUserFromHeaders, can } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function csvCell(v: any): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const user = getUserFromHeaders(request.headers);
  if (!user.isOwner && !can(user, "system.edit")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");
    const entityType = searchParams.get("entityType");
    const search = searchParams.get("search");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: any = {};
    if (action && action !== "ALL") where.action = action;
    if (entityType && entityType !== "ALL") where.entityType = entityType;
    if (search) {
      where.OR = [
        { actor: { contains: search, mode: "insensitive" } },
        { details: { contains: search, mode: "insensitive" } },
      ];
    }
    if (from || to) {
      where.at = {};
      if (from) where.at.gte = new Date(from);
      if (to) where.at.lte = new Date(to);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { at: "desc" },
      take: 10000,
    });

    const header = [
      "Time",
      "Actor",
      "Action",
      "Entity Type",
      "Entity ID",
      "Details",
    ];
    const rows = logs.map((l) => [
      l.at.toISOString(),
      l.actor,
      l.action,
      l.entityType,
      l.entityId || "",
      l.details || "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map(csvCell).join(","))
      .join("\r\n");

    return new NextResponse("\uFEFF" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("Audit export error:", error);
    return NextResponse.json(
      { error: "Failed to export audit logs" },
      { status: 500 },
    );
  }
}
