import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { Boxes } from "lucide-react";
import CycleCountClient from "./CycleCountClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function CycleCountPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (
    !user ||
    (!user.isOwner && !can(user, "supply.view") && !can(user, "finance.view"))
  ) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Cycle Count Program"
        description="ABC-classified count schedule — workers count, variances over threshold go to Finance for approval and stock adjustment."
        icon={<Boxes className="h-5 w-5 text-sky-500" />}
      />
      <CycleCountClient />
    </div>
  );
}
