import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import FlowsClient from "./FlowsClient";

export const metadata = {
  title: "Visual Flow Automation Studio | Node-RED Engine",
  description:
    "Wire together IIoT triggers, threshold conditions, and native MES actions: Maintenance dispatch, Quality NCRs, and Audio chimes",
};

export const dynamic = "force-dynamic";

export default async function FlowsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/automation/flows");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <FlowsClient />;
}
