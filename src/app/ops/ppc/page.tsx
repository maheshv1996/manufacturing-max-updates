import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { ListOrdered } from "lucide-react";
import PpcClient from "./PpcClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function PpcPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !can(user, "ops.view"))) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="PPC Priority Board"
        description="Production Planning & Control — drag to re-sequence open work orders. Chips show material readiness and due-date risk; every re-sequence is audited WO_RESEQUENCED."
        icon={<ListOrdered className="h-5 w-5 text-indigo-500" />}
      />
      <PpcClient />
    </div>
  );
}
