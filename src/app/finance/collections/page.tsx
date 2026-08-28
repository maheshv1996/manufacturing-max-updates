import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { HandCoins } from "lucide-react";
import CollectionsClient from "./CollectionsClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (
    !user ||
    (!user.isOwner &&
      !can(user, "finance.view") &&
      !can(user, "commercial.view"))
  ) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Collections Workflow"
        description="Aging buckets assigned to collectors — weekly follow-up log and printable dunning letters L1 → L2 → L3 (reminder → firm demand → final notice)."
        icon={<HandCoins className="h-5 w-5 text-emerald-500" />}
      />
      <CollectionsClient />
    </div>
  );
}
