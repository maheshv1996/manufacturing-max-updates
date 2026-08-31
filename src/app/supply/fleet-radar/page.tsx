import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import FleetRadarClient from "./FleetRadarClient";

export const metadata = {
  title: "Supply Chain Fleet Radar | Logistics",
  description:
    "Real-time multi-modal logistics tracking: Inbound raw materials, outward subcontracting challans, and aerospace customer dispatches",
};

export const dynamic = "force-dynamic";

export default async function FleetRadarPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/supply/fleet-radar");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <FleetRadarClient />;
}
