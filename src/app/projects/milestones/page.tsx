import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import MilestonesClient from "./MilestonesClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Milestone Doc Packs" };

export default async function Page() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/projects/milestones");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <MilestonesClient />;
}
