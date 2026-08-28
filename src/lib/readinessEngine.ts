export interface MaterialRequirement {
  rawMaterialId: string;
  name: string;
  sku: string;
  unit: string;
  unitCost: number;
  qtyPerUnit: number;
  requiredQty: number;
  currentStock: number;
  shortageQty: number;
  status: "READY" | "SHORT";
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
  overallStatus: "READY" | "SHORT";
  shortageCount: number;
  shortageMaterialsText: string;
  materials: MaterialRequirement[];
}

export function calculateWorkOrderReadiness(wo: any): WorkOrderReadiness {
  const bomLines: any[] = wo.product?.bomLines || [];
  const plannedQty = wo.plannedQuantity || 0;

  const materials: MaterialRequirement[] = bomLines.map((line: any) => {
    const rawMat = line.rawMaterial || {};
    const qtyPerUnit = line.qtyPerUnit || 0;
    const requiredQty = Number((plannedQty * qtyPerUnit).toFixed(4));
    const currentStock = rawMat.currentStock || 0;
    const shortageQty = Math.max(
      0,
      Number((requiredQty - currentStock).toFixed(4)),
    );
    const status: "READY" | "SHORT" =
      currentStock >= requiredQty ? "READY" : "SHORT";

    return {
      rawMaterialId: rawMat.id || line.rawMaterialId,
      name: rawMat.name || "Raw Material",
      sku: rawMat.sku || "N/A",
      unit: rawMat.unit || "pcs",
      unitCost: rawMat.unitCost || 0,
      qtyPerUnit,
      requiredQty,
      currentStock,
      shortageQty,
      status,
      supplier: rawMat.supplier
        ? {
            id: rawMat.supplier.id,
            name: rawMat.supplier.name,
            contactPhone: rawMat.supplier.contactPhone,
            email: rawMat.supplier.email,
            defaultLeadDays: rawMat.supplier.defaultLeadDays,
          }
        : null,
    };
  });

  const shortMaterials = materials.filter((m) => m.status === "SHORT");
  const overallStatus: "READY" | "SHORT" =
    shortMaterials.length > 0 ? "SHORT" : "READY";
  const shortageMaterialsText = shortMaterials.map((m) => m.name).join(", ");

  return {
    workOrderId: wo.id,
    woNumber: wo.woNumber || "",
    productName: wo.product?.name || "Product",
    plannedQuantity: plannedQty,
    overallStatus,
    shortageCount: shortMaterials.length,
    shortageMaterialsText,
    materials,
  };
}
