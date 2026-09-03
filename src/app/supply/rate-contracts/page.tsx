import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { redirect } from "next/navigation";
import RateContractsClient from "./RateContractsClient";

export const dynamic = "force-dynamic";

export default async function RateContractsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (
    !user ||
    (!user.isOwner && !canAny(user, ["supply.view", "commercial.view"]))
  ) {
    redirect("/login");
  }
  return <RateContractsClient />;
}
