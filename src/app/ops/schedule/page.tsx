import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import ScheduleBoardClient from "./ScheduleBoardClient";

export const dynamic = "force-dynamic";

export default async function ScheduleBoard(props: any) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/ops/schedule");

  if (!user || (!user.isOwner && requiredPerm && !can(user, requiredPerm))) {
    redirect("/login");
  }

  return <ScheduleBoardClient {...props} />;
}
