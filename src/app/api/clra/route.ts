import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { requireManagerLevel } from "@/lib/managerGate";
import { logAuditTx } from "@/lib/audit";
import { nextSeqNumber } from "@/lib/seqNumbers";

export const maxDuration = 60;

export async function GET(_req: Request) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const gate =
      canAny(user, ["people.view", "people.edit", "system.edit"]) ||
      user.isOwner;
    if (!gate)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const [contractors, labour] = await Promise.all([
      prisma.contractor.findMany({
        include: { labour: { where: { isActive: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.contractLabourRecord.findMany({
        include: { contractor: { select: { id: true, name: true } } },
        orderBy: { joinedAt: "desc" },
        take: 500,
      }),
    ]);
    const now = Date.now();
    const DAY = 86400000;
    const enriched = contractors.map((c) => {
      const daysLeft = Math.ceil(
        (new Date(c.licenseValidUntil).getTime() - now) / DAY,
      );
      const status =
        daysLeft < 0 ? "EXPIRED" : daysLeft <= 90 ? "EXPIRING" : "VALID";
      return {
        ...c,
        activeLabour: c.labour.length,
        licenseStatus: status,
        daysLeft,
      };
    });
    const stats = {
      contractors: contractors.length,
      activeLabour: enriched.reduce((s, c) => s + c.activeLabour, 0),
      expiring: enriched.filter((c) => c.licenseStatus === "EXPIRING").length,
      expired: enriched.filter((c) => c.licenseStatus === "EXPIRED").length,
    };
    return NextResponse.json({ contractors: enriched, labour, stats });
  } catch (error) {
    console.error("GET /api/clra error:", error);
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
      canAny(user, ["people.edit", "hr.edit", "system.edit"]);
    if (!canEdit)
      return NextResponse.json(
        { error: "Requires manager, hr.edit, or people.edit" },
        { status: 403 },
      );

    let result: any;
    if (action === "create-contractor") {
      const {
        name,
        licenseNumber,
        licenseValidUntil,
        gstin,
        address,
        phone,
        notes,
      } = data;
      if (!name || !licenseNumber || !licenseValidUntil)
        return NextResponse.json(
          { error: "name, licenseNumber and licenseValidUntil required" },
          { status: 400 },
        );
      const code = await nextSeqNumber("contractor", "code", "CNT");
      result = await prisma.$transaction(async (tx) => {
        const created = await tx.contractor.create({
          data: {
            name,
            code,
            licenseNumber,
            licenseValidUntil: new Date(licenseValidUntil),
            gstin: gstin || null,
            address: address || null,
            phone: phone || null,
            notes: notes || null,
          },
        });
        await logAuditTx(tx, {
          actor,
          action: "CLRA_CONTRACTOR_CREATED",
          entityType: "CONTRACTOR",
          entityId: created.id,
          details: `${created.code} · ${name} · licence ${licenseNumber}`,
        });
        return created;
      });
    } else if (action === "update-contractor") {
      const c = await prisma.contractor.findUnique({ where: { id: data.id } });
      if (!c)
        return NextResponse.json(
          { error: "Contractor not found" },
          { status: 404 },
        );
      const patch: any = {};
      if (data.name !== undefined) patch.name = data.name;
      if (data.licenseNumber !== undefined)
        patch.licenseNumber = data.licenseNumber;
      if (data.licenseValidUntil !== undefined)
        patch.licenseValidUntil = new Date(data.licenseValidUntil);
      if (data.gstin !== undefined) patch.gstin = data.gstin || null;
      if (data.address !== undefined) patch.address = data.address || null;
      if (data.phone !== undefined) patch.phone = data.phone || null;
      if (data.notes !== undefined) patch.notes = data.notes || null;
      if (data.isActive !== undefined) patch.isActive = Boolean(data.isActive);
      result = await prisma.$transaction(async (tx) => {
        const updated = await tx.contractor.update({
          where: { id: c.id },
          data: patch,
        });
        await logAuditTx(tx, {
          actor,
          action: "CLRA_CONTRACTOR_UPDATED",
          entityType: "CONTRACTOR",
          entityId: c.id,
          details: `${c.code} · ${c.name}`,
        });
        return updated;
      });
    } else if (action === "create-labour") {
      const {
        contractorId,
        name,
        workType,
        wagePerDay,
        joinedAt,
        aadharLast4,
      } = data;
      if (!contractorId || !name || !workType || !joinedAt)
        return NextResponse.json(
          { error: "contractorId, name, workType and joinedAt required" },
          { status: 400 },
        );
      const c = await prisma.contractor.findUnique({
        where: { id: contractorId },
      });
      if (!c)
        return NextResponse.json(
          { error: "Contractor not found" },
          { status: 404 },
        );
      result = await prisma.$transaction(async (tx) => {
        const created = await tx.contractLabourRecord.create({
          data: {
            contractorId,
            name,
            workType,
            wagePerDay:
              wagePerDay !== undefined && wagePerDay !== null
                ? Number(wagePerDay)
                : 0,
            joinedAt: new Date(joinedAt),
            aadharLast4: aadharLast4 || null,
          },
        });
        await logAuditTx(tx, {
          actor,
          action: "CLRA_LABOUR_CREATED",
          entityType: "CONTRACT_LABOUR",
          entityId: created.id,
          details: `${c.name} · ${name} · ${workType}`,
        });
        return created;
      });
    } else if (action === "update-labour") {
      const r = await prisma.contractLabourRecord.findUnique({
        where: { id: data.id },
      });
      if (!r)
        return NextResponse.json(
          { error: "Labour record not found" },
          { status: 404 },
        );
      const patch: any = {};
      if (data.leftAt !== undefined && data.leftAt !== null) {
        patch.leftAt = new Date(data.leftAt);
        patch.isActive = false;
      } else if (data.leftAt === null) {
        patch.leftAt = null;
        patch.isActive = true;
      }
      if (data.workType !== undefined) patch.workType = data.workType;
      if (data.wagePerDay !== undefined && data.wagePerDay !== null)
        patch.wagePerDay = Number(data.wagePerDay);
      if (data.name !== undefined) patch.name = data.name;
      result = await prisma.$transaction(async (tx) => {
        const updated = await tx.contractLabourRecord.update({
          where: { id: r.id },
          data: patch,
        });
        await logAuditTx(tx, {
          actor,
          action: "CLRA_LABOUR_UPDATED",
          entityType: "CONTRACT_LABOUR",
          entityId: r.id,
          details: `${updated.name} · ${updated.leftAt ? "left" : "edited"}`,
        });
        return updated;
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/clra error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
