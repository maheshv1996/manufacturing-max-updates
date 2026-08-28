import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { BellRing } from "lucide-react";
import FollowUpsClient from "./FollowUpsClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !can(user, "commercial.view"))) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Follow-up Cadence"
        description="Enquiries idle over 7 days ping the bell — log follow-ups, mark lost with a reason, and see why deals slip for managers."
        icon={<BellRing className="h-5 w-5 text-amber-500" />}
      />
      <FollowUpsClient />
    </div>
  );
}
