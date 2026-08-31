/**
 * Shared configuration for the Bulk Import Wizard (/system/import).
 * Single source of truth for import entities — used by both client-side
 * template generators / preview grids AND backend validation routes (/api/import/[entity]).
 */

export interface ImportColumn {
  key: string;
  label: string; // CSV header shown in the downloadable template
  required?: boolean;
  numeric?: boolean;
  boolean?: boolean;
  note?: string;
}

export interface ImportEntity {
  key: "products" | "rawMaterials" | "customers" | "suppliers" | "boms";
  label: string;
  singular: string;
  description: string;
  dependsOn?: string[];
  columns: ImportColumn[];
  headerAliases: Record<string, string>;
  exampleRows: Record<string, string>[];
}

/** Normalize a CSV header for alias matching: "Product SKU / Code" -> "productskucode". */
export function normalizeHeader(h: string): string {
  return String(h || "")
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
      "Bulk-create or update finished goods and assemblies. Matching product codes are updated in-place.",
    columns: [
      {
        key: "sku",
        label: "code",
        required: true,
        note: "Unique product SKU / part number",
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
      productsku: "sku",
      partnumber: "sku",
      partno: "sku",
      itemcode: "sku",
      name: "name",
      productname: "name",
      itemname: "name",
      description: "name",
      unit: "unit",
      uom: "unit",
      unitofmeasure: "unit",
      costprice: "materialCostPerUnit",
      cost: "materialCostPerUnit",
      materialcost: "materialCostPerUnit",
      materialcostperunit: "materialCostPerUnit",
      saleprice: "sellingPricePerUnit",
      price: "sellingPricePerUnit",
      sellingprice: "sellingPricePerUnit",
      sellingpriceperunit: "sellingPricePerUnit",
    },
    exampleRows: [
      {
        code: "PRD-9001",
        name: "Flange Bracket 60mm",
        unit: "pcs",
        costPrice: "12.50",
        salePrice: "48.00",
      },
      {
        code: "PRD-9002",
        name: "Pump Housing MK2",
        unit: "pcs",
        costPrice: "35.00",
        salePrice: "120.00",
      },
      {
        code: "PRD-9003",
        name: "Precision Rotor Shaft",
        unit: "pcs",
        costPrice: "24.00",
        salePrice: "85.00",
      },
    ],
  },
  {
    key: "rawMaterials",
    label: "Raw Materials",
    singular: "raw material",
    description:
      "Bulk-create or update raw materials, inventory items, and BOM components.",
    columns: [
      {
        key: "sku",
        label: "code",
        required: true,
        note: "Unique material SKU / part number (e.g. RM-AL-6061)",
      },
      { key: "name", label: "name", required: true },
      { key: "unit", label: "unit", note: "Unit of measure, e.g. kg/m/pcs" },
      { key: "costPerUnit", label: "unitCost", numeric: true },
      { key: "currentStock", label: "currentStock", numeric: true },
      { key: "safetyStock", label: "safetyStock", numeric: true },
    ],
    headerAliases: {
      code: "sku",
      sku: "sku",
      materialcode: "sku",
      rawmaterialcode: "sku",
      itemcode: "sku",
      partno: "sku",
      name: "name",
      materialname: "name",
      rawmaterialname: "name",
      description: "name",
      unit: "unit",
      uom: "unit",
      unitcost: "costPerUnit",
      cost: "costPerUnit",
      costperunit: "costPerUnit",
      price: "costPerUnit",
      currentstock: "currentStock",
      stock: "currentStock",
      qty: "currentStock",
      safetystock: "safetyStock",
      safety: "safetyStock",
    },
    exampleRows: [
      {
        code: "RM-AL-6061",
        name: "Aluminium 6061-T6 Round Bar 50mm",
        unit: "kg",
        unitCost: "8.50",
        currentStock: "500",
        safetyStock: "100",
      },
      {
        code: "RM-CI-250",
        name: "Cast Iron Grade 250 Ingot",
        unit: "kg",
        unitCost: "4.20",
        currentStock: "1200",
        safetyStock: "250",
      },
      {
        code: "RM-SS-316L",
        name: "Stainless Steel 316L Sheet 3mm",
        unit: "kg",
        unitCost: "16.00",
        currentStock: "350",
        safetyStock: "50",
      },
    ],
  },
  {
    key: "customers",
    label: "Customers",
    singular: "customer",
    description:
      "Bulk-create or update client master records. Matching customer names are updated in-place.",
    columns: [
      { key: "name", label: "name", required: true },
      { key: "gstin", label: "gstin" },
      { key: "state", label: "state" },
      { key: "phone", label: "phone" },
    ],
    headerAliases: {
      name: "name",
      customername: "name",
      companyname: "name",
      clientname: "name",
      gstin: "gstin",
      gst: "gstin",
      gstnumber: "gstin",
      taxid: "gstin",
      state: "state",
      province: "state",
      region: "state",
      phone: "phone",
      contactphone: "phone",
      telephone: "phone",
      mobile: "phone",
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
      "Bulk-create or update approved vendor directory. Matching supplier names are updated in-place.",
    columns: [
      { key: "name", label: "name", required: true },
      { key: "gstin", label: "gstin" },
      { key: "state", label: "state" },
      { key: "phone", label: "phone" },
    ],
    headerAliases: {
      name: "name",
      suppliername: "name",
      vendorname: "name",
      vendor: "name",
      gstin: "gstin",
      gst: "gstin",
      gstnumber: "gstin",
      taxid: "gstin",
      state: "state",
      province: "state",
      region: "state",
      phone: "phone",
      contactphone: "phone",
      telephone: "phone",
      mobile: "phone",
      code: "code",
      contactperson: "contactPerson",
      email: "email",
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
      "Bulk-load BOM recipe lines. Links parent products to raw material SKUs with required quantities.",
    dependsOn: ["products", "rawMaterials"],
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
        note: "Quantity of material consumed per unit of product",
      },
    ],
    headerAliases: {
      productcode: "productSku",
      productsku: "productSku",
      parentsku: "productSku",
      parentcode: "productSku",
      rawmaterialcode: "materialSku",
      materialsku: "materialSku",
      componentcode: "materialSku",
      componentsku: "materialSku",
      qtyper: "qtyPerUnit",
      qtyperunit: "qtyPerUnit",
      quantityperunit: "qtyPerUnit",
      quantity: "qtyPerUnit",
      qty: "qtyPerUnit",
    },
    exampleRows: [
      { productCode: "PRD-9001", rawMaterialCode: "RM-AL-6061", qtyPer: "1.5" },
      { productCode: "PRD-9002", rawMaterialCode: "RM-CI-250", qtyPer: "2.0" },
      { productCode: "PRD-9003", rawMaterialCode: "RM-SS-316L", qtyPer: "0.8" },
    ],
  },
];

export function importEntityByKey(key: string): ImportEntity | undefined {
  return IMPORT_ENTITIES.find((e) => e.key === key);
}

/** Serialize an entity's template CSV: header row + example rows. */
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
  const s = String(v ?? "").trim();
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
