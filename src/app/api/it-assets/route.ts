import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";
import { nextSeqNumber } from "@/lib/seqNumbers";

export const maxDuration = 60;

const ASSET_TYPES = [
  "LAPTOP",
  "DESKTOP",
  "MONITOR",
  "MOBILE",
  "PRINTER",
  "SERVER",
  "NETWORK",
  "UPS",
  "OTHER",
];

export async function GET(_req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const gate = canAny(user, ["system.view", "system.edit"]) || user.isOwner;
    if (!gate)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const [assets, users] = await Promise.all([
      prisma.itAsset.findMany({
        include: {
          assignedTo: {
            select: { id: true, name: true, employeeNumber: true },
          },
        },
        orderBy: [{ status: "asc" }, { name: "asc" }],
      }),
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, employeeNumber: true },
        orderBy: { name: "asc" },
      }),
    ]);
    const stats = {
      total: assets.length,
      assigned: assets.filter((a) => a.status === "ASSIGNED").length,
      inStock: assets.filter((a) => a.status === "IN_STOCK").length,
      inMaintenance: assets.filter((a) => a.status === "IN_MAINTENANCE").length,
      retired: assets.filter((a) => a.status === "RETIRED").length,
    };
    return NextResponse.json({ assets, users, stats, types: ASSET_TYPES });
  } catch (error) {
    console.error("GET /api/it-assets error:", error);
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
      canAny(user, ["system.edit"]);
    if (!canEdit)
      return NextResponse.json(
        { error: "Requires manager or system.edit" },
        { status: 403 },
      );

    let result: any;
    if (action === "create-asset") {
      const { name, assetType, serialNumber, notes } = data;
      if (!name || !assetType)
        return NextResponse.json(
          { error: "name and assetType required" },
          { status: 400 },
        );
      if (!ASSET_TYPES.includes(assetType))
        return NextResponse.json(
          { error: "Invalid asset type" },
          { status: 400 },
        );
      const assetCode = await nextSeqNumber("itAsset", "assetCode", "ITA");
      result = await prisma.itAsset.create({
        data: {
          assetCode,
          name,
          assetType,
          serialNumber: serialNumber || null,
          notes: notes || null,
        },
      });
      await logAudit({
        actor,
        action: "IT_ASSET_CREATED",
        entityType: "IT_ASSET",
        entityId: result.id,
        details: `${assetCode} · ${name} (${assetType})`,
      });
    } else if (action === "update-asset") {
      const a = await prisma.itAsset.findUnique({ where: { id: data.id } });
      if (!a)
        return NextResponse.json({ error: "Asset not found" }, { status: 404 });
      const patch: any = {};
      if (data.name !== undefined) patch.name = data.name;
      if (data.serialNumber !== undefined)
        patch.serialNumber = data.serialNumber || null;
      if (data.notes !== undefined) patch.notes = data.notes || null;
      if (data.status !== undefined) patch.status = data.status;
      if (data.assignedToId !== undefined && data.assignedToId !== null) {
        patch.assignedToId = data.assignedToId;
        patch.assignedAt = new Date();
        patch.status = "ASSIGNED";
      } else if (data.assignedToId === null) {
        patch.assignedToId = null;
        patch.assignedAt = null;
        if (!data.status) patch.status = "IN_STOCK";
      }
      result = await prisma.itAsset.update({
        where: { id: a.id },
        data: patch,
        include: { assignedTo: { select: { name: true } } },
      });
      await logAudit({
        actor,
        action: "IT_ASSET_UPDATED",
        entityType: "IT_ASSET",
        entityId: a.id,
        details: `${a.assetCode} · ${result.status}${result.assignedTo ? ` → ${result.assignedTo.name}` : ""}`,
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/it-assets error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
