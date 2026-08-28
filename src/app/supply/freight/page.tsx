import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { Truck } from "lucide-react";
import FreightClient from "./FreightClient";

export const dynamic = "force-dynamic";

export default async function FreightPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !canAny(user, ["supply.view", "ops.view"]))) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Freight Vendors & Dispatch"
        description="Freight vendor register, live dispatch schedule board, and on-time performance scorecards."
        icon={<Truck className="h-5 w-5 text-amber-400" />}
      />
      <FreightClient />
    </div>
  );
}
