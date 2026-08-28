import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { CalendarClock } from "lucide-react";
import RosterClient from "./RosterClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function RosterPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (
    !user ||
    (!user.isOwner && !can(user, "ops.view") && !can(user, "people.view"))
  ) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Shift Roster Builder"
        description="Publish the weekly roster — workers see their own shifts on the terminal, roster-vs-attendance variance is live, and leave approvals are blocked when they would understaff a shift."
        icon={<CalendarClock className="h-5 w-5 text-indigo-500" />}
      />
      <RosterClient />
    </div>
  );
}
