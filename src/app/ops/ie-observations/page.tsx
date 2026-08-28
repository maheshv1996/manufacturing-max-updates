import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { Timer } from "lucide-react";
import LeanClient from "./LeanClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function IeObservationsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !can(user, "ops.view"))) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="IE & Lean Observations"
        description="Industrial engineering observation log — capture the 7 wastes with estimated minutes saved per cycle; monthly savings roll up to the executive strip."
        icon={<Timer className="h-5 w-5 text-cyan-500" />}
      />
      <LeanClient />
    </div>
  );
}
