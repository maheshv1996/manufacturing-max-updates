import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const operatorId = searchParams.get("operatorId");
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const whereClause: any = {};
    if (operatorId) {
      whereClause.operatorId = operatorId;
    }

    const [prodLogs, dtLogs] = await Promise.all([
      prisma.productionLog.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          machine: true,
          workOrder: { include: { product: true } },
        },
      }),
      prisma.downtimeLog.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          machine: true,
          reason: true,
        },
      }),
    ]);

    // Combine and sort
    const combined = [
      ...prodLogs.map((l) => ({ ...l, type: "PRODUCTION" as const })),
      ...dtLogs.map((l) => ({ ...l, type: "DOWNTIME" as const })),
    ];

    combined.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return NextResponse.json({ logs: combined.slice(0, limit) });
  } catch (error: any) {
    console.error("Failed to fetch recent logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent logs" },
      { status: 500 },
    );
  }
}
