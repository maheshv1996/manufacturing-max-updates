import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import CommercialDeskPage from "./desk/page";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export default async function CommercialPage() {
  const user = getUserFromHeaders(await headers());
  const perm = permissionForPath("/commercial");
  if (!user.isOwner && perm && !can(user, perm)) redirect("/");
  return CommercialDeskPage();
}
