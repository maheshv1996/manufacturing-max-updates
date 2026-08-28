import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { CalendarRange } from "lucide-react";
import SopClient from "./SopClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function SopPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (
    !user ||
    (!user.isOwner && !can(user, "ops.view") && !can(user, "commercial.view"))
  ) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="S&OP — Order Book vs Capacity"
        description="Weekly sales plan vs production capacity. Recorded decisions auto-create HR overtime requests or reserved machine windows — sales ↔ production ↔ HR."
        icon={<CalendarRange className="h-5 w-5 text-sky-500" />}
      />
      <SopClient />
    </div>
  );
}
