import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import SparesAbcClient from "./SparesAbcClient";

export const metadata = { title: "Spares ABC/VED & Reorder Points" };

export default async function Page() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/maintenance/spares-abc");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <SparesAbcClient />;
}
