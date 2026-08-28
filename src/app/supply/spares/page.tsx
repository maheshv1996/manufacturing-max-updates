"use client";

import DynamicRegister from "@/app/components/shared/DynamicRegister";
import { Cog } from "lucide-react";

export default function SparesPage() {
  return (
    <DynamicRegister
      config={{
        title: "Spares Management",
        description:
          "Maintenance spare parts stock register with reorder levels, cost, and supplier.",
        entity: "spareParts",
        icon: Cog,
        accent: "bg-orange-500/10 text-orange-400 border-orange-500/30",
        fields: [
          {
            key: "sku",
            label: "SKU",
            required: true,
            placeholder: "e.g. SPR-BEAR-6205",
          },
          { key: "name", label: "Part Name", required: true },
          {
            key: "machineCode",
            label: "Machine Code",
            placeholder: "e.g. CNC-01",
          },
          { key: "currentQty", label: "Current Qty", type: "number" },
          { key: "minQty", label: "Reorder Level", type: "number" },
          { key: "unitCost", label: "Unit Cost (₹)", type: "number" },
          { key: "supplierName", label: "Supplier" },
          {
            key: "location",
            label: "Bin Location",
            placeholder: "e.g. Store Rack B3",
          },
          { key: "notes", label: "Notes", type: "textarea" },
        ],
        columns: [
          { key: "sku", label: "SKU" },
          { key: "name", label: "Part" },
          { key: "machineCode", label: "Machine" },
          { key: "currentQty", label: "Qty", format: "number" },
          { key: "minQty", label: "Reorder", format: "number" },
          { key: "unitCost", label: "Unit Cost", format: "currency" },
          { key: "supplierName", label: "Supplier" },
          { key: "location", label: "Bin" },
        ],
        searchKeys: ["sku", "name", "machineCode", "supplierName"],
      }}
    />
  );
}
