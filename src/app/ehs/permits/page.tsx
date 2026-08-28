import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { ShieldCheck } from "lucide-react";
import PermitsClient from "./PermitsClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function PermitsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (
    !user ||
    (!user.isOwner && !can(user, "ehs.view") && !can(user, "maintenance.view"))
  ) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Permit-to-Work"
        description="Hot work, height work and confined-space permits need the EHS + Maintenance + Production manager sign-offs before the maintenance job can start. Expired permits auto-void."
        icon={<ShieldCheck className="h-5 w-5 text-lime-500" />}
      />
      <PermitsClient />
    </div>
  );
}
