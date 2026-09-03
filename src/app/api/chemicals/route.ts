import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";
import { nextSeqNumber } from "@/lib/seqNumbers";

export const maxDuration = 60;

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

    const chemicals = await prisma.chemical.findMany({
      orderBy: { name: "asc" },
    });
    const locations: Record<
      string,
      { chemicals: number; lastReview: string | null }
    > = {};
    chemicals.forEach((c) => {
      const loc = c.storageLocation || "Unassigned";
      const entry = (locations[loc] ||= { chemicals: 0, lastReview: null });
      entry.chemicals += 1;
      if (c.msdsReviewDate) {
        const t = new Date(c.msdsReviewDate).getTime();
        if (!entry.lastReview || t > new Date(entry.lastReview).getTime())
          entry.lastReview = c.msdsReviewDate.toISOString();
      }
    });
    const now = Date.now();
    const stats = {
      total: chemicals.length,
      locations: Object.keys(locations).length,
      msdsMissing: chemicals.filter((c) => !c.msdsFilePath).length,
      reviewDue: chemicals.filter(
        (c) =>
          !c.msdsReviewDate ||
          now - new Date(c.msdsReviewDate).getTime() > 365 * 86400000,
      ).length,
    };
    return NextResponse.json({
      chemicals,
      locations: Object.entries(locations).map(([name, v]) => ({ name, ...v })),
      stats,
    });
  } catch (error) {
    console.error("GET /api/chemicals error:", error);
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
    if (action === "create-chemical") {
      const {
        name,
        casNumber,
        hazards,
        storageLocation,
        quantityOnHand,
        unit,
        msdsFilePath,
        msdsReviewDate,
      } = data;
      if (!name || !hazards || !storageLocation)
        return NextResponse.json(
          { error: "name, hazards and storageLocation required" },
          { status: 400 },
        );
      const chemicalNumber = await nextSeqNumber(
        "chemical",
        "chemicalNumber",
        "CHM",
      );
      result = await prisma.chemical.create({
        data: {
          chemicalNumber,
          name,
          casNumber: casNumber || null,
          hazards,
          storageLocation,
          quantityOnHand:
            quantityOnHand !== undefined && quantityOnHand !== null
              ? Number(quantityOnHand)
              : 0,
          unit: unit || "L",
          msdsFilePath: msdsFilePath || null,
          msdsReviewDate: msdsReviewDate ? new Date(msdsReviewDate) : null,
        },
      });
      await logAudit({
        actor,
        action: "CHEMICAL_CREATED",
        entityType: "CHEMICAL",
        entityId: result.id,
        details: `${chemicalNumber} · ${name} · stored ${storageLocation}`,
      });
    } else if (action === "update-chemical") {
      const c = await prisma.chemical.findUnique({ where: { id: data.id } });
      if (!c)
        return NextResponse.json(
          { error: "Chemical not found" },
          { status: 404 },
        );
      const patch: any = {};
      if (data.name !== undefined) patch.name = data.name;
      if (data.casNumber !== undefined)
        patch.casNumber = data.casNumber || null;
      if (data.hazards !== undefined) patch.hazards = data.hazards;
      if (data.storageLocation !== undefined)
        patch.storageLocation = data.storageLocation;
      if (data.quantityOnHand !== undefined && data.quantityOnHand !== null)
        patch.quantityOnHand = Number(data.quantityOnHand);
      if (data.unit !== undefined) patch.unit = data.unit;
      if (data.msdsFilePath !== undefined)
        patch.msdsFilePath = data.msdsFilePath || null;
      if (data.msdsReviewDate !== undefined)
        patch.msdsReviewDate = data.msdsReviewDate
          ? new Date(data.msdsReviewDate)
          : null;
      result = await prisma.chemical.update({
        where: { id: c.id },
        data: patch,
      });
      await logAudit({
        actor,
        action: "CHEMICAL_UPDATED",
        entityType: "CHEMICAL",
        entityId: c.id,
        details: `${c.chemicalNumber} · ${result.name}`,
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/chemicals error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
