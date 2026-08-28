import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { BadgeIndianRupee } from "lucide-react";
import PriceRevisionsClient from "./PriceRevisionsClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function PriceRevisionsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !can(user, "commercial.view"))) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Price Revision Register"
        description="Contractual annual increases with due-date alerts — manager-approved price lists become the default on every new quotation."
        icon={<BadgeIndianRupee className="h-5 w-5 text-emerald-500" />}
      />
      <PriceRevisionsClient />
    </div>
  );
}
