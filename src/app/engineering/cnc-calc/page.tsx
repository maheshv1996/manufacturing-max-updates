import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import CncCalculatorPageClient from "./CncCalculatorPageClient";

export const dynamic = "force-dynamic";

export default async function CncCalculatorPage(props: any) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/engineering/cnc-calc");

  if (!user || (!user.isOwner && requiredPerm && !can(user, requiredPerm))) {
    redirect("/login");
  }

  return <CncCalculatorPageClient {...props} />;
}
