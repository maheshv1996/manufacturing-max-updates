/**
 * Shared config for the Import Wizard (/system/import).
 * Single source of truth for the four import entities — used by the client
 * (templates, header mapping, preview columns) AND the server (field
 * whitelists, required/numeric/boolean validation in /api/import/[entity]).
 */

export interface ImportColumn {
  key: string;
  label: string; // CSV header shown in the template
  required?: boolean;
  numeric?: boolean;
  boolean?: boolean;
  note?: string;
}

export interface ImportEntity {
  key: "products" | "customers" | "suppliers" | "boms";
  label: string;
  singular: string;
  description: string;
  columns: ImportColumn[];
  // Friendly header aliases — normalized header (lowercase, non-alphanumerics
  // stripped) -> canonical field key. Covers the template labels verbatim.
  headerAliases: Record<string, string>;
  exampleRows: Record<string, string>[];
}

/** Normalize a CSV header for alias matching: "Product SKU" -> "productsku". */
export function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export const IMPORT_ENTITIES: ImportEntity[] = [
  {
    key: "products",
    label: "Products",
    singular: "product",
    description:
      "Bulk-create or update the product master. Rows matching an existing product code are updated in place.",
    columns: [
      {
        key: "sku",
        label: "code",
        required: true,
        note: "Unique product code",
      },
      { key: "name", label: "name", required: true },
      { key: "unit", label: "unit", note: "Unit of measure, e.g. pcs/kg/m" },
      { key: "materialCostPerUnit", label: "costPrice", numeric: true },
      { key: "sellingPricePerUnit", label: "salePrice", numeric: true },
    ],
    headerAliases: {
      code: "sku",
      sku: "sku",
      productcode: "sku",
      name: "name",
      productname: "name",
      unit: "unit",
      costprice: "materialCostPerUnit",
      materialcostperunit: "materialCostPerUnit",
      saleprice: "sellingPricePerUnit",
      sellingpriceperunit: "sellingPricePerUnit",
    },
    exampleRows: [
      {
        code: "PRD-9001",
        name: "Flange Bracket 60mm",
        unit: "pcs",
        costPrice: "12.5",
        salePrice: "48.0",
      },
      {
        code: "PRD-9002",
        name: "Pump Housing MK2",
        unit: "pcs",
        costPrice: "35.0",
        salePrice: "120.0",
      },
    ],
  },
  {
    key: "customers",
    label: "Customers",
    singular: "customer",
    description:
      "Bulk-create or update the customer master. Rows matching an existing customer name are updated.",
    columns: [
      { key: "name", label: "name", required: true },
      { key: "gstin", label: "gstin" },
      { key: "state", label: "state" },
      { key: "phone", label: "phone" },
    ],
    headerAliases: {
      name: "name",
      customername: "name",
      gstin: "gstin",
      state: "state",
      phone: "phone",
      // legacy headers still accepted
      code: "code",
      contactperson: "contactPerson",
      email: "email",
      address: "address",
      city: "city",
      active: "isActive",
      activetruefalse: "isActive",
    },
    exampleRows: [
      {
        name: "Acme Aerospace Pvt Ltd",
        gstin: "27AABCA1234F1Z5",
        state: "Maharashtra",
        phone: "+91 98200 00001",
      },
      {
        name: "Orion Defence Systems",
        gstin: "29AAECO1234Q1Z7",
        state: "Karnataka",
        phone: "+91 91234 56789",
      },
    ],
  },
  {
    key: "suppliers",
    label: "Suppliers",
    singular: "supplier",
    description:
      "Bulk-create or update the supplier master. Rows matching an existing supplier name are updated.",
    columns: [
      { key: "name", label: "name", required: true },
      { key: "gstin", label: "gstin" },
      { key: "state", label: "state" },
      { key: "phone", label: "phone" },
    ],
    headerAliases: {
      name: "name",
      suppliername: "name",
      gstin: "gstin",
      state: "state",
      phone: "phone",
      // legacy headers still accepted
      code: "code",
      contactperson: "contactPerson",
      email: "email",
      contactphone: "contactPhone",
      rating: "rating",
      leadtime: "leadTimeDays",
      leadtimedays: "leadTimeDays",
      paymentterms: "paymentTerms",
      approved: "isApproved",
      approvedtruefalse: "isApproved",
      active: "isActive",
      activetruefalse: "isActive",
    },
    exampleRows: [
      {
        name: "Hind Aluminium Extrusions",
        gstin: "27AALPH1234F1Z2",
        state: "Maharashtra",
        phone: "+91 98111 22334",
      },
      {
        name: "Kirloskar Fasteners",
        gstin: "29AAKFR5678M1Z9",
        state: "Karnataka",
        phone: "+91 90000 11223",
      },
    ],
  },
  {
    key: "boms",
    label: "BOMs",
    singular: "bill of material line",
    description:
      "Bulk-load BOM lines — each row links a product (by SKU) to a raw material (by material SKU) with a quantity. Both must already exist in the master data.",
    columns: [
      {
        key: "productSku",
        label: "productCode",
        required: true,
        note: "Must match an existing product code",
      },
      {
        key: "materialSku",
        label: "rawMaterialCode",
        required: true,
        note: "Must match an existing raw material code",
      },
      {
        key: "qtyPerUnit",
        label: "qtyPer",
        required: true,
        numeric: true,
        note: "Quantity of material per unit of product",
      },
    ],
    headerAliases: {
      productcode: "productSku",
      productsku: "productSku",
      rawmaterialcode: "materialSku",
      materialsku: "materialSku",
      qtyper: "qtyPerUnit",
      qtyperunit: "qtyPerUnit",
      quantityperunit: "qtyPerUnit",
    },
    exampleRows: [
      { productCode: "PRD-0001", rawMaterialCode: "RM-AL-6061", qtyPer: "1.5" },
      { productCode: "PRD-0002", rawMaterialCode: "RM-CI-250", qtyPer: "2.0" },
    ],
  },
];

export function importEntityByKey(key: string): ImportEntity | undefined {
  return IMPORT_ENTITIES.find((e) => e.key === key);
}

/** Serialize an entity's template CSV: header row + 2 example rows. */
export function buildTemplateCsv(entity: ImportEntity): string {
  const headers = entity.columns.map((c) => c.label);
  const lines: string[] = [headers.join(",")];
  for (const ex of entity.exampleRows) {
    lines.push(
      headers
        .map((h) => {
          const v = ex[h] ?? "";
          return csvEscape(v);
        })
        .join(","),
    );
  }
  return lines.join("\r\n");
}

export function csvEscape(v: string): string {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
