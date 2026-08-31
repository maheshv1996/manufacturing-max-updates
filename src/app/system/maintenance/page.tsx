import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import MaintenanceClient from "./MaintenanceClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MaintenancePage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/system/maintenance");

  if (!user || (!user.isOwner && requiredPerm && !can(user, requiredPerm))) {
    redirect("/login");
  }

  const roleName = user.roleName || "OPERATOR";
  const userName = user.name || "User";

  return <MaintenanceClient role={roleName} userName={userName} />;
}
