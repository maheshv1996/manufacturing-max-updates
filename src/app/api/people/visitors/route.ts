import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { parseOr400 } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "people.view"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [visits, inSite] = await Promise.all([
      prisma.visitorLog.findMany({ orderBy: { checkInAt: "desc" }, take: 200 }),
      prisma.visitorLog.count({ where: { status: "IN_SITE" } }),
    ]);

    return NextResponse.json({
      success: true,
      visitors: visits,
      stats: {
        total: visits.length,
        inSite,
        today: visits.filter((v) => new Date(v.checkInAt).toDateString() === new Date().toDateString()).length,
      },
    });
  } catch (error) {
    console.error("GET /api/people/visitors error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

const checkInSchema = z.object({
  visitorName: z.string().min(1).max(150).transform((s) => s.trim()),
  company: z.string().max(150).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  purpose: z.string().max(300).optional().nullable(),
  hostName: z.string().max(150).optional().nullable(),
  vehicleNumber: z.string().max(30).optional().nullable(),
  idProofType: z.string().max(50).optional().nullable(),
  idProofNumber: z.string().max(60).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id || (!user.isOwner && !can(user, "people.edit"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || user.id || "Gate";

    const body = await req.json();
    const parsed = parseOr400(checkInSchema, body);
    if (!parsed.ok) return parsed.response;
    const d = parsed.data;

    const visit = await prisma.visitorLog.create({
      data: {
        visitorName: d.visitorName,
        company: d.company || null,
        phone: d.phone || null,
        purpose: d.purpose || null,
        hostName: d.hostName || null,
        vehicleNumber: d.vehicleNumber || null,
        idProofType: d.idProofType || null,
        idProofNumber: d.idProofNumber || null,
        notes: d.notes || null,
        status: "IN_SITE",
        createdBy: actor,
      },
    });

    await logAudit({
      actor,
      action: "VISITOR_CHECKED_IN",
      entityType: "VisitorLog",
      entityId: visit.id,
      details: `${d.visitorName}${d.company ? " (" + d.company + ")" : ""} checked in${d.hostName ? " to see " + d.hostName : ""}`,
    });

    return NextResponse.json({ success: true, visitor: visit });
  } catch (error) {
    console.error("POST /api/people/visitors error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}