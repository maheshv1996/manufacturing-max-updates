import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AGENT_REGISTRY } from "@/app/api/ai/agents/route";
import { SAMPLE_CONFLICTS } from "@/app/api/ai/cortex/route";
import CortexClient from "./CortexClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CortexPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user.id || (!user.isOwner && !can(user, "ops.view") && !can(user, "system.view"))) {
    redirect("/login");
  }

  const [machines, workOrders, usersCount] = await Promise.all([
    prisma.machine.findMany({ select: { id: true, code: true, name: true, status: true } }),
    prisma.workOrder.findMany({ where: { status: "IN_PROGRESS" } }),
    prisma.user.count(),
  ]);

  const initialData = {
    activeAgentsCount: AGENT_REGISTRY.length,
    systemHealth: "OPTIMAL",
    neuralLoad: "14.2%",
    agents: AGENT_REGISTRY,
    conflicts: SAMPLE_CONFLICTS,
    onlineMachinesCount: machines.filter((m) => m.status === "RUNNING").length,
    totalMachinesCount: machines.length,
    activeWorkOrdersCount: workOrders.length,
    totalUsersCount: usersCount,
  };

  return <CortexClient initialData={initialData} />;
}
