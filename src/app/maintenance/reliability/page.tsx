import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import ReliabilityClient from "./ReliabilityClient";

export const metadata = {
  title: "TPM & Machine Reliability Dashboard | Maintenance",
  description:
    "Total Productive Maintenance, MTBF, MTTR, PM Schedules, and Work Order Kanban",
};

export const dynamic = "force-dynamic";

export default async function ReliabilityPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/maintenance/reliability");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <ReliabilityClient />;
}
