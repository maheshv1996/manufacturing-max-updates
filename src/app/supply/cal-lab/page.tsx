import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { FlaskConical } from "lucide-react";
import CalLabClient from "./CalLabClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function CalLabPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (
    !user ||
    (!user.isOwner && !can(user, "supply.view") && !can(user, "metrology.view"))
  ) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Cal Lab Procurement"
        description="Instruments due within 30 days auto-raise calibration requisitions to Supply — external-lab flow with vendor ratings."
        icon={<FlaskConical className="h-5 w-5 text-teal-500" />}
      />
      <CalLabClient />
    </div>
  );
}
