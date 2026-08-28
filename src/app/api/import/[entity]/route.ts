import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { importEntityByKey, type ImportEntity } from "@/lib/importConfig";

export const maxDuration = 60;

type Row = Record<string, unknown>;

interface RowCheck {
  index: number;
  valid: boolean;
  errors: string[];
  existing: boolean;
}

// ---------------------------------------------------------------------------
// Field whitelists (mirror of the register route's ENTITY_FIELDS pattern —
// never trust client keys; only these exact fields may be written).
// ---------------------------------------------------------------------------
const STORE_FIELDS: Record<string, string[]> = {
  products: [
    "sku",
    "name",
    "unit",
    "description",
    "targetCycleTimeSeconds",
    "materialCostPerUnit",
    "sellingPricePerUnit",
    "isActive",
  ],
  customers: [
    "name",
    "code",
    "contactPerson",
    "email",
    "phone",
    "address",
    "city",
    "state",
    "gstin",
    "isActive",
  ],
  suppliers: [
    "name",
    "gstin",
    "state",
    "code",
    "contactPerson",
    "email",
    "phone",
    "contactPhone",
    "rating",
    "leadTimeDays",
    "paymentTerms",
    "isApproved",
    "isActive",
  ],
};

const NUMERIC_FIELDS = new Set([
  "targetCycleTimeSeconds",
  "materialCostPerUnit",
  "sellingPricePerUnit",
  "rating",
  "leadTimeDays",
  "qtyPerUnit",
]);

const BOOLEAN_FIELDS = new Set(["isActive", "isApproved"]);

function parseBoolean(v: unknown): boolean | null {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n", ""].includes(s)) return false;
  return null;
}

function parseNumber(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  const n = Number(String(v).trim());
  return isFinite(n) ? n : null;
}

function cell(row: Row, key: string): string {
  const v = row[key];
  return v === undefined || v === null ? "" : String(v).trim();
}

/**
 * Coerce a validated row into a whitelisted create/update payload.
 * Empty cells are OMITTED (not nulled): on create the model defaults apply
 * (e.g. Supplier rating=5, paymentTerms=NET30), on update existing values are
 * preserved — blank means "not provided", never "wipe it".
 */
