import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import InvestorsPageClient from "./InvestorsPageClient";

export const dynamic = "force-dynamic";

export default async function InvestorsPage(props: any) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/system/investors");

  if (!user || (!user.isOwner && requiredPerm && !can(user, requiredPerm))) {
    redirect("/login");
  }

  return <InvestorsPageClient {...props} />;
}
