import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { Wrench } from "lucide-react";
import ToolRoomClient from "./ToolRoomClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function ToolRoomPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (
    !user ||
    (!user.isOwner && !can(user, "ops.view") && !can(user, "maintenance.view"))
  ) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tool Room — Life Management"
        description="Cutting tools & fixtures run issue → regrind → scrap lifecycles. Issues post to job costing; a tool at max regrinds cannot be re-issued."
        icon={<Wrench className="h-5 w-5 text-orange-500" />}
      />
      <ToolRoomClient />
    </div>
  );
}