function coerceStored(entityKey: string, row: Row): Record<string, unknown> {
  const fields = STORE_FIELDS[entityKey] || [];
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const val = cell(row, f);
    if (val === "") continue;
    if (NUMERIC_FIELDS.has(f)) {
      const n = parseNumber(val);
      if (n !== null) out[f] = n;
    } else if (BOOLEAN_FIELDS.has(f)) {
      const b = parseBoolean(val);
      if (b !== null) out[f] = b;
    } else {
      out[f] = val;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-entity validation
// ---------------------------------------------------------------------------
async function validateRow(
  entity: ImportEntity,
  row: Row,
  ctx: {
    inFileKeys: Set<string>;
    existingKeys: Set<string>;
    productBySku: Map<string, string>;
    materialBySku: Map<string, string>;
    existingBomKeys: Set<string>;
  },
): Promise<RowCheck> {
  const errors: string[] = [];

  for (const col of entity.columns) {
    const val = cell(row, col.key);
    if (col.required && val === "") {
      errors.push(`${col.label} is required`);
      continue;
    }
    if (col.numeric && val !== "") {
      const n = parseNumber(val);
      if (n === null) errors.push(`${col.label} must be a number`);
      else if (col.key === "qtyPerUnit" && n <= 0)
        errors.push(`${col.label} must be greater than 0`);
      else if (col.key === "rating" && (n < 1 || n > 5))
        errors.push(`${col.label} must be between 1 and 5`);
    }
    if (col.boolean && val !== "" && parseBoolean(val) === null) {
      errors.push(`${col.label} must be true/false`);
    }
  }

  // Duplicate detection (in-file + against the database) on the natural key.
  let key = "";
  if (entity.key === "products") key = cell(row, "sku").toLowerCase();
  else if (entity.key === "customers" || entity.key === "suppliers")
    key = cell(row, "name").toLowerCase();
  else if (entity.key === "boms")
    key =
      `${cell(row, "productSku")}|${cell(row, "materialSku")}`.toLowerCase();

  if (key) {
    if (ctx.inFileKeys.has(key))
      errors.push("Duplicate row in file (same key appears twice)");
    else ctx.inFileKeys.add(key);
  }

  // BOM lookups: product & material must exist (resolved by SKU).
  if (entity.key === "boms") {
    const pSku = cell(row, "productSku");
    const mSku = cell(row, "materialSku");
    if (pSku && !ctx.productBySku.has(pSku))
      errors.push(`Product SKU "${pSku}" not found`);
    if (mSku && !ctx.materialBySku.has(mSku))
      errors.push(`Material SKU "${mSku}" not found`);
  }

  const existing = key ? ctx.existingKeys.has(key) : false;
  if (!existing && entity.key === "boms" && key) {
    // BOM duplicate-by-existing uses the resolved ids, so compare separately.
    const pSku = cell(row, "productSku");
    const mSku = cell(row, "materialSku");
    const pid = ctx.productBySku.get(pSku);
    const mid = ctx.materialBySku.get(mSku);
    if (pid && mid && ctx.existingBomKeys.has(`${pid}|${mid}`)) {
      // not an error — the upsert updates the existing BOM line
      return { index: 0, valid: errors.length === 0, errors, existing: true };
    }
  }

  return { index: 0, valid: errors.length === 0, errors, existing };
}

/** Load DB context needed for dup checks + BOM SKU resolution. */
async function buildContext(entityKey: string, rows: Row[]) {
  const ctx = {
    inFileKeys: new Set<string>(),
    existingKeys: new Set<string>(),
    productBySku: new Map<string, string>(),
    materialBySku: new Map<string, string>(),
    existingBomKeys: new Set<string>(),
  };

  if (entityKey === "products") {
    const skus = rows.map((r) => cell(r, "sku")).filter(Boolean);
    if (skus.length) {
      const found = await prisma.product.findMany({
        where: { sku: { in: skus } },
        select: { sku: true },
      });
      for (const f of found) ctx.existingKeys.add(f.sku.toLowerCase());
    }
  } else if (entityKey === "customers" || entityKey === "suppliers") {
    const names = rows.map((r) => cell(r, "name")).filter(Boolean);
    if (names.length) {
      const model = entityKey === "customers" ? "customer" : "supplier";
      const found = await (prisma as any)[model].findMany({
        where: { name: { in: names, mode: "insensitive" } },
        select: { name: true },
      });
      for (const f of found) ctx.existingKeys.add(f.name.toLowerCase());
    }
  } else if (entityKey === "boms") {
    const pSkus = [
      ...new Set(rows.map((r) => cell(r, "productSku")).filter(Boolean)),
    ];
    const mSkus = [
      ...new Set(rows.map((r) => cell(r, "materialSku")).filter(Boolean)),
    ];
    if (pSkus.length) {
      const products = await prisma.product.findMany({
        where: { sku: { in: pSkus } },
        select: { id: true, sku: true },
      });
      for (const p of products) ctx.productBySku.set(p.sku, p.id);
    }
    if (mSkus.length) {
      const mats = await prisma.rawMaterial.findMany({
        where: { sku: { in: mSkus } },
        select: { id: true, sku: true },
      });
      for (const m of mats) ctx.materialBySku.set(m.sku, m.id);
    }
    if (ctx.productBySku.size && ctx.materialBySku.size) {
      const lines = await prisma.bomLine.findMany({
        where: {
          productId: { in: [...ctx.productBySku.values()] },
          rawMaterialId: { in: [...ctx.materialBySku.values()] },
        },
        select: { productId: true, rawMaterialId: true },
      });
      for (const l of lines)
        ctx.existingBomKeys.add(`${l.productId}|${l.rawMaterialId}`);
    }
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
export async function GET(
  req: Request,
  { params }: { params: Promise<{ entity: string }> },
) {
  const { entity: key } = await params;
  if (!importEntityByKey(key))
    return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "system.edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // GET ?check=1 returns the existing codes/names so the client can flag
  // duplicates against the DB before upload. (Full per-row validation still
  // runs server-side via POST ?check=1 — GET bodies are unreliable in Next.)
  if (new URL(req.url).searchParams.get("check") === "1") {
    try {
      const existing: string[] = [];
      if (key === "products" || key === "boms") {
        const rows = await prisma.product.findMany({
          select: { sku: true },
          orderBy: { sku: "asc" },
          take: 2000,
        });
        existing.push(...rows.map((r) => r.sku));
      } else if (key === "customers") {
        const rows = await prisma.customer.findMany({
          select: { name: true },
          orderBy: { name: "asc" },
          take: 2000,
        });
        existing.push(...rows.map((r) => r.name));
      } else if (key === "suppliers") {
        const rows = await prisma.supplier.findMany({
          select: { name: true },
          orderBy: { name: "asc" },
          take: 2000,
        });
        existing.push(...rows.map((r) => r.name));
      }
      return NextResponse.json({ entity: key, existing });
    } catch (error) {
      console.error(`GET /api/import/${key}?check=1 error:`, error);
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ entity: key, check: "use POST ?check=1" });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ entity: string }> },
) {
  const { entity: key } = await params;
  const entity = importEntityByKey(key);
  if (!entity)
    return NextResponse.json({ error: "Unknown entity" }, { status: 400 });

  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "system.edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const rows: Row[] = Array.isArray(body?.rows) ? body.rows : [];
    if (rows.length === 0)
      return NextResponse.json({ error: "No rows to import" }, { status: 400 });
    if (rows.length > 2000) {
      return NextResponse.json(
        { error: "Maximum 2000 rows per import" },
        { status: 400 },
      );
    }

    // Check-only mode: validate every row server-side, write nothing.
    if (new URL(req.url).searchParams.get("check") === "1") {
      const ctx = await buildContext(key, rows);
      const checks: RowCheck[] = [];
      for (let i = 0; i < rows.length; i++) {
        checks.push({ ...(await validateRow(entity, rows[i], ctx)), index: i });
      }
      return NextResponse.json({ rows: checks, total: rows.length });
    }

    // Server re-validates EVERY row — the client's preview is never trusted.
    const ctx = await buildContext(key, rows);
    let imported = 0;
    const skippedErrors: { index: number; errors: string[] }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const check = await validateRow(entity, row, ctx);
      if (!check.valid) {
        skippedErrors.push({ index: i, errors: check.errors });
        continue;
      }
      try {
        if (key === "products") {
          const data = coerceStored("products", row) as any;
          await prisma.product.upsert({
            where: { sku: data.sku as string },
            update: data,
            create: data,
          });
        } else if (key === "customers") {
          const data = coerceStored("customers", row) as any;
          const existing = await prisma.customer.findFirst({
            where: {
              name: { equals: data.name as string, mode: "insensitive" },
            },
          });
          if (existing)
            await prisma.customer.update({ where: { id: existing.id }, data });
          else await prisma.customer.create({ data });
        } else if (key === "suppliers") {
          const data = coerceStored("suppliers", row) as any;
          const existing = await prisma.supplier.findFirst({
            where: {
              name: { equals: data.name as string, mode: "insensitive" },
            },
          });
          if (existing) {
            await prisma.supplier.update({
              where: { id: existing.id },
              data: {
                ...data,
                adjustmentHistory: [
                  ...((existing.adjustmentHistory as any[]) || []),
                  {
                    action: "UPDATED_BY_IMPORT",
                    by: user.name || "Admin",
                    at: new Date().toISOString(),
                    changes: data,
                  },
                ],
              },
            });
          } else await prisma.supplier.create({ data });
        } else if (key === "boms") {
          const pid = ctx.productBySku.get(cell(row, "productSku"));
          const mid = ctx.materialBySku.get(cell(row, "materialSku"));
          if (!pid || !mid) {
            skippedErrors.push({
              index: i,
              errors: ["Product or material could not be resolved"],
            });
            continue;
          }
          const qty = parseNumber(cell(row, "qtyPerUnit")) ?? 0;
          await prisma.bomLine.upsert({
            where: {
              productId_rawMaterialId: { productId: pid, rawMaterialId: mid },
            },
            update: { qtyPerUnit: qty },
            create: { productId: pid, rawMaterialId: mid, qtyPerUnit: qty },
          });
        }
        imported++;
      } catch (err) {
        skippedErrors.push({
          index: i,
          errors: [err instanceof Error ? err.message : "Import failed"],
        });
      }
    }

    await logAudit({
      actor: user.name || "Admin",
      action: `BULK_IMPORT_${entity.key.toUpperCase()}`,
      entityType: entity.key.toUpperCase(),
      entityId: "bulk",
      details: `${user.name || "Admin"} imported ${imported} ${entity.key} (skipped ${skippedErrors.length})`,
    });

    return NextResponse.json({
      success: true,
      imported,
      skipped: skippedErrors.length,
      errors: skippedErrors,
    });
  } catch (error) {
    console.error(`POST /api/import/${key} error:`, error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
