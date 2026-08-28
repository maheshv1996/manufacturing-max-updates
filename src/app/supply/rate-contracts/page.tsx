import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { BadgeIndianRupee } from "lucide-react";
import DynamicRegister from "@/app/components/shared/DynamicRegister";

export const dynamic = "force-dynamic";

export default async function RateContractsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (
    !user ||
    (!user.isOwner && !canAny(user, ["supply.view", "commercial.view"]))
  ) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Rate Contracts"
        description="Annualised rate agreement register — locked unit rates per material + supplier with validity windows."
        icon={<BadgeIndianRupee className="h-5 w-5 text-amber-400" />}
      />
      <DynamicRegister
        config={{
          title: "Rate Contract Register",
          description:
            "Material-supplier rate agreements with validity and status.",
          entity: "rateContracts",
          icon: BadgeIndianRupee,
          accent: "bg-amber-500/10 text-amber-400 border-amber-500/30",
          fields: [
            {
              key: "contractNumber",
              label: "Contract Number",
              required: true,
              placeholder: "e.g. RC-2026-001",
            },
            {
              key: "rawMaterialId",
              label: "Raw Material ID",
              required: true,
              placeholder: "Material record ID…",
            },
            {
              key: "supplierId",
              label: "Supplier ID",
              required: true,
              placeholder: "Supplier record ID…",
            },
            {
              key: "rate",
              label: "Rate (₹/unit)",
              type: "number",
              required: true,
            },
            { key: "validFrom", label: "Valid From", type: "date" },
            { key: "validTo", label: "Valid To", type: "date" },
            {
              key: "status",
              label: "Status",
              type: "select",
              options: ["ACTIVE", "EXPIRED", "ARCHIVED"],
            },
            { key: "notes", label: "Notes", type: "textarea" },
          ],
          columns: [
            { key: "contractNumber", label: "Contract" },
            { key: "rawMaterialId", label: "Material", format: "text" },
            { key: "supplierId", label: "Supplier", format: "text" },
            { key: "rate", label: "Rate ₹", format: "number" },
            { key: "validFrom", label: "Valid From", format: "date" },
            { key: "validTo", label: "Valid To", format: "date" },
            { key: "status", label: "Status" },
          ],
          statusKey: "status",
          statusColors: {
            ACTIVE:
              "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
            EXPIRED:
              "bg-amber-500/10 text-amber-400 border border-amber-500/30",
            ARCHIVED:
              "bg-slate-500/10 text-slate-400 border border-slate-500/30",
          },
          searchKeys: ["contractNumber", "rawMaterialId", "supplierId"],
        }}
      />
    </div>
  );
}
