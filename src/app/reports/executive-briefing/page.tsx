import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import ExecutiveBriefingClient from "./ExecutiveBriefingClient";

export const metadata = {
  title: "Executive Monthly Briefing | Management",
  description:
    "Consolidated executive report: Financial margin waterfalls, plant composite OEE, AS9102 aerospace quality yield, and department health scorecards",
};

export const dynamic = "force-dynamic";

export default async function ExecutiveBriefingPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/reports/executive-briefing");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <ExecutiveBriefingClient />;
}
