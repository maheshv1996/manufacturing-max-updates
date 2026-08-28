"use client";

import DynamicRegister from "@/app/components/shared/DynamicRegister";
import { TrendingUp } from "lucide-react";

export default function InvestorsPage() {
  return (
    <DynamicRegister
      config={{
        title: "Investor Relations — Quarterly Updates",
        description:
          "Published quarterly business updates for the MD/CEO office and investor communications.",
        entity: "investorUpdates",
        icon: TrendingUp,
        accent: "bg-purple-500/10 text-purple-400 border-purple-500/30",
        fields: [
          {
            key: "quarter",
            label: "Quarter",
            required: true,
            placeholder: "e.g. Q1 FY26",
          },
          { key: "headline", label: "Headline", required: true },
          { key: "revenue", label: "Revenue (₹ Cr)", type: "number" },
          { key: "ebitda", label: "EBITDA (₹ Cr)", type: "number" },
          { key: "netProfit", label: "Net Profit (₹ Cr)", type: "number" },
          {
            key: "ordersBooked",
            label: "Orders Booked (₹ Cr)",
            type: "number",
          },
          { key: "summary", label: "Summary / Notes", type: "textarea" },
          { key: "publishedAt", label: "Published Date", type: "date" },
        ],
        columns: [
          { key: "quarter", label: "Quarter" },
          { key: "headline", label: "Headline" },
          { key: "revenue", label: "Revenue", format: "number" },
          { key: "ebitda", label: "EBITDA", format: "number" },
          { key: "netProfit", label: "Net Profit", format: "number" },
          { key: "ordersBooked", label: "Orders", format: "number" },
          { key: "publishedAt", label: "Published", format: "date" },
        ],
        searchKeys: ["quarter", "headline"],
      }}
    />
  );
}
