export interface MaterialRequirement {
  rawMaterialId: string;
  name: string;
  sku: string;
  unit: string;
  unitCost: number;
  qtyPerUnit: number;
  requiredQty: number;
  currentStock: number;
  minStock: number;
  shortageQty: number;
  status: "READY" | "SHORT" | "LOW_SAFETY_STOCK";
  warningStatus: "OK" | "BELOW_SAFETY_STOCK" | "STOCKOUT";
  leadDays: number;
  leadTimeImpact: "NORMAL" | "HIGH_LEAD_TIME" | "CRITICAL";
  supplier: {
    id: string;
    name: string;
    contactPhone?: string | null;
    email?: string | null;
    defaultLeadDays?: number | null;
  } | null;
}

export interface WorkOrderReadiness {
  workOrderId: string;
  woNumber: string;
  productName: string;
  plannedQuantity: number;
  overallStatus: "READY" | "SHORT" | "LOW_SAFETY_STOCK";
  shortageCount: number;
  safetyStockWarningCount: number;
  shortageMaterialsText: string;
  materials: MaterialRequirement[];
}

// Helpers for clean 4-decimal precision and safe numbers
const round4 = (val: number): number => {
  if (!Number.isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 10000) / 10000;
};

const safePositive = (val: any, fallback = 1): number => {
  const num = Number(val);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

const safeNonNegative = (val: any, fallback = 0): number => {
  const num = Number(val);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
};

export function calculateWorkOrderReadiness(wo: any): WorkOrderReadiness {
  const bomLines: any[] = Array.isArray(wo?.product?.bomLines) ? wo.product.bomLines : [];
  const plannedQty = safePositive(wo?.plannedQuantity, 1);

  const materials: MaterialRequirement[] = bomLines.map((line: any) => {
    const rawMat = line.rawMaterial || {};
    // Ensure qtyPerUnit cannot be 0 to avoid false READY calculations
    const qtyPerUnit = safePositive(line.qtyPerUnit, 1);
    const requiredQty = round4(plannedQty * qtyPerUnit);
    const currentStock = safeNonNegative(rawMat.currentStock);
    const minStock = safeNonNegative(rawMat.minStock);

    const shortageQty = round4(Math.max(0, requiredQty - currentStock));
    
    // Status evaluation considering both current stock and min safety stock
    let status: "READY" | "SHORT" | "LOW_SAFETY_STOCK" = "READY";
    let warningStatus: "OK" | "BELOW_SAFETY_STOCK" | "STOCKOUT" = "OK";

    if (currentStock < requiredQty) {
      status = "SHORT";
      warningStatus = "STOCKOUT";
    } else if (currentStock - requiredQty < minStock) {
      status = "LOW_SAFETY_STOCK";
      warningStatus = "BELOW_SAFETY_STOCK";
    }

    const leadDays = safeNonNegative(rawMat.supplier?.defaultLeadDays, 7);
    const leadTimeImpact: "NORMAL" | "HIGH_LEAD_TIME" | "CRITICAL" =
      leadDays > 30 ? "CRITICAL" : leadDays > 14 ? "HIGH_LEAD_TIME" : "NORMAL";

    return {
      rawMaterialId: line.rawMaterialId || rawMat.id || "MAT-UNKNOWN",
      name: rawMat.name || line.description || "Raw Material",
      sku: rawMat.sku || "N/A",
      unit: rawMat.unit || "pcs",
      unitCost: safeNonNegative(rawMat.unitCost),
      qtyPerUnit,
      requiredQty,
      currentStock,
      minStock,
      shortageQty,
      status,
      warningStatus,
      leadDays,
      leadTimeImpact,
      supplier: rawMat.supplier
        ? {
            id: rawMat.supplier.id,
            name: rawMat.supplier.name,
            contactPhone: rawMat.supplier.contactPhone,
            email: rawMat.supplier.email,
            defaultLeadDays: leadDays,
          }
        : null,
    };
  });

  const shortMaterials = materials.filter((m) => m.status === "SHORT");
  const lowSafetyMaterials = materials.filter((m) => m.status === "LOW_SAFETY_STOCK");

  const overallStatus: "READY" | "SHORT" | "LOW_SAFETY_STOCK" =
    shortMaterials.length > 0 ? "SHORT" : lowSafetyMaterials.length > 0 ? "LOW_SAFETY_STOCK" : "READY";

  // Formatted shortage summary text with exact missing quantities
  const shortageMaterialsText = shortMaterials
    .map((m) => `${m.name} (Short: ${m.shortageQty} ${m.unit})`)
    .join(", ");

  return {
    workOrderId: wo?.id || "",
    woNumber: wo?.woNumber || "",
    productName: wo?.product?.name || "Product",
    plannedQuantity: plannedQty,
    overallStatus,
    shortageCount: shortMaterials.length,
    safetyStockWarningCount: lowSafetyMaterials.length,
    shortageMaterialsText,
    materials,
  };
}
