import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import MrpWorkbenchClient from "./MrpWorkbenchClient";

export const dynamic = "force-dynamic";

export default async function MrpWorkbench(props: any) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/supply/mrp");

  if (!user || (!user.isOwner && requiredPerm && !can(user, requiredPerm))) {
    redirect("/login");
  }

  return <MrpWorkbenchClient {...props} />;
}
