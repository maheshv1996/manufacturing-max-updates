import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden } from "@/lib/core/errors";
import { nearMissQuotaTx } from "@/lib/ehs/ehsTx";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || !can(user, "ehs.view")) throw forbidden("ehs.view required");

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const managers = await prisma.user.findMany({
      where: { level: "MANAGER", isActive: true },
      select: { name: true },
      orderBy: { name: "asc" },
    });

    const settingRow = await prisma.setting.findUnique({ where: { key: "ehsObservationQuota" } });
    let quota = 4;
    if (settingRow && settingRow.value) {
      const parsed = parseInt(settingRow.value, 10);
      if (!Number.isNaN(parsed) && parsed > 0) quota = parsed;
    }

    const result = await nearMissQuotaTx(prisma, {
      monthStart,
      now,
      managers: managers.map((m) => m.name),
      quota,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const api = toApiError(e);
    const status = api.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(api, { status });
  }
}
