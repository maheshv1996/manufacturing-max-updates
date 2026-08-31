import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import UtilitiesClient from "./UtilitiesClient";

export const metadata = { title: "Utilities Log & Energy KPIs" };

export default async function Page() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/maintenance/utilities");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <UtilitiesClient />;
}
