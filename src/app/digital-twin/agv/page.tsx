import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import AgvFleetClient from "./AgvFleetClient";

export const metadata = {
  title:
    "Intralogistics AGV & Automated Storage (AS/RS) Monitor | Digital Twin",
  description:
    "Autonomous Guided Vehicle (AGV) fleet routing, real-time telemetry, battery health, and high-bay AS/RS warehouse utilization",
};

export const dynamic = "force-dynamic";

export default async function AgvPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/digital-twin/agv");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <AgvFleetClient />;
}
