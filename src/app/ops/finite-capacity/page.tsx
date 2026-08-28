import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { Gauge } from "lucide-react";
import CapacityClient from "./CapacityClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function FiniteCapacityPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !can(user, "ops.view"))) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Finite Capacity Strip"
        description="Machine × day load from open WO routing operations — bars go red past 100% of available hours. Click any day cell to see the work orders loading it."
        icon={<Gauge className="h-5 w-5 text-sky-500" />}
      />
      <CapacityClient />
    </div>
  );
}
