import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { ShieldCheck } from "lucide-react";
import AccessReviewClient from "./AccessReviewClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function AccessReviewPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (
    !user ||
    (!user.isOwner && !can(user, "system.view") && !can(user, "system.edit"))
  ) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Quarterly Access Review"
        description="Managers certify each user's department permissions every quarter. Uncertified users auto-suspend past the due date — every suspension and restore drill is audited for ISO 27001 / AS9100."
        icon={<ShieldCheck className="h-5 w-5 text-rose-500" />}
      />
      <AccessReviewClient />
    </div>
  );
}
