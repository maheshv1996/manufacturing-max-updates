import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { ShieldAlert } from "lucide-react";
import ExposureClient from "./ExposureClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function CustomerExposurePage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !can(user, "commercial.view"))) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Exposure"
        description="Open work-orders plus receivables per customer — due-dates vs payment terms flag who to hold or chase before you ship more material."
        icon={<ShieldAlert className="h-5 w-5 text-rose-400" />}
      />
      <ExposureClient />
    </div>
  );
}
