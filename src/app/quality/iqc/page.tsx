import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { FlaskConical } from "lucide-react";
import IqcClient from "./IqcClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function IqcPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !can(user, "quality.view"))) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Incoming QC — AQL Sampling"
        description="Sampling tables per material class (A/B/C). A rejected lot is auto-HELD and a supplier NCR is drafted — no keying, no forgetting."
        icon={<FlaskConical className="h-5 w-5 text-emerald-500" />}
      />
      <IqcClient />
    </div>
  );
}
