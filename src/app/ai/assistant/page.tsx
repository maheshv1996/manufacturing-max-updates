import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import AiAssistantClient from "./AiAssistantClient";

export const metadata = {
  title: "Shopfloor AI Copilot | Industrial Assistant",
  description:
    "Generative AI assistant grounded in live telemetry, work orders, AS9102 quality records, and 3D digital twins",
};

export const dynamic = "force-dynamic";

export default async function AiAssistantPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/ai/assistant");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <AiAssistantClient />;
}
