"use client";

import DynamicRegister from "@/app/components/shared/DynamicRegister";
import { Zap } from "lucide-react";

export default function UtilitiesPage() {
  return (
    <DynamicRegister
      config={{
        title: "Utilities Register",
        description:
          "Power, compressed air, HVAC, water and gas consumption readings with cost tracking.",
        entity: "utilityReadings",
        icon: Zap,
        accent: "bg-amber-500/10 text-amber-400 border-amber-500/30",
        fields: [
          {
            key: "utilityType",
            label: "Utility",
            type: "select",
            options: ["POWER", "COMPRESSED_AIR", "HVAC", "WATER", "GAS"],
          },
          {
            key: "meterName",
            label: "Meter / Source",
            placeholder: "e.g. Main DB Meter 1",
          },
          { key: "reading", label: "Reading", type: "number", required: true },
          { key: "unit", label: "Unit", placeholder: "e.g. kWh" },
          { key: "cost", label: "Cost (₹)", type: "number" },
          { key: "readAt", label: "Read Date", type: "date" },
          { key: "notes", label: "Notes", type: "textarea" },
        ],
        columns: [
          { key: "utilityType", label: "Utility" },
          { key: "meterName", label: "Meter" },
          { key: "reading", label: "Reading", format: "number" },
          { key: "unit", label: "Unit" },
          { key: "cost", label: "Cost", format: "currency" },
          { key: "readAt", label: "Read Date", format: "date" },
        ],
        searchKeys: ["meterName", "utilityType"],
      }}
    />
  );
}
