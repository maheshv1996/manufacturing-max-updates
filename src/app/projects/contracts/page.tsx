"use client";

import DynamicRegister from "@/app/components/shared/DynamicRegister";
import { FileSignature } from "lucide-react";

export default function ContractsPage() {
  return (
    <DynamicRegister
      config={{
        title: "Contract Management",
        description:
          "Customer / program contracts with value, term, PO reference, and lifecycle status.",
        entity: "contracts",
        icon: FileSignature,
        accent: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30",
        fields: [
          {
            key: "contractNumber",
            label: "Contract Number",
            required: true,
            placeholder: "e.g. CON-2026-014",
          },
          { key: "customerName", label: "Customer", required: true },
          { key: "projectId", label: "Project Ref" },
          {
            key: "title",
            label: "Title",
            placeholder: "e.g. Turbine Housing Supply",
          },
          { key: "value", label: "Contract Value", type: "number" },
          { key: "currency", label: "Currency", placeholder: "e.g. INR" },
          { key: "startDate", label: "Start Date", type: "date" },
          { key: "endDate", label: "End Date", type: "date" },
          { key: "poReference", label: "PO Reference" },
          {
            key: "status",
            label: "Status",
            type: "select",
            options: ["DRAFT", "ACTIVE", "COMPLETED", "CLOSED"],
          },
          { key: "notes", label: "Notes", type: "textarea" },
        ],
        columns: [
          { key: "contractNumber", label: "Contract No." },
          { key: "customerName", label: "Customer" },
          { key: "title", label: "Title" },
          { key: "value", label: "Value", format: "currency" },
          { key: "currency", label: "Cur." },
          { key: "startDate", label: "Start", format: "date" },
          { key: "endDate", label: "End", format: "date" },
          { key: "status", label: "Status" },
        ],
        statusKey: "status",
        searchKeys: ["contractNumber", "customerName", "title", "poReference"],
      }}
    />
  );
}
