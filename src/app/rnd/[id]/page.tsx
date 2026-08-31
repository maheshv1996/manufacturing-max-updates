import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import RndProjectDetailClient from "./RndProjectDetailClient";

export const dynamic = "force-dynamic";

export default async function RndProjectDetail(props: any) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/rnd/[id]");

  if (!user || (!user.isOwner && requiredPerm && !can(user, requiredPerm))) {
    redirect("/login");
  }

  return <RndProjectDetailClient {...props} />;
}
