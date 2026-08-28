import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel } from "@/lib/managerGate";
import { logAudit } from "@/lib/audit";
import { nextSeqNumber } from "@/lib/seqNumbers";

export const maxDuration = 60;

const MANIFEST_STATUSES = ["GENERATED", "IN_TRANSIT", "DISPOSED"];
const NEXT_STATUS: Record<string, string> = {
  GENERATED: "IN_TRANSIT",
  IN_TRANSIT: "DISPOSED",
};

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

    const manifests = await prisma.hazWasteManifest.findMany({
      orderBy: { date: "desc" },
      take: 500,
    });
    const byMonth: Record<string, number> = {};
    manifests.forEach((m) => {
      const key = new Date(m.date).toISOString().slice(0, 7);
      byMonth[key] = (byMonth[key] || 0) + m.quantityKg;
    });
    const stats = {
      total: manifests.length,
      totalKg: manifests.reduce((s, m) => s + m.quantityKg, 0),
      hazardous: manifests.filter((m) => m.category === "HAZARDOUS").length,
      inTransit: manifests.filter((m) => m.status === "IN_TRANSIT").length,
      awaitingDisposal: manifests.filter((m) => m.status === "GENERATED")
        .length,
      byMonth: Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])),
    };
    return NextResponse.json({ manifests, stats, statuses: MANIFEST_STATUSES });
  } catch (error) {
    console.error("GET /api/haz-waste error:", error);
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
    if (action === "create-manifest") {
      const {
        date,
        wasteType,
        category,
        quantityKg,
        transporter,
        destination,
        notes,
      } = data;
      if (!wasteType || !transporter || !destination)
        return NextResponse.json(
          { error: "wasteType, transporter and destination required" },
          { status: 400 },
        );
      const manifestNumber = await nextSeqNumber(
        "hazWasteManifest",
        "manifestNumber",
        "MHW",
      );
      result = await prisma.hazWasteManifest.create({
        data: {
          manifestNumber,
          date: date ? new Date(date) : new Date(),
          wasteType,
          category:
            category === "NON_HAZARDOUS" ? "NON_HAZARDOUS" : "HAZARDOUS",
          quantityKg:
            quantityKg !== undefined && quantityKg !== null
              ? Number(quantityKg)
              : 0,
          transporter,
          destination,
          notes: notes || null,
        },
      });
      await logAudit({
        actor,
        action: "WASTE_MANIFEST_CREATED",
        entityType: "HAZ_WASTE",
        entityId: result.id,
        details: `${manifestNumber} · ${wasteType} ${result.quantityKg}kg → ${destination}`,
      });
    } else if (action === "advance-manifest") {
      const m = await prisma.hazWasteManifest.findUnique({
        where: { id: data.id },
      });
      if (!m)
        return NextResponse.json(
          { error: "Manifest not found" },
          { status: 404 },
        );
      const next = NEXT_STATUS[m.status];
      if (!next)
        return NextResponse.json(
          { error: "Manifest already disposed" },
          { status: 400 },
        );
      result = await prisma.hazWasteManifest.update({
        where: { id: m.id },
        data: { status: next as any },
      });
      await logAudit({
        actor,
        action: "WASTE_MANIFEST_ADVANCED",
        entityType: "HAZ_WASTE",
        entityId: m.id,
        details: `${m.manifestNumber} · ${m.status} → ${next}`,
      });
    } else if (action === "update-manifest") {
      const m = await prisma.hazWasteManifest.findUnique({
        where: { id: data.id },
      });
      if (!m)
        return NextResponse.json(
          { error: "Manifest not found" },
          { status: 404 },
        );
      const patch: any = {};
      if (data.wasteType !== undefined) patch.wasteType = data.wasteType;
      if (data.category !== undefined)
        patch.category =
          data.category === "NON_HAZARDOUS" ? "NON_HAZARDOUS" : "HAZARDOUS";
      if (data.quantityKg !== undefined && data.quantityKg !== null)
        patch.quantityKg = Number(data.quantityKg);
      if (data.transporter !== undefined) patch.transporter = data.transporter;
      if (data.destination !== undefined) patch.destination = data.destination;
      if (data.notes !== undefined) patch.notes = data.notes || null;
      result = await prisma.hazWasteManifest.update({
        where: { id: m.id },
        data: patch,
      });
      await logAudit({
        actor,
        action: "WASTE_MANIFEST_UPDATED",
        entityType: "HAZ_WASTE",
        entityId: m.id,
        details: `${m.manifestNumber} · ${result.wasteType}`,
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/haz-waste error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
