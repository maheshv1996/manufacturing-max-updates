import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { Filter } from "lucide-react";
import FunnelClient from "./FunnelClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function EnquiryFunnelPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !can(user, "commercial.view"))) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Enquiry Funnel"
        description="Every enquiry from first touch to won or lost — conversion per stage, win/loss reasons, and the idle enquiries that need chasing."
        icon={<Filter className="h-5 w-5 text-indigo-400" />}
      />
      <FunnelClient />
    </div>
  );
}
