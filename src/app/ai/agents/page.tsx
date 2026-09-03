import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import AgentsClient from "./AgentsClient";
import { AGENT_REGISTRY } from "@/app/api/ai/agents/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Autonomous Multi-Agent Hub | Manufacturing Max",
  description:
    "Deploy specialized goal-driven AI agents across machine diagnostics, procurement, aerospace quality, and energy management.",
};

export default async function AgentsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/ai/agents");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <AgentsClient initialAgents={AGENT_REGISTRY} />;
}
