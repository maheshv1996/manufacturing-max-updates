import { getUserFromHeaders, can } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfDay } from "date-fns";
import { headers } from "next/headers";
import { logAuditTx } from "@/lib/audit";

export async function POST(req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.isOwner && !can(user, "system.edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { date, totalKwh, unitCostPerKwh, totalCost } = await req.json();
    const readingDate = startOfDay(new Date(date));

    const reading = await prisma.$transaction(async (tx) => {
      const up = await tx.energyReading.upsert({
        where: { date: readingDate },
        update: { totalKwh, unitCostPerKwh, totalCost },
        create: { date: readingDate, totalKwh, unitCostPerKwh, totalCost },
      });

      await logAuditTx(tx, {
        actor: user.name || "system",
        action: "ENERGY_READING_UPSERTED",
        entityType: "EnergyReading",
        entityId: up.id,
        details: `${up.date.toISOString().split("T")[0]} · ${totalKwh} kWh · ${unitCostPerKwh} INR/kWh`,
      });

      return up;
    });

    return NextResponse.json(reading);
  } catch (error) {
    console.error("Failed to log energy reading:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
