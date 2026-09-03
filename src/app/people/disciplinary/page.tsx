import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import DisciplinaryClient from "./DisciplinaryClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Disciplinary Register — Stage-Tracked" };

export default async function Page() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/people/disciplinary");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <DisciplinaryClient />;
}
