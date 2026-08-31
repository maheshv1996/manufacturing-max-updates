import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import InfrastructurePageClient from "./InfrastructurePageClient";

export const dynamic = "force-dynamic";

export default async function InfrastructurePage(props: any) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/system/infrastructure");

  if (!user || (!user.isOwner && requiredPerm && !can(user, requiredPerm))) {
    redirect("/login");
  }

  return <InfrastructurePageClient {...props} />;
}
