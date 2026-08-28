import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { Landmark } from "lucide-react";
import AssetsClient from "./AssetsClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function FixedAssetsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !can(user, "finance.view"))) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Fixed Assets & Depreciation"
        description="M19: register, straight-line or WDV schedule, and a monthly run that drafts depreciation vouchers — still through the M17 maker-checker gate before anything hits the books."
        icon={<Landmark className="h-5 w-5 text-violet-400" />}
      />
      <AssetsClient />
    </div>
  );
}
