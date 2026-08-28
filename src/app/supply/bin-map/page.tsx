import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { MapPinned } from "lucide-react";
import BinMapClient from "./BinMapClient";

export const dynamic = "force-dynamic";

export default async function BinMapPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !canAny(user, ["supply.view", "ops.view"]))) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bin Map"
        description="Warehouse map of raw-material storage — every bin's zone, location, assigned material and quantity."
        icon={<MapPinned className="h-5 w-5 text-amber-400" />}
      />
      <BinMapClient />
    </div>
  );
}
