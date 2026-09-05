import { logAuditTx } from "@/lib/audit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEPARTMENTS } from "@/lib/departments";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Helper to get raw department list from DB or fallback
async function getStoredDepartments() {
  const row = await prisma.setting.findUnique({ where: { key: "custom_departments_v2" } });
  if (row?.value) {
    try {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // fallback
    }
  }
  // Initialize with baseline departments catalog
  return DEPARTMENTS.map((d) => ({
    id: d.id,
    no: d.no,
    title: d.title,
    short: d.short,
    desc: d.desc,
    hub: d.hub,
    glow: d.glow,
    gradient: d.gradient,
    permissionKey: d.permissionKey,
    functions: d.functions.map((f) => ({
      name: f.name,
      desc: f.desc,
      href: f.href,
    })),
  }));
}

export async function GET() {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const departments = await getStoredDepartments();
    return NextResponse.json({ success: true, departments });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

// Create new custom department
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !can(user, "system.edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || "Admin";

    const { title, short, desc, hub, functions } = await req.json();
    if (!title || !short) {
      return NextResponse.json({ success: false, error: "Title and short name are required." }, { status: 400 });
    }

    const current = await getStoredDepartments();
    const id = "dept_" + short.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now().toString().slice(-4);

    const newDept = {
      id,
      no: current.length + 1,
      title,
      short,
      desc: desc || `Custom department for ${title}`,
      hub: hub || `/${id}`,
      glow: "rgba(59,130,246,0.35)",
      gradient: "from-blue-500 to-indigo-600",
      permissionKey: `${id}.view`,
      functions: Array.isArray(functions) ? functions : [],
    };

    const updated = [...current, newDept];

    await prisma.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: "custom_departments_v2" },
        update: { value: JSON.stringify(updated) },
        create: { key: "custom_departments_v2", value: JSON.stringify(updated) },
      });

      await logAuditTx(tx, {
        actor,
        action: "DEPARTMENTS_CONFIG_UPDATED",
        entityType: "Setting",
        details: `Created custom department "${title}" (${short})`,
      });
    });

    return NextResponse.json({ success: true, department: newDept, departments: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

// Update / Rename / Edit functions of an existing department
export async function PUT(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !can(user, "system.edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || "Admin";

    const { id, title, short, desc, hub, functions } = await req.json();
    if (!id) {
      return NextResponse.json({ success: false, error: "Department ID is required" }, { status: 400 });
    }

    const current = await getStoredDepartments();
    const index = current.findIndex((d: any) => d.id === id);
    if (index === -1) {
      return NextResponse.json({ success: false, error: "Department not found" }, { status: 404 });
    }

    current[index] = {
      ...current[index],
      title: title || current[index].title,
      short: short || current[index].short,
      desc: desc !== undefined ? desc : current[index].desc,
      hub: hub || current[index].hub,
      functions: Array.isArray(functions) ? functions : current[index].functions,
    };

    await prisma.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: "custom_departments_v2" },
        update: { value: JSON.stringify(current) },
        create: { key: "custom_departments_v2", value: JSON.stringify(current) },
      });

      await logAuditTx(tx, {
        actor,
        action: "DEPARTMENTS_CONFIG_UPDATED",
        entityType: "Setting",
        details: `Updated custom department "${current[index].title}"`,
      });
    });

    return NextResponse.json({ success: true, department: current[index], departments: current });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

// Delete / Remove department
export async function DELETE(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isOwner && !can(user, "system.edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const actor = user.name || "Admin";

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "ID required" }, { status: 400 });
    }

    const current = await getStoredDepartments();
    const filtered = current.filter((d: any) => d.id !== id);

    await prisma.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: "custom_departments_v2" },
        update: { value: JSON.stringify(filtered) },
        create: { key: "custom_departments_v2", value: JSON.stringify(filtered) },
      });

      await logAuditTx(tx, {
        actor,
        action: "DEPARTMENTS_CONFIG_UPDATED",
        entityType: "Setting",
        details: `Deleted custom department ${id}`,
        severity: "WARN",
      });
    });

    return NextResponse.json({ success: true, departments: filtered });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
