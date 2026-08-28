import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { PackageOpen } from "lucide-react";
import MaterialIssueClient from "./MaterialIssueClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function MaterialIssuePage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !can(user, "supply.view"))) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Material Issue Slips"
        description="Stores issues raw material against a work order with batch/heat — consumption auto-posts to inventory, job costing and WO readiness."
        icon={<PackageOpen className="h-5 w-5 text-sky-500" />}
      />
      <MaterialIssueClient />
    </div>
  );
}
