import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { toPaiseRow, fromPaiseRow, fromPaiseRows } from "@/lib/money";

// Map URL entity keys to the actual Prisma model names (plural route key -> camelCase model).
// Entities whose rows store fixed-point paise → rupee contract at the API edge.
const MONEY_MODEL_BY_ENTITY: Record<string, string> = {
  treasuryTransactions: "TreasuryTransaction",
  budgetLines: "BudgetLine",
};

const ENTITY_MODELS: Record<string, string> = {
  statutoryContributions: "statutoryContribution",
  healthChecks: "healthCheckRecord",
  environmentalRecords: "environmentalRecord",
  fireDrills: "fireDrillRecord",
  eximShipments: "eximShipment",
  investorUpdates: "investorUpdate",
  budgetLines: "budgetLine",
  treasuryTransactions: "treasuryTransaction",
  utilityReadings: "utilityReading",
  spareParts: "sparePart",
  contracts: "contract",
  infrastructureAssets: "infrastructureAsset",
  backupJobs: "backupJob",
  binLocations: "binLocation",
  rateContracts: "rateContract",
  freightVendors: "freightVendor",
};

// Whitelisted writable fields per entity (no mass assignment of id/createdAt/updatedAt).
const ENTITY_FIELDS: Record<string, string[]> = {
  statutoryContributions: [
    "employeeName",
    "employeeCode",
    "month",
    "pfNumber",
    "esiNumber",
    "pfWage",
    "pfEmployee",
    "pfEmployer",
    "esiWage",
    "esiEmployee",
    "esiEmployer",
    "notes",
  ],
  healthChecks: [
    "employeeName",
    "employeeCode",
    "checkDate",
    "bloodPressure",
    "vision",
    "audiometry",
    "weightKg",
    "fitnessStatus",
    "notes",
    "conductedBy",
  ],
  environmentalRecords: [
    "recordType",
    "title",
    "description",
    "permitNumber",
    "complianceStatus",
    "recordedAt",
    "dueDate",
    "owner",
  ],
  fireDrills: [
    "drillDate",
    "location",
    "participants",
    "durationMin",
    "passed",
    "notes",
    "conductedBy",
  ],
  eximShipments: [
    "shipmentNumber",
    "shipmentType",
    "mode",
    "incoterm",
    "port",
    "invoiceNumber",
    "workOrderId",
    "customerName",
    "customsValue",
    "currency",
    "shipmentDate",
    "status",
    "notes",
    "vesselName",
    "voyageNo",
    "blNumber",
    "bookingDate",
    "sailingDate",
    "customsClearDate",
    "arrivalDate",
    "docCi",
    "docPl",
    "docCoO",
    "docBl",
  ],
  investorUpdates: [
    "quarter",
    "headline",
    "revenue",
    "ebitda",
    "netProfit",
    "ordersBooked",
    "summary",
    "publishedAt",
  ],
  budgetLines: [
    "fiscalYear",
    "department",
    "category",
    "allocated",
    "spent",
    "notes",
  ],
  treasuryTransactions: [
    "date",
    "type",
    "account",
    "amount",
    "reference",
    "category",
    "notes",
  ],
  utilityReadings: [
    "utilityType",
    "meterName",
    "reading",
    "unit",
    "cost",
    "readAt",
    "notes",
  ],
  spareParts: [
    "sku",
    "name",
    "machineCode",
    "currentQty",
    "minQty",
    "unitCost",
    "supplierName",
    "location",
    "notes",
  ],
  contracts: [
    "contractNumber",
    "customerName",
    "projectId",
    "title",
    "value",
    "currency",
    "startDate",
    "endDate",
    "poReference",
    "status",
    "notes",
  ],
  infrastructureAssets: [
    "assetType",
    "name",
    "ipAddress",
    "location",
    "status",
    "warrantyUntil",
    "notes",
  ],
  backupJobs: [
    "startedAt",
    "completedAt",
    "status",
    "sizeMb",
    "target",
    "notes",
  ],
  binLocations: [
    "warehouse",
    "zone",
    "location",
    "rawMaterialId",
    "qty",
    "notes",
  ],
  rateContracts: [
    "contractNumber",
    "rawMaterialId",
    "supplierId",
    "rate",
    "validFrom",
    "validTo",
    "status",
    "notes",
  ],
  freightVendors: [
    "name",
    "contactPerson",
    "phone",
    "email",
    "city",
    "lanes",
    "rating",
    "isApproved",
    "notes",
  ],
};

