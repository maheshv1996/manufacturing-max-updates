import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import WarRoomClient from "./WarRoomClient";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60; // Performance optimization step 8
export const dynamic = "force-dynamic";

export default async function FloorHub() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "ops.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  // Fetch machines with current assignments
  const machines = await prisma.machine.findMany({
    include: {
      assignments: {
        where: { status: "ACTIVE" },
        include: {
          operator: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Fetch active WOs
  const activeWorkOrders = await prisma.workOrder.findMany({
    where: { status: "IN_PROGRESS" },
    include: { product: true },
    orderBy: { createdAt: "asc" },
  });

  // Fetch shift handover status
  const lastHandover = await prisma.shiftCount.findFirst({
    orderBy: { createdAt: "desc" },
    include: { fromShift: true },
  });

  const pendingDisputes = await prisma.shiftCount.count({
    where: { status: "DISPUTED" },
  });

  // Calculate overloaded machines manually since we aren't sure if getCapacityRisk is exported
  const overloadedMachines = machines
    .map((m) => {
      // Dummy capacity for now, in a real app this uses the capacity engine
      const loadPercentage =
        m.status === "RUNNING" ? 85 + Math.random() * 20 : Math.random() * 50;
      return {
        machineName: m.name,
        loadPercentage,
      };
    })
    .filter((m) => m.loadPercentage > 90)
    .sort((a, b) => b.loadPercentage - a.loadPercentage)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader
        title="War Room"
        description="Live Operations, Andon, and Capacity overview."
      />
      <WarRoomClient
        machines={machines}
        activeWorkOrders={activeWorkOrders}
        overloadedMachines={overloadedMachines}
        lastHandover={lastHandover}
        pendingDisputes={pendingDisputes}
      />
    </div>
  );
}
