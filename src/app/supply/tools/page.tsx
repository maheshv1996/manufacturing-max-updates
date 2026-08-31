import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import ToolsManagementPageClient from "./ToolsManagementPageClient";

export const dynamic = "force-dynamic";

export default async function ToolsManagementPage(props: any) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/supply/tools");

  if (!user || (!user.isOwner && requiredPerm && !can(user, requiredPerm))) {
    redirect("/login");
  }

  return <ToolsManagementPageClient {...props} />;
}