const NUMERIC_FIELDS = new Set([
  "pfWage",
  "pfEmployee",
  "pfEmployer",
  "esiWage",
  "esiEmployee",
  "esiEmployer",
  "weightKg",
  "customsValue",
  "value",
  "allocated",
  "spent",
  "amount",
  "reading",
  "cost",
  "currentQty",
  "minQty",
  "unitCost",
  "participants",
  "durationMin",
  "sizeMb",
  "revenue",
  "ebitda",
  "netProfit",
  "ordersBooked",
  "qty",
  "rate",
  "rating",
]);

const BOOLEAN_FIELDS = new Set([
  "passed",
  "docCi",
  "docPl",
  "docCoO",
  "docBl",
  "isApproved",
]);

const DATE_FIELDS = new Set([
  "checkDate",
  "recordedAt",
  "dueDate",
  "drillDate",
  "shipmentDate",
  "publishedAt",
  "date",
  "startDate",
  "endDate",
  "warrantyUntil",
  "startedAt",
  "completedAt",
  "readAt",
  "bookingDate",
  "sailingDate",
  "customsClearDate",
  "arrivalDate",
  "validFrom",
  "validTo",
]);

function coerce(fields: string[], data: any): any {
  const out: any = {};
  for (const f of fields) {
    if (data[f] === undefined) continue;
    const val = data[f];
    if (NUMERIC_FIELDS.has(f)) {
      out[f] =
        val === "" || val === null || val === undefined ? 0 : Number(val);
    } else if (DATE_FIELDS.has(f)) {
      if (val) out[f] = new Date(val); // skip empty so model @default(now()) applies
    } else if (BOOLEAN_FIELDS.has(f)) {
      out[f] = val === true || val === "true" || val === 1 ? true : false;
    } else {
      out[f] = val === "" ? null : val;
    }
  }
  return out;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ entity: string }> },
) {
  const { entity } = await params;
  const model = ENTITY_MODELS[entity];
  if (!model || !ENTITY_FIELDS[entity]) {
    return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
  }
  try {
    const rows = await (prisma as any)[model].findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    // Entities storing fixed-point paise expose the rupee contract.
    const moneyModel = MONEY_MODEL_BY_ENTITY[entity];
    return NextResponse.json({
      rows: moneyModel ? fromPaiseRows(moneyModel, rows) : rows,
    });
  } catch (error) {
    console.error(`GET /api/register/${entity} error:`, error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ entity: string }> },
) {
  const { entity } = await params;
  const model = ENTITY_MODELS[entity];
  if (!model || !ENTITY_FIELDS[entity]) {
    return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
  }

  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (
    !user.isOwner &&
    !canAny(user, ["system.edit", "ops.edit", "commercial.edit", "people.edit"])
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action, data } = body;

    if (!action || !data) {
      return NextResponse.json(
        { error: "Missing action or data" },
        { status: 400 },
      );
    }

    let result: any;
    const moneyModel = MONEY_MODEL_BY_ENTITY[entity];
    const toStorage = (d: any) =>
      moneyModel ? toPaiseRow(moneyModel, coerce(ENTITY_FIELDS[entity], d)) : coerce(ENTITY_FIELDS[entity], d);
    if (action === "create") {
      result = await (prisma as any)[model].create({
        data: toStorage(data),
      });
    } else if (action === "update") {
      if (!data.id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }
      result = await (prisma as any)[model].update({
        where: { id: data.id },
        data: toStorage(data),
      });
    } else if (action === "delete") {
      if (!data.id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }
      result = await (prisma as any)[model].delete({ where: { id: data.id } });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await logAudit({
      actor: user.name || "Admin",
      action: `${action.toUpperCase()}_${entity.toUpperCase()}`,
      entityType: entity.toUpperCase(),
      entityId: result?.id || data?.id || "unknown",
      details: `${user.name || "Admin"} ${action} on ${entity}`,
    });

    // Mirror the GET contract: money-model rows expose rupees, never raw paise.
    const out = moneyModel && result && typeof result === "object" ? fromPaiseRow(moneyModel, result) : result;
    return NextResponse.json({ success: true, record: out });
  } catch (error) {
    console.error(`POST /api/register/${entity} error:`, error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
