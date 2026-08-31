import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import { getCapacityPlan } from "@/lib/capacityEngine";
import CapacityClient from "./CapacityClient";
import { startOfWeek } from "date-fns";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export default async function CapacityPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/ops/capacity");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  const sp = await searchParams;
  let startDate = startOfWeek(new Date(), { weekStartsOn: 1 }); // Default to Monday of current week

  if (sp?.date) {
    const parsed = new Date(sp.date);
    if (!isNaN(parsed.getTime())) {
      startDate = parsed;
    }
  }

  const { machines, totalOverloadedDays, mostLoadedMachine } =
    await getCapacityPlan(startDate, 7);

  return (
    <div className="space-y-6">
      <CapacityClient
        startDateStr={startDate.toISOString()}
        machines={machines}
        totalOverloadedDays={totalOverloadedDays}
        mostLoadedMachine={mostLoadedMachine}
      />
    </div>
  );
}
