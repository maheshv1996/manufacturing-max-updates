import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { ClipboardCheck } from "lucide-react";
import IpqcClient from "./IpqcClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function IpqcPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !can(user, "quality.view"))) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="IPQC Checks & SPC Anomalies"
        description="In-process inspection checklists from the Control Plan — failed checks auto-raise NCRs; managers review the anomalies queue."
        icon={<ClipboardCheck className="h-5 w-5 text-emerald-500" />}
      />
      <IpqcClient />
    </div>
  );
}
