import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import JobCostingClient from "./JobCostingClient";

export const metadata = {
  title: "Actual vs Standard Job Costing Ledger | Finance",
  description:
    "Work order profitability, estimated BOM vs actual shopfloor consumption, and margin variance",
};

export const dynamic = "force-dynamic";

export default async function JobCostingPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/finance/costing");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <JobCostingClient />;
}
