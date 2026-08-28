import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const FIXTURE_STATUSES = ["AVAILABLE", "UNDER_MAINT", "MISSING"];

async function canEdit(user: any): Promise<boolean> {
  return !!(
    user.isOwner ||
    canAny(user, ["engineering.edit", "maintenance.edit", "system.edit"])
  );
}

export async function GET() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    !user.isOwner &&
    !canAny(user, [
      "engineering.view",
      "maintenance.view",
      "system.view",
      "ops.view",
    ])
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const fixtures = await prisma.fixture.findMany({
      include: {
        product: { select: { sku: true, name: true } },
        machine: { select: { code: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { code: "asc" }],
    });
    const products = await prisma.product.findMany({
      select: { id: true, sku: true, name: true },
      where: { isActive: true },
    });
    const machines = await prisma.machine.findMany({
      select: { id: true, code: true, name: true },
    });
    return NextResponse.json({
      fixtures,
      products,
      machines,
      statuses: FIXTURE_STATUSES,
    });
  } catch (error) {
    console.error("GET /api/fixtures error:", error);
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
  if (!(await canEdit(user)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { action, data } = body;
    if (!action || !data)
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );
    let result: any;

    if (action === "create") {
      const { code, name } = data;
      if (!code || !name)
        return NextResponse.json(
          { error: "code and name required" },
          { status: 400 },
        );
      if (!FIXTURE_STATUSES.includes(data.status || "AVAILABLE")) {
        return NextResponse.json(
          { error: "Invalid fixture status" },
          { status: 400 },
        );
      }
      result = await prisma.fixture.create({
        data: {
          code,
          name,
          productId: data.productId || null,
          machineId: data.machineId || null,
          status: data.status || "AVAILABLE",
          location: data.location || null,
          procurementCost:
            data.procurementCost === "" || data.procurementCost === undefined
              ? null
              : Number(data.procurementCost),
          notes: data.notes || null,
        },
      });
      await logAudit({
        actor: user.name || "Admin",
        action: "FIXTURE_CREATED",
        entityType: "FIXTURE",
        entityId: result.id,
        details: `${code} — ${name} (${result.status})`,
      });
    } else if (action === "update") {
      const { id, ...rest } = data;
      const existing = await prisma.fixture.findUnique({ where: { id } });
      if (!existing)
        return NextResponse.json(
          { error: "Fixture not found" },
          { status: 404 },
        );
      const payload: any = { ...rest };
      if (
        payload.status !== undefined &&
        !FIXTURE_STATUSES.includes(payload.status)
      ) {
        return NextResponse.json(
          { error: "Invalid fixture status" },
          { status: 400 },
        );
      }
      if (
        payload.procurementCost === "" ||
        payload.procurementCost === undefined
      )
        payload.procurementCost = null;
      else if (typeof payload.procurementCost === "string")
        payload.procurementCost = Number(payload.procurementCost);
      delete payload.id;
      result = await prisma.fixture.update({ where: { id }, data: payload });
      await logAudit({
        actor: user.name || "Admin",
        action: "FIXTURE_UPDATED",
        entityType: "FIXTURE",
        entityId: id,
        details: `${result.code} → ${result.status}${payload.procurementCost ? ` (tooling ₹${payload.procurementCost})` : ""}`,
      });
    } else if (action === "delete") {
      const existing = await prisma.fixture.findUnique({
        where: { id: data.id },
      });
      if (!existing)
        return NextResponse.json(
          { error: "Fixture not found" },
          { status: 404 },
        );
      await prisma.fixture.delete({ where: { id: data.id } });
      await logAudit({
        actor: user.name || "Admin",
        action: "FIXTURE_DELETED",
        entityType: "FIXTURE",
        entityId: data.id,
        details: `${existing.code} — ${existing.name}`,
      });
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error("POST /api/fixtures error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
