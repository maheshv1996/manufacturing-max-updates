import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import SpcChartsPageClient from "./SpcChartsPageClient";

export const dynamic = "force-dynamic";

export default async function SpcChartsPage(props: any) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/quality/spc-charts");

  if (!user || (!user.isOwner && requiredPerm && !can(user, requiredPerm))) {
    redirect("/login");
  }

  return <SpcChartsPageClient {...props} />;
}
