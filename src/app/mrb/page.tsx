import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import MrbDashboardClient from "./MrbDashboardClient";

export const dynamic = "force-dynamic";

export default async function MrbDashboard(props: any) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/mrb");

  if (!user || (!user.isOwner && requiredPerm && !can(user, requiredPerm))) {
    redirect("/login");
  }

  return <MrbDashboardClient {...props} />;
}
