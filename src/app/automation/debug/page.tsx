import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import DebugConsoleClient from "./DebugConsoleClient";

export const metadata = {
  title: "Node-RED Real-Time Debug Wire | Automation",
  description:
    "Streaming telemetry evaluation logs, threshold triggers, action dispatch records, and sub-millisecond execution latencies",
};

export const dynamic = "force-dynamic";

export default async function DebugPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/automation/debug");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <DebugConsoleClient />;
}
