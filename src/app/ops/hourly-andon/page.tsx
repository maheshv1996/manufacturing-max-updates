import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { Activity } from "lucide-react";
import HourlyAndonClient from "./HourlyAndonClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function HourlyAndonPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !can(user, "ops.view"))) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Hourly Andon"
        description="Every machine's hourly target (from op cycle time) vs actual pieces logged. Two short hours on any machine bells the supervisor."
        icon={<Activity className="h-5 w-5 text-indigo-500" />}
      />
      <HourlyAndonClient />
    </div>
  );
}
