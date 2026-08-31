import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const roles = await prisma.role.findMany({
      include: {
        users: {
          select: { id: true, name: true, username: true, email: true },
        },
      },
    });

    const permissionsCatalog = [
      {
        category: "Production & Shopfloor",
        keys: [
          { key: "ops.view", name: "View Production Orders & Schedule", desc: "Access PPC, floor travelers & queue" },
          { key: "ops.edit", name: "Create & Update Work Orders", desc: "Release batches, edit routing steps" },
          { key: "ops.approve", name: "Manager PPC Override & Approvals", desc: "Authorized to override priority" },
          { key: "terminal.use", name: "Shopfloor Touch Kiosk Access", desc: "Clock into operations, log cycle time" },
        ],
      },
      {
        category: "Quality Assurance & Metrology",
        keys: [
          { key: "quality.view", name: "View Inspection Plans & SPC", desc: "Read-only access to quality dashboards" },
          { key: "quality.edit", name: "Log Dimension Measurements", desc: "Enter micrometer, CMM readings" },
          { key: "quality.approve", name: "Sign AS9102 FAI & Release Batches", desc: "Authorize Certificates of Conformance" },
          { key: "metrology.view", name: "Access Tool Calibration Lab", desc: "View NABL gage expiry registers" },
        ],
      },
      {
        category: "Supply Chain & Tool Crib",
        keys: [
          { key: "supply.view", name: "View Inventory & Stock Balances", desc: "Raw alloy billets, tools, spares" },
          { key: "supply.edit", name: "Create Material Requisitions & GRN", desc: "Inward shipments, material issue" },
          { key: "supply.approve", name: "Approve Purchase Orders (POs)", desc: "Authorized signature on supplier orders" },
          { key: "supply.gate_pass", name: "Issue Security Gate Passes (RGP)", desc: "Authorize outward material movement" },
        ],
      },
      {
        category: "Engineering & CAM",
        keys: [
          { key: "engineering.view", name: "View 3D CAD Models & BOMs", desc: "Inspect STEP models & assemblies" },
          { key: "engineering.edit", name: "Edit G-Code, Speeds & Fixtures", desc: "CAM optimizer and tool crib life" },
          { key: "engineering.approve", name: "Approve Engineering Change (ECO)", desc: "Sign off BOM revisions" },
        ],
      },
      {
        category: "Maintenance & EHS Safety",
        keys: [
          { key: "maintenance.view", name: "View Spindle Health & PM Schedules", desc: "Weibull RUL & breakdown board" },
          { key: "maintenance.edit", name: "Log Machine Breakdowns & PM Tasks", desc: "Overhaul tickets & coolant Brix" },
          { key: "ehs.view", name: "View Safety Permits & Consents", desc: "Read-only access to PCB & permits" },
          { key: "ehs.approve", name: "Issue Hot/Height Work Safety Permits", desc: "Authorized EHS Officer sign-off" },
        ],
      },
      {
        category: "Finance & Executive Governance",
        keys: [
          { key: "finance.view", name: "View Activity-Based Job Costing", desc: "Actual machine power & tool margin" },
          { key: "finance.edit", name: "Post Accounting Vouchers & Invoices", desc: "GSTR recon, debit/credit notes" },
          { key: "users.manage", name: "Manage System Users & Custom Roles", desc: "Master Administrator rights" },
          { key: "reports.print", name: "Export & Print Statutory Reports", desc: "PF/ESI challans, audit packs" },
        ],
      },
    ];

    return NextResponse.json({ success: true, roles, permissionsCatalog });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
    await logAudit({ actor: "system", action: "ROLE_SAVED", entityType: "Role", details: "Role created or updated" });
  try {
    const { name, departmentName, description, permissions } = await req.json();

    if (!name) {
      return NextResponse.json({ success: false, error: "Role name is required" }, { status: 400 });
    }

    const created = await prisma.role.create({
      data: {
        name,
        description: description || `Custom role for ${departmentName || "General"}`,
        permissions: permissions || [],
      },
    });

    return NextResponse.json({ success: true, role: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
