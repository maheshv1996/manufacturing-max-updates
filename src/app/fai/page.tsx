import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import FaiListClient from "./FaiListClient";

export const dynamic = "force-dynamic";

export default async function FaiListPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/fai");

  if (!user || (!user.isOwner && requiredPerm && !can(user, requiredPerm))) {
    redirect("/login");
  }

  return <FaiListClient />;
}
