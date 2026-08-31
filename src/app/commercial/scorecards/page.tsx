import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import ScorecardsClient from "./ScorecardsClient";

export const metadata = { title: "Customer Scorecards (our PPM/OTD)" };

export default async function Page() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/commercial/scorecards");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <ScorecardsClient />;
}
