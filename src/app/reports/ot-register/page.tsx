import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import OtRegisterClient from "./OtRegisterClient";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function OtRegisterPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !can(user, "people.view") && !can(user, "reports.print"))) {
    redirect("/login");
  }

  return <OtRegisterClient />;
}
